from __future__ import annotations

from dataclasses import dataclass

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


def _normalize_amount(amount: float | int) -> float:
    return round(float(amount or 0), 2)


def serialize_wallet(wallet: Wallet | None, user_id: int) -> dict:
    return {
        "user_id": user_id,
        "balance": _normalize_amount(wallet.balance if wallet else 0),
        "reserved_balance": _normalize_amount(wallet.reserved_balance if wallet else 0),
    }


def get_wallet_summary(db: Session, user_id: int) -> dict:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    return serialize_wallet(wallet, user_id)


def _create_wallet(db: Session, user_id: int) -> Wallet:
    wallet = Wallet(user_id=user_id, balance=0, reserved_balance=0)
    db.add(wallet)
    try:
        db.flush()
        return wallet
    except IntegrityError:
        db.rollback()
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
        if wallet:
            return wallet
        raise


def _lock_wallet(db: Session, user_id: int) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
    if wallet:
        return wallet
    return _create_wallet(db, user_id)


def _add_transaction(
    db: Session,
    wallet: Wallet,
    transaction_type: str,
    amount: float,
    reference_type: str | None = None,
    reference_id: int | None = None,
    note: str | None = None,
) -> WalletTransaction:
    txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_type=transaction_type,
        amount=_normalize_amount(amount),
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
    )
    db.add(txn)
    return txn


def top_up_wallet(
    db: Session,
    user_id: int,
    amount: float,
    note: str | None = None,
) -> dict:
    topup_amount = _normalize_amount(amount)
    if topup_amount <= 0:
        raise WalletError("Số tiền nạp phải lớn hơn 0")

    wallet = _lock_wallet(db, user_id)
    wallet.balance = _normalize_amount(wallet.balance + topup_amount)
    _add_transaction(db, wallet, "topup", topup_amount, "wallet", user_id, note or "Nạp tiền mô phỏng")
    return serialize_wallet(wallet, user_id)


def reserve_wallet_amount(
    db: Session,
    user_id: int,
    amount: float,
    reference_type: str,
    reference_id: int | None = None,
    note: str | None = None,
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
    _add_transaction(db, wallet, "reserve", reserve_amount, reference_type, reference_id, note)
    return serialize_wallet(wallet, user_id)


def settle_booking_payment(
    db: Session,
    user_id: int,
    reserved_amount: float,
    capture_amount: float,
    reference_type: str,
    reference_id: int | None = None,
    note: str | None = None,
) -> dict:
    reserve_amount = _normalize_amount(reserved_amount)
    capture_due = _normalize_amount(capture_amount)
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
        note or "Giải chấp tiền giữ chỗ khi checkout",
    )
    _add_transaction(
        db,
        wallet,
        "capture",
        capture_due,
        reference_type,
        reference_id,
        note or "Trừ tiền còn lại khi checkout",
    )
    return serialize_wallet(wallet, user_id)
