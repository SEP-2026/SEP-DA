from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.routes.auth import get_current_user
from app.services.wallet_service import WalletError, get_wallet_summary, top_up_wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


class WalletTopUpRequest(BaseModel):
    amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=255)


@router.get("/me")
def read_my_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"wallet": get_wallet_summary(db, current_user.id)}


@router.post("/topup")
def mock_topup_wallet(
    payload: WalletTopUpRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        wallet = top_up_wallet(db, current_user.id, payload.amount, payload.note)
        db.commit()
        return {"message": "Nạp tiền thành công", "wallet": wallet}
    except WalletError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise
