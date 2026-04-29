import os
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.routes.auth import get_current_user
from app.services.wallet_service import WalletError, get_wallet_summary, top_up_wallet

ENABLE_MOCK_TOPUP = os.getenv("ENABLE_MOCK_TOPUP", "false").lower() in {"1", "true", "yes"}
_TOPUP_RATE_LIMIT = {
    "per_minute": 5,
    "per_hour": 20,
}
_topup_requests: dict[int, list[float]] = defaultdict(list)

router = APIRouter(prefix="/wallet", tags=["wallet"])


class WalletTopUpRequest(BaseModel):
    amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


def _check_topup_rate_limit(user_id: int) -> None:
    now = time.time()
    entries = _topup_requests[user_id]
    window_minute = now - 60
    window_hour = now - 3600
    entries[:] = [ts for ts in entries if ts >= window_hour]
    if sum(1 for ts in entries if ts >= window_minute) >= _TOPUP_RATE_LIMIT["per_minute"]:
        raise HTTPException(status_code=429, detail="Giới hạn nạp tiền quá nhiều trong 1 phút")
    if len(entries) >= _TOPUP_RATE_LIMIT["per_hour"]:
        raise HTTPException(status_code=429, detail="Giới hạn nạp tiền quá nhiều trong 1 giờ")
    entries.append(now)


@router.get("/me")
def read_my_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"wallet": get_wallet_summary(db, current_user.id)}


@router.post("/topup")
def mock_topup_wallet(
    payload: WalletTopUpRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ENABLE_MOCK_TOPUP:
        raise HTTPException(status_code=404, detail="Endpoint mock topup đã bị vô hiệu hóa")
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền sử dụng endpoint này")

    _check_topup_rate_limit(current_user.id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        wallet = top_up_wallet(
            db,
            current_user.id,
            payload.amount,
            payload.note,
            actor_id=current_user.id,
            actor_role=current_user.role,
            request_ip=client_ip,
            user_agent=user_agent,
        )
        db.commit()
        return {"message": "Nạp tiền thành công", "wallet": wallet}
    except WalletError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise
