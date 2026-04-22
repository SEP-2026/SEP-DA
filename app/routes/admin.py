from collections import defaultdict
from datetime import datetime, timedelta
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

from app.database import get_db
from app.models.models import Booking, OwnerParking, ParkingLot, ParkingPrice, ParkingSlot, Payment, RevokedToken, User
from app.routes.auth import get_current_user
from app.security.password_policy import ensure_strong_password
import unicodedata

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_RUNTIME_SETTINGS = {
    "commissionRate": "10",
    "supportEmail": "admin@smartparking.vn",
    "maintenanceWindow": "Chủ nhật 23:00 - 01:00",
    "alertThreshold": "85",
}


def _generate_strong_password(length: int = 12) -> str:
    if length < 8:
        length = 8

    lower = secrets.choice(string.ascii_lowercase)
    upper = secrets.choice(string.ascii_uppercase)
    digit = secrets.choice(string.digits)
    special = secrets.choice("@#$%!&*?-_")
    remaining_len = max(length - 4, 0)
    alphabet = string.ascii_letters + string.digits + "@#$%!&*?-_"
    remaining = "".join(secrets.choice(alphabet) for _ in range(remaining_len))

    chars = list(lower + upper + digit + special + remaining)
    secrets.SystemRandom().shuffle(chars)
    password = "".join(chars)
    ensure_strong_password(password)
    return password


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|banned)$")


class OwnerCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    parking_lot: str | None = Field(default=None, max_length=255, alias="parkingLot")
    status: str = Field(default="active", pattern="^(active|suspended)$")
    temporary_password: str | None = Field(default=None, min_length=6, max_length=255)

    class Config:
        allow_population_by_field_name = True


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
    owner: str | None = Field(default=None, max_length=255)
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


def _owner_parking_maps(db: Session) -> tuple[dict[int, ParkingLot], dict[int, User]]:
    # Use a join query to reliably collect parking lot names per owner.
    rows = (
        db.query(OwnerParking.owner_id, ParkingLot.id.label("parking_id"), ParkingLot.name)
        .join(ParkingLot, ParkingLot.id == OwnerParking.parking_id)
        .order_by(OwnerParking.id.asc())
        .all()
    )

    # owner -> list of parking lot dicts {id, name}
    lot_by_owner: dict[int, list[dict]] = {}
    owner_by_lot: dict[int, User] = {}
    owner_ids = set()
    for row in rows:
        owner_id = int(row.owner_id)
        owner_ids.add(owner_id)
        items = lot_by_owner.get(owner_id)
        if items:
            items.append({"id": int(row.parking_id), "name": row.name})
        else:
            lot_by_owner[owner_id] = [{"id": int(row.parking_id), "name": row.name}]
        owner_by_lot[int(row.parking_id)] = None  # placeholder, will be filled below

    # populate owner_by_lot mapping with User objects for the first owner per lot
    if owner_ids:
        owners = {int(u.id): u for u in db.query(User).filter(User.id.in_(list(owner_ids))).all()}
        for row in rows:
            pid = int(row.parking_id)
            oid = int(row.owner_id)
            if pid not in owner_by_lot or owner_by_lot[pid] is None:
                owner_by_lot[pid] = owners.get(oid)

    return lot_by_owner, owner_by_lot


def _find_parking_lot_by_reference(db: Session, reference: str | None) -> ParkingLot | None:
    if not reference:
        return None
    normalized = reference.strip()
    if not normalized:
        return None
    if normalized.isdigit():
        lot = db.query(ParkingLot).filter(ParkingLot.id == int(normalized)).first()
        if lot:
            return lot
    # try exact name match first
    lot = db.query(ParkingLot).filter(ParkingLot.name == normalized).first()
    if lot:
        return lot

    # case-insensitive contains
    lot = db.query(ParkingLot).filter(ParkingLot.name.ilike(f"%{normalized}%")).first()
    if lot:
        return lot

    # normalize accents and try contains match
    def _normalize_text(s: str) -> str:
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").casefold()

    try:
        target = _normalize_text(normalized)
        for lot in db.query(ParkingLot).all():
            if lot.name and target in _normalize_text(lot.name):
                return lot
    except Exception:
        pass

    return None


def _find_owner_by_reference(db: Session, reference: str | None) -> User | None:
    if not reference:
        return None
    normalized = reference.strip()
    if not normalized:
        return None
    if normalized.isdigit():
        owner = db.query(User).filter(User.id == int(normalized), User.role == "owner").first()
        if owner:
            return owner
    owner = db.query(User).filter(User.email == normalized.lower(), User.role == "owner").first()
    if owner:
        return owner
    return db.query(User).filter(User.name == normalized, User.role == "owner").first()


def _assign_owner_parking(db: Session, owner_id: int, parking_id: int) -> None:
    existing_owner = db.query(OwnerParking).filter(OwnerParking.owner_id == owner_id).first()
    if existing_owner and int(existing_owner.parking_id) != int(parking_id):
        raise HTTPException(status_code=409, detail="Owner đã được gán cho bãi khác")

    existing_lot = db.query(OwnerParking).filter(OwnerParking.parking_id == parking_id).first()
    if existing_lot and int(existing_lot.owner_id) != int(owner_id):
        raise HTTPException(status_code=409, detail="Bãi này đã có owner khác quản lý")

    if not existing_owner and not existing_lot:
        db.add(OwnerParking(owner_id=owner_id, parking_id=parking_id))


def _remove_owner_assignments(db: Session, owner_id: int) -> None:
    db.query(OwnerParking).filter(OwnerParking.owner_id == owner_id).delete()


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
    lot_by_owner, owner_by_lot = _owner_parking_maps(db)

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
            "parkingLots": lot_by_owner.get(int(owner.id)) if int(owner.id) in lot_by_owner and lot_by_owner.get(int(owner.id)) else [],
            # legacy single-string field for backward compatibility (first lot name or placeholder)
            "parkingLot": (lot_by_owner.get(int(owner.id))[0]["name"] if int(owner.id) in lot_by_owner and lot_by_owner.get(int(owner.id)) else "Chưa gán trong CSDL"),
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
            "owner": owner_by_lot[int(lot.id)].name if int(lot.id) in owner_by_lot else "Chưa gán trong CSDL",
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

    temporary_password = _generate_strong_password()

    owner = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        role="owner",
        phone=None,
        vehicle_plate=None,
        status="active",
        is_active=1,
        password="__legacy_disabled__",
        password_hash=generate_password_hash(temporary_password),
    )
    db.add(owner)
    db.flush()
    if payload.parking_lot:
        lot = _find_parking_lot_by_reference(db, payload.parking_lot)
        # nếu không tìm thấy bãi theo tham chiếu, thử tìm tên gần đúng (case-insensitive)
        if not lot:
            normalized = payload.parking_lot.strip()
            lot = db.query(ParkingLot).filter(ParkingLot.name.ilike(f"%{normalized}%")).first()
        # nếu vẫn không có, tạo bãi mới tự động để gán (hành vi trước đó)
        if not lot:
            lot = ParkingLot(
                name=payload.parking_lot.strip(),
                address=payload.parking_lot.strip(),
                latitude=10.0,
                longitude=106.0,
                has_roof=0,
                is_active=1,
            )
            db.add(lot)
            db.flush()
            price = ParkingPrice(
                parking_id=lot.id,
                price_per_hour=10000,
                price_per_day=70000,
                price_per_month=1500000,
            )
            db.add(price)
            # tạo 1 slot mặc định
            db.add(ParkingSlot(code=f"P{lot.id}-1", slot_number="1", parking_id=lot.id, status="available"))
        # Avoid raising conflict if lot is already assigned to another owner.
        existing_assignment = db.query(OwnerParking).filter(OwnerParking.parking_id == lot.id).first()
        if not existing_assignment:
            db.add(OwnerParking(owner_id=owner.id, parking_id=lot.id))
    db.commit()

    # build response owner info including assigned parking lots (if any)
    assigned = []
    rows = (
        db.query(OwnerParking.parking_id, ParkingLot.name)
        .join(ParkingLot, ParkingLot.id == OwnerParking.parking_id)
        .filter(OwnerParking.owner_id == owner.id)
        .all()
    )
    for r in rows:
        assigned.append({"id": int(r.parking_id), "name": r.name})

    owner_info = {
        "id": owner.id,
        "name": owner.name,
        "email": owner.email,
        "parkingLots": assigned,
        "parkingLot": assigned[0]["name"] if assigned else "Chưa gán trong CSDL",
        "status": "active",
        "performance": "0 booking",
        "passwordHint": "Có thể reset từ admin",
    }

    return {"message": "Tạo tài khoản owner thành công", "default_password": temporary_password, "owner": owner_info}


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

    temp_password = _generate_strong_password()
    owner.password = "__legacy_disabled__"
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

    _remove_owner_assignments(db, owner.id)
    db.delete(owner)
    db.commit()
    return {"message": "Đã xóa owner"}


@router.post("/parking-lots")
def create_parking_lot(
    payload: ParkingLotCreateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    owner = _find_owner_by_reference(db, payload.owner)
    if payload.owner and not owner:
        raise HTTPException(status_code=404, detail="Không tìm thấy owner")

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
    if owner:
        _assign_owner_parking(db, owner.id, lot.id)
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
    if payload.owner is not None:
        db.query(OwnerParking).filter(OwnerParking.parking_id == lot.id).delete()
        owner = _find_owner_by_reference(db, payload.owner)
        if payload.owner.strip():
            if not owner:
                raise HTTPException(status_code=404, detail="Không tìm thấy owner")
            _assign_owner_parking(db, owner.id, lot.id)
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
    db.query(OwnerParking).filter(OwnerParking.parking_id == lot_id).delete()
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


@router.post("/rebuild-owner-assignments")
def rebuild_owner_assignments(_ : User = Depends(require_admin), db: Session = Depends(get_db)):
    """Rebuild OwnerParking assignments from current `managed_district_id` on users.

    For owners with `managed_district_id` set, existing assignments for that owner
    will be removed and replaced by all active parking lots in that district.
    Owners without `managed_district_id` are left unchanged.
    """
    from app.models.models import OwnerParking, ParkingLot, User

    # clear all existing owner_parking rows first
    removed = db.query(OwnerParking).delete()

    # collect owners grouped by district
    districts = db.query(User.managed_district_id).filter(User.role == "owner", User.managed_district_id != None).distinct().all()
    created = 0
    for (district_id,) in districts:
        owners_in_district = db.query(User).filter(User.role == "owner", User.managed_district_id == district_id).order_by(User.id.asc()).all()
        if not owners_in_district:
            continue
        lots = db.query(ParkingLot).filter(ParkingLot.district_id == district_id, ParkingLot.is_active == 1).order_by(ParkingLot.id.asc()).all()
        if not lots:
            continue
        # distribute lots evenly among owners in that district (round-robin)
        for index, lot in enumerate(lots):
            owner = owners_in_district[index % len(owners_in_district)]
            db.add(OwnerParking(owner_id=owner.id, parking_id=lot.id))
            created += 1

    db.commit()
    return {"message": "Đã rebuild owner_parking assignments", "removed": removed, "created": created}


@router.get("/owner-assignments-debug")
def owner_assignments_debug(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Debug endpoint: return all owner_parking rows with owner and parking names."""
    rows = (
        db.query(OwnerParking.id.label("id"), OwnerParking.owner_id.label("owner_id"), User.name.label("owner_name"), OwnerParking.parking_id.label("parking_id"), ParkingLot.name.label("parking_name"))
        .join(User, User.id == OwnerParking.owner_id)
        .join(ParkingLot, ParkingLot.id == OwnerParking.parking_id)
        .order_by(OwnerParking.owner_id.asc(), OwnerParking.parking_id.asc())
        .all()
    )
    return [ {"id": int(r.id), "owner_id": int(r.owner_id), "owner_name": r.owner_name, "parking_id": int(r.parking_id), "parking_name": r.parking_name} for r in rows ]


@router.post("/auto-assign-owners")
def auto_assign_owners(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Auto-assign owners to parking lots using managed_district_id or heuristics from owner name.

    Behaviour:
    - Clear existing `owner_parking` rows.
    - For each owner:
      * If `managed_district_id` present -> assign all active lots in that district (round-robin among owners in that district).
      * Else try to extract district number from `name` (e.g. 'Quan 1', 'Quận 3', 'quận 7').
      * If district found -> assign active lots in that district to the owner.
    """
    # New behavior: assign parking lots exclusively per district.
    # For each district, find owner(s) that manage that district (by managed_district_id or name heuristic).
    # If exactly one owner found -> assign all active lots in that district to that owner.
    # If multiple owners found -> assign to the first and report potential conflicts.
    from app.models.models import OwnerParking, ParkingLot, User, District
    import re

    # Clear existing assignments first
    db.query(OwnerParking).delete()

    owners_all = db.query(User).filter(User.role == "owner").all()
    districts = db.query(District).order_by(District.id.asc()).all()

    assigned = 0
    conflicts: dict[int, list[int]] = {}
    unassigned: list[str] = []

    # index owners by managed_district_id
    owners_by_did: dict[int, list[User]] = {}
    for o in owners_all:
        if o.managed_district_id:
            owners_by_did.setdefault(int(o.managed_district_id), []).append(o)

    # For quick name heuristics, lowercase owner names
    owners_no_did = [o for o in owners_all if not o.managed_district_id]

    for d in districts:
        did = int(d.id)
        candidate_owners = owners_by_did.get(did, [])

        # if none by managed_district_id, try name heuristics
        if not candidate_owners:
            dname = (d.name or "").lower()
            for o in owners_no_did:
                on = (o.name or "").lower()
                # match 'quan X' or district name substring
                m = re.search(r"quan\s*(\d+)|quận\s*(\d+)", on)
                matched = False
                if m:
                    num = m.group(1) or m.group(2)
                    try:
                        if int(num) == did:
                            candidate_owners.append(o)
                            matched = True
                    except Exception:
                        pass
                if not matched and dname and dname in on:
                    candidate_owners.append(o)

        if not candidate_owners:
            unassigned.append(d.name or f"district_{did}")
            continue

        # If multiple owners, record conflict and pick first
        if len(candidate_owners) > 1:
            conflicts[did] = [int(o.id) for o in candidate_owners]

        owner = candidate_owners[0]
        lots = db.query(ParkingLot).filter(ParkingLot.district_id == did, ParkingLot.is_active == 1).all()
        for lot in lots:
            db.add(OwnerParking(owner_id=owner.id, parking_id=lot.id))
            assigned += 1

    db.commit()
    return {"message": "Auto-assign completed (exclusive per-district)", "assigned": assigned, "conflicts": conflicts, "unassigned_districts": unassigned}
