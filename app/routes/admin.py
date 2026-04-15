from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

from app.database import get_db
from app.models.models import Booking, ParkingLot, ParkingPrice, ParkingSlot, Payment, RevokedToken, User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_RUNTIME_SETTINGS = {
    "commissionRate": "10",
    "supportEmail": "admin@smartparking.vn",
    "maintenanceWindow": "Chủ nhật 23:00 - 01:00",
    "alertThreshold": "85",
}


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|banned)$")


class OwnerCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    parking_lot: str | None = Field(default=None, max_length=255)


class OwnerStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|suspended)$")


class ParkingLotCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=255)
    owner: str | None = Field(default=None, max_length=255)
    slot_count: int = Field(default=0, ge=0)
    status: str = Field(default="pending", pattern="^(pending|active|locked)$")


class ParkingLotUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, pattern="^(pending|active|locked)$")


class BookingStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(cancelled|confirmed|completed|checked_in|booked|pending)$")


class AdminSettingsUpdateRequest(BaseModel):
    commissionRate: str
    supportEmail: str
    maintenanceWindow: str
    alertThreshold: str


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ admin mới được truy cập")
    return current_user


def _to_status_label(user: User) -> str:
    if user.status and user.status.lower() == "banned":
        return "banned"
    return "active" if user.is_active == 1 else "banned"


def _lot_status(lot: ParkingLot) -> str:
    return "active" if lot.is_active == 1 else "locked"


def _format_day_label(value: datetime) -> str:
    return value.strftime("%d/%m")


def _format_month_label(value: datetime) -> str:
    return f"T{value.month}"


def _slot_counts_by_lot(slots: list[ParkingSlot]) -> dict[int, dict[str, int]]:
    counts: dict[int, dict[str, int]] = defaultdict(lambda: {"total": 0, "occupied": 0})
    for slot in slots:
        lot_id = int(slot.parking_id or 0)
        counts[lot_id]["total"] += 1
        if slot.status in {"reserved", "occupied"}:
            counts[lot_id]["occupied"] += 1
    return counts


def _build_revenue_series(payments: list[Payment], days: int = 7) -> tuple[list[dict], list[dict]]:
    today = datetime.utcnow().date()
    revenue = []
    commission = []
    commission_rate = float(ADMIN_RUNTIME_SETTINGS["commissionRate"]) / 100

    for offset in range(days - 1, -1, -1):
        current_day = today - timedelta(days=offset)
        day_payments = [
            payment for payment in payments
            if (payment.paid_at or payment.created_at) and (payment.paid_at or payment.created_at).date() == current_day
            and payment.payment_status == "paid"
        ]
        gross = round(sum(float(payment.amount or 0) + float(payment.overtime_fee or 0) for payment in day_payments), 2)
        revenue.append({"label": _format_day_label(datetime.combine(current_day, datetime.min.time())), "amount": gross})
        commission.append({"label": _format_day_label(datetime.combine(current_day, datetime.min.time())), "amount": round(gross * commission_rate, 2)})

    return revenue, commission


def _build_booking_series(bookings: list[Booking], days: int = 7) -> list[dict]:
    today = datetime.utcnow().date()
    result = []
    for offset in range(days - 1, -1, -1):
        current_day = today - timedelta(days=offset)
        count = sum(1 for booking in bookings if booking.created_at and booking.created_at.date() == current_day)
        result.append({"label": _format_day_label(datetime.combine(current_day, datetime.min.time())), "amount": count})
    return result


def _build_user_growth_series(bookings: list[Booking]) -> list[dict]:
    buckets: dict[tuple[int, int], set[int]] = defaultdict(set)
    for booking in bookings:
        if booking.created_at and booking.user_id:
            buckets[(booking.created_at.year, booking.created_at.month)].add(int(booking.user_id))

    series = []
    for key in sorted(buckets.keys())[-4:]:
        year, month = key
        series.append({"label": _format_month_label(datetime(year, month, 1)), "amount": len(buckets[key])})
    return series or [{"label": "T0", "amount": 0}]


def _build_activity_logs(bookings: list[Booking], users: list[User], parking_lots: list[ParkingLot]) -> list[dict]:
    logs = []
    for booking in sorted(bookings, key=lambda item: item.created_at or datetime.min, reverse=True)[:4]:
        logs.append({
            "id": f"booking-{booking.id}",
            "actor": booking.user.name if booking.user else "system",
            "action": f"Booking #{booking.id} được tạo",
            "time": booking.created_at.isoformat() if booking.created_at else datetime.utcnow().isoformat(),
            "type": "system",
        })

    for user in users:
        if _to_status_label(user) == "banned":
            logs.append({
                "id": f"user-{user.id}",
                "actor": "system",
                "action": f"Tài khoản {user.email} đang bị khóa",
                "time": datetime.utcnow().isoformat(),
                "type": "security",
            })

    for lot in parking_lots:
        if _lot_status(lot) == "locked":
            logs.append({
                "id": f"lot-{lot.id}",
                "actor": "system",
                "action": f"Bãi {lot.name} đang bị khóa",
                "time": datetime.utcnow().isoformat(),
                "type": "warning",
            })

    return logs[:6]


def _build_login_history(db: Session) -> list[dict]:
    revoked = db.query(RevokedToken).order_by(RevokedToken.expires_at.desc()).limit(5).all()
    return [
        {
            "id": f"token-{token.id}",
            "email": "admin-session",
            "ip": "Không lưu trong CSDL",
            "device": "Không lưu trong CSDL",
            "time": token.expires_at.isoformat(),
            "status": "blocked",
        }
        for token in revoked
    ]


def _serialize_bootstrap(db: Session) -> dict:
    users = db.query(User).all()
    parking_lots = db.query(ParkingLot).all()
    bookings = db.query(Booking).all()
    slots = db.query(ParkingSlot).all()
    payments = db.query(Payment).all()

    booking_counts_by_user: dict[int, int] = defaultdict(int)
    last_booking_by_user: dict[int, datetime] = {}
    for booking in bookings:
        if booking.user_id:
            booking_counts_by_user[int(booking.user_id)] += 1
            last_time = booking.created_at or booking.start_time
            if last_time and (
                int(booking.user_id) not in last_booking_by_user
                or last_time > last_booking_by_user[int(booking.user_id)]
            ):
                last_booking_by_user[int(booking.user_id)] = last_time

    slot_counts = _slot_counts_by_lot(slots)
    owners = [user for user in users if user.role == "owner"]

    user_rows = [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "status": _to_status_label(user),
            "bookingCount": booking_counts_by_user.get(int(user.id), 0),
            "lastActive": (last_booking_by_user.get(int(user.id)) or datetime.utcnow()).isoformat(),
            "phone": user.phone,
        }
        for user in users if user.role == "user"
    ]

    owner_rows = [
        {
            "id": owner.id,
            "name": owner.name,
            "email": owner.email,
            "parkingLot": "Chưa gán trong CSDL",
            "status": "active" if _to_status_label(owner) == "active" else "suspended",
            "performance": f"{booking_counts_by_user.get(int(owner.id), 0)} booking",
            "passwordHint": "Có thể reset từ admin",
        }
        for owner in owners
    ]

    parking_rows = []
    for lot in parking_lots:
        counts = slot_counts.get(int(lot.id), {"total": 0, "occupied": 0})
        total = counts["total"]
        occupied = counts["occupied"]
        occupancy = int(round((occupied / total) * 100)) if total > 0 else 0
        parking_rows.append({
            "id": lot.id,
            "name": lot.name,
            "address": lot.address,
            "owner": "Chưa gán trong CSDL",
            "slotCount": total,
            "status": _lot_status(lot),
            "occupancy": occupancy,
        })

    booking_rows = []
    for booking in bookings:
        user = booking.user
        lot = booking.parking_lot
        slot = booking.slot
        booking_rows.append({
            "id": f"BK-{booking.id}",
            "user": user.name if user else "Unknown user",
            "plate": user.vehicle_plate if user and user.vehicle_plate else "Chưa có biển số",
            "parkingLot": lot.name if lot else "Chưa có bãi",
            "checkIn": (booking.start_time or booking.created_at or datetime.utcnow()).isoformat(),
            "checkOut": (booking.expire_time or booking.created_at or datetime.utcnow()).isoformat(),
            "status": booking.status,
            "amount": float(booking.total_amount or 0),
            "anomaly": booking.total_amount is None or float(booking.total_amount or 0) <= 0 or slot is None,
        })

    transaction_rows = []
    commission_rate = float(ADMIN_RUNTIME_SETTINGS["commissionRate"]) / 100
    if payments:
        for payment in payments:
            booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
            user = booking.user if booking else None
            lot = booking.parking_lot if booking else None
            gross = float(payment.amount or 0) + float(payment.overtime_fee or 0)
            transaction_rows.append({
                "id": f"TX-{payment.id}",
                "bookingId": f"BK-{payment.booking_id}",
                "user": user.name if user else "Unknown user",
                "parkingLot": lot.name if lot else "Chưa có bãi",
                "time": (payment.paid_at or payment.created_at or datetime.utcnow()).isoformat(),
                "gross": gross,
                "commission": round(gross * commission_rate, 2),
                "ownerPayout": round(gross * (1 - commission_rate), 2),
                "status": payment.payment_status,
            })
    else:
        for booking in bookings:
            gross = float(booking.total_amount or 0)
            transaction_rows.append({
                "id": f"TX-BK-{booking.id}",
                "bookingId": f"BK-{booking.id}",
                "user": booking.user.name if booking.user else "Unknown user",
                "parkingLot": booking.parking_lot.name if booking.parking_lot else "Chưa có bãi",
                "time": (booking.created_at or datetime.utcnow()).isoformat(),
                "gross": gross,
                "commission": round(gross * commission_rate, 2),
                "ownerPayout": round(gross * (1 - commission_rate), 2),
                "status": "paid" if booking.status in {"booked", "checked_in", "completed"} else booking.status,
            })

    revenue_series, commission_series = _build_revenue_series(payments)
    return {
        "commissionRate": int(float(ADMIN_RUNTIME_SETTINGS["commissionRate"])),
        "users": user_rows,
        "owners": owner_rows,
        "parkingLots": parking_rows,
        "bookings": booking_rows,
        "transactions": transaction_rows,
        "systemRevenue": {
            "revenue": revenue_series,
            "commission": commission_series,
            "bookings": _build_booking_series(bookings),
            "userGrowth": _build_user_growth_series(bookings),
            "occupancy": [{"label": lot["name"], "amount": lot["occupancy"]} for lot in parking_rows[:6]],
        },
        "logs": _build_activity_logs(bookings, users, parking_lots),
        "loginHistory": _build_login_history(db),
        "settings": ADMIN_RUNTIME_SETTINGS,
    }


@router.get("/bootstrap")
def admin_bootstrap(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _serialize_bootstrap(db)


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    user.status = payload.status
    user.is_active = 1 if payload.status == "active" else 0
    db.commit()
    return {"message": "Cập nhật trạng thái user thành công"}


@router.post("/owners")
def create_owner(
    payload: OwnerCreateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email đã tồn tại")

    owner = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        role="owner",
        phone=None,
        vehicle_plate=None,
        status="active",
        is_active=1,
        password="123456",
        password_hash=generate_password_hash("123456"),
    )
    db.add(owner)
    db.commit()
    return {"message": "Tạo tài khoản owner thành công", "default_password": "123456"}


@router.patch("/owners/{owner_id}/status")
def update_owner_status(
    owner_id: int,
    payload: OwnerStatusUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    owner = db.query(User).filter(User.id == owner_id, User.role == "owner").first()
    if not owner:
        raise HTTPException(status_code=404, detail="Không tìm thấy owner")

    owner.status = "active" if payload.status == "active" else "banned"
    owner.is_active = 1 if payload.status == "active" else 0
    db.commit()
    return {"message": "Cập nhật trạng thái owner thành công"}


@router.post("/owners/{owner_id}/reset-password")
def reset_owner_password(
    owner_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    owner = db.query(User).filter(User.id == owner_id, User.role == "owner").first()
    if not owner:
        raise HTTPException(status_code=404, detail="Không tìm thấy owner")

    temp_password = "123456"
    owner.password = temp_password
    owner.password_hash = generate_password_hash(temp_password)
    db.commit()
    return {"message": "Đã reset mật khẩu owner", "temporary_password": temp_password}


@router.delete("/owners/{owner_id}")
def delete_owner(
    owner_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    owner = db.query(User).filter(User.id == owner_id, User.role == "owner").first()
    if not owner:
        raise HTTPException(status_code=404, detail="Không tìm thấy owner")

    db.delete(owner)
    db.commit()
    return {"message": "Đã xóa owner"}


@router.post("/parking-lots")
def create_parking_lot(
    payload: ParkingLotCreateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    lot = ParkingLot(
        name=payload.name.strip(),
        address=payload.address.strip(),
        latitude=10.0,
        longitude=106.0,
        has_roof=0,
        is_active=1 if payload.status == "active" else 0,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)

    price = ParkingPrice(
        parking_id=lot.id,
        price_per_hour=10000,
        price_per_day=70000,
        price_per_month=1500000,
    )
    db.add(price)
    db.commit()

    for index in range(1, payload.slot_count + 1):
        db.add(ParkingSlot(code=f"P{lot.id}-{index}", slot_number=str(index), parking_id=lot.id, status="available"))
    db.commit()
    return {"message": "Đã tạo bãi đỗ"}


@router.patch("/parking-lots/{lot_id}")
def update_parking_lot(
    lot_id: int,
    payload: ParkingLotUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Không tìm thấy bãi đỗ")

    if payload.name is not None:
        lot.name = payload.name.strip()
    if payload.address is not None:
        lot.address = payload.address.strip()
    if payload.status is not None:
        lot.is_active = 1 if payload.status == "active" else 0
    db.commit()
    return {"message": "Đã cập nhật bãi đỗ"}


@router.delete("/parking-lots/{lot_id}")
def delete_parking_lot(
    lot_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Không tìm thấy bãi đỗ")
    db.query(ParkingSlot).filter(ParkingSlot.parking_id == lot_id).delete()
    price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == lot_id).first()
    if price:
        db.delete(price)
    db.delete(lot)
    db.commit()
    return {"message": "Đã xóa bãi đỗ"}


@router.patch("/bookings/{booking_id}/status")
def update_booking_status(
    booking_id: int,
    payload: BookingStatusUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")

    booking.status = payload.status
    if payload.status == "cancelled" and booking.slot:
        booking.slot.status = "available"
    db.commit()
    return {"message": "Đã cập nhật booking"}


@router.patch("/settings")
def update_admin_settings(
    payload: AdminSettingsUpdateRequest,
    _: User = Depends(require_admin),
):
    ADMIN_RUNTIME_SETTINGS.update(payload.dict())
    return {"message": "Đã cập nhật cấu hình admin", "settings": ADMIN_RUNTIME_SETTINGS}
