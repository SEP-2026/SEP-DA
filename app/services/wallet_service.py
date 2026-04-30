from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import Wallet, WalletTransaction


class WalletError(Exception):
    pass


class InsufficientWalletBalance(WalletError):
    pass


@dataclass(frozen=True)
class WalletSummary:
    user_id: int
    balance: float
    reserved_balance: float


def _normalize_amount(amount: float | int | Decimal) -> Decimal:
    value = Decimal(str(amount or 0)) if not isinstance(amount, Decimal) else amount
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def serialize_wallet(wallet: Wallet | None, user_id: int) -> dict:
    balance = _normalize_amount(wallet.balance if wallet else 0)
    reserved_balance = _normalize_amount(wallet.reserved_balance if wallet else 0)
    return {
        "user_id": user_id,
        "balance": float(balance),
        "reserved_balance": float(reserved_balance),
    }


def get_wallet_summary(db: Session, user_id: int) -> dict:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    return serialize_wallet(wallet, user_id)


def get_wallet_transactions(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        return []
    transactions = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [
        {
            "id": txn.id,
            "transaction_type": txn.transaction_type,
            "amount": float(txn.amount),
            "reference_type": txn.reference_type,
            "reference_id": txn.reference_id,
            "source_type": txn.source_type,
            "source_id": txn.source_id,
            "note": txn.note,
            "created_at": txn.created_at.isoformat(),
        }
        for txn in transactions
    ]


def _create_wallet(db: Session, user_id: int) -> Wallet:
    for _ in range(2):
        wallet = Wallet(user_id=user_id, balance=Decimal("0.00"), reserved_balance=Decimal("0.00"))
        db.add(wallet)
        try:
            db.flush()
            return wallet
        except IntegrityError:
            db.rollback()
            existing_wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
            if existing_wallet:
                return existing_wallet
    raise WalletError("Không thể tạo ví mới do xung đột đồng thời")


def _lock_wallet(db: Session, user_id: int) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
    if wallet:
        return wallet
    return _create_wallet(db, user_id)


def _add_transaction(
    db: Session,
    wallet: Wallet,
    transaction_type: str,
    amount: float | Decimal,
    reference_type: str | None = None,
    reference_id: int | None = None,
    source_type: str | None = None,
    source_id: int | None = None,
    actor_id: int | None = None,
    actor_role: str | None = None,
    request_ip: str | None = None,
    user_agent: str | None = None,
    note: str | None = None,
) -> WalletTransaction:
    txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_type=transaction_type,
        amount=_normalize_amount(amount),
        reference_type=reference_type,
        reference_id=reference_id,
        source_type=source_type,
        source_id=source_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note,
    )
    db.add(txn)
    return txn


def top_up_wallet(
    db: Session,
    user_id: int,
    amount: float | Decimal,
    note: str | None = None,
    actor_id: int | None = None,
    actor_role: str | None = None,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    topup_amount = _normalize_amount(amount)
    if topup_amount <= 0:
        raise WalletError("Số tiền nạp phải lớn hơn 0")

    wallet = _lock_wallet(db, user_id)
    wallet.balance = _normalize_amount(wallet.balance + topup_amount)
    _add_transaction(
        db,
        wallet,
        "topup",
        topup_amount,
        "wallet",
        user_id,
        source_type="wallet_topup",
        source_id=user_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note or "Nạp tiền mô phỏng",
    )
    return serialize_wallet(wallet, user_id)


def reserve_wallet_amount(
    db: Session,
    user_id: int,
    amount: float | Decimal,
    reference_type: str,
    reference_id: int | None = None,
    note: str | None = None,
    actor_id: int | None = None,
    actor_role: str | None = None,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    reserve_amount = _normalize_amount(amount)
    if reserve_amount <= 0:
        return get_wallet_summary(db, user_id)

    wallet = _lock_wallet(db, user_id)
    current_balance = _normalize_amount(wallet.balance)
    if current_balance < reserve_amount:
        raise InsufficientWalletBalance("Số dư ví không đủ để đặt chỗ")

    wallet.balance = _normalize_amount(current_balance - reserve_amount)
    wallet.reserved_balance = _normalize_amount(wallet.reserved_balance + reserve_amount)
    _add_transaction(
        db,
        wallet,
        "reserve",
        reserve_amount,
        reference_type,
        reference_id,
        source_type="wallet_reserve",
        source_id=reference_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note,
    )
    return serialize_wallet(wallet, user_id)
def settle_booking_payment(
    db: Session,
    user_id: int,
    reserved_amount: float | Decimal,
    capture_amount: float | Decimal,
    reference_type: str,
    reference_id: int | None = None,
    note: str | None = None,
    actor_id: int | None = None,
    actor_role: str | None = None,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    reserve_amount = _normalize_amount(reserved_amount)
    capture_due = _normalize_amount(capture_amount)
    if reserve_amount < 0 or capture_due < 0:
        raise WalletError("Số tiền không hợp lệ")
    wallet = _lock_wallet(db, user_id)

    current_reserved = _normalize_amount(wallet.reserved_balance)
    current_balance = _normalize_amount(wallet.balance)

    if current_reserved < reserve_amount:
        raise WalletError("Số tiền đang giữ không khớp với booking")
    if current_balance < capture_due:
        raise InsufficientWalletBalance("Số dư ví không đủ để checkout")

    wallet.reserved_balance = _normalize_amount(current_reserved - reserve_amount)
    wallet.balance = _normalize_amount(current_balance - capture_due)
    _add_transaction(
        db,
        wallet,
        "settle",
        reserve_amount,
        reference_type,
        reference_id,
        source_type="wallet_settle",
        source_id=reference_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note or "Giải chấp tiền giữ chỗ khi checkout",
    )
    _add_transaction(
        db,
        wallet,
        "capture",
        capture_due,
        reference_type,
        reference_id,
        source_type="wallet_capture",
        source_id=reference_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note or "Trừ tiền còn lại khi checkout",
    )
    return serialize_wallet(wallet, user_id)


def refund_wallet_amount(
    db: Session,
    user_id: int,
    refund_amount: float | Decimal,
    reference_type: str,
    reference_id: int | None = None,
    note: str | None = None,
    actor_id: int | None = None,
    actor_role: str | None = None,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    refund = _normalize_amount(refund_amount)
    if refund <= 0:
        raise WalletError("Số tiền hoàn lại phải lớn hơn 0")
    wallet = _lock_wallet(db, user_id)
    wallet.balance = _normalize_amount(wallet.balance + refund)
    _add_transaction(
        db,
        wallet,
        "refund",
        refund,
        reference_type,
        reference_id,
        source_type="wallet_refund",
        source_id=reference_id,
        actor_id=actor_id,
        actor_role=actor_role,
        request_ip=request_ip,
        user_agent=user_agent,
        note=note or "Hoàn tiền",
    )
    return serialize_wallet(wallet, user_id)
