import os
import time
from collections import defaultdict

import redis
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.routes.auth import get_current_user
from app.services.wallet_service import WalletError, get_wallet_summary, get_wallet_transactions, top_up_wallet

ENABLE_MOCK_TOPUP = os.getenv("ENABLE_MOCK_TOPUP", "false").lower() in {"1", "true", "yes"}
_TOPUP_RATE_LIMIT = {
    "per_minute": 5,
    "per_hour": 20,
}
_topup_requests: dict[int, list[float]] = defaultdict(list)

REDIS_URL = os.getenv("REDIS_URL")
_redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None

router = APIRouter(prefix="/wallet", tags=["wallet"])


class WalletTopUpRequest(BaseModel):
    amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


def _check_topup_rate_limit(user_id: int) -> None:
    now = time.time()
    if _redis_client:
        # Use Redis for rate limiting
        key_minute = f"topup:{user_id}:minute"
        key_hour = f"topup:{user_id}:hour"
        # Add current timestamp to sorted sets
        _redis_client.zadd(key_minute, {str(now): now})
        _redis_client.zadd(key_hour, {str(now): now})
        # Remove old entries
        _redis_client.zremrangebyscore(key_minute, 0, now - 60)
        _redis_client.zremrangebyscore(key_hour, 0, now - 3600)
        # Check limits
        count_minute = _redis_client.zcount(key_minute, now - 60, now)
        count_hour = _redis_client.zcount(key_hour, now - 3600, now)
        if count_minute >= _TOPUP_RATE_LIMIT["per_minute"]:
            raise HTTPException(status_code=429, detail="Giới hạn nạp tiền quá nhiều trong 1 phút")
        if count_hour >= _TOPUP_RATE_LIMIT["per_hour"]:
            raise HTTPException(status_code=429, detail="Giới hạn nạp tiền quá nhiều trong 1 giờ")
    else:
        # Fallback to in-memory
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


@router.get("/transactions")
def read_wallet_transactions(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if limit > 100:
        limit = 100
    transactions = get_wallet_transactions(db, current_user.id, limit, offset)
    return {"transactions": transactions}


@router.post("/topup")
def mock_topup_wallet(
    payload: WalletTopUpRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ENABLE_MOCK_TOPUP:
        raise HTTPException(status_code=404, detail="Endpoint mock topup đã bị vô hiệu hóa")

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
