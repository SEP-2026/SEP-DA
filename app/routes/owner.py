from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

from app.database import get_db
from app.models.models import Booking, OwnerParking, ParkingLot, ParkingPrice, ParkingSlot, Payment, Review, User
from app.routes.auth import get_current_user
from app.security.password_policy import ensure_strong_password

router = APIRouter(prefix="/owner", tags=["owner"])
APP_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
UTC_TIMEZONE = ZoneInfo("UTC")


def _vn_now() -> datetime:
    return datetime.now(APP_TIMEZONE).replace(tzinfo=None)


def _to_vn_naive(value: datetime | None, fallback_now: bool = False) -> datetime | None:
    if value is None:
        return _vn_now() if fallback_now else None
    # Naive timestamps in this project are treated as Vietnam local time.
    if value.tzinfo is None:
        return value
    return value.astimezone(APP_TIMEZONE).replace(tzinfo=None)


def _to_vn_iso(value: datetime | None, fallback_now: bool = False) -> str | None:
    normalized = _to_vn_naive(value, fallback_now=fallback_now)
    return normalized.isoformat() if normalized else None


class OwnerSlotCreateRequest(BaseModel):
    parkingId: int
    code: str = Field(min_length=1, max_length=50)
    zone: str = Field(min_length=1, max_length=50)
    level: str = Field(min_length=1, max_length=50)
    status: str = Field(pattern="^(available|reserved|in_use|maintenance)$")


class OwnerSlotUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    zone: str | None = Field(default=None, min_length=1, max_length=50)
    level: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, pattern="^(available|reserved|in_use|maintenance)$")


class OwnerBookingStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(confirmed|cancelled|completed|in_progress|pending)$")


class OwnerAccountUpdateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str | None = Field(default=None, max_length=255)
    confirmPassword: str | None = Field(default=None, max_length=255)


class OwnerParkingSettingsUpdateRequest(BaseModel):
    contactPhone: str | None = Field(default=None, max_length=30)
    contactEmail: str | None = Field(default=None, max_length=255)


class OwnerManagedParkingSettingsUpdateRequest(BaseModel):
    parkingName: str | None = Field(default=None, max_length=255)
    pricePerHour: str | None = None
    pricePerDay: str | None = None
    pricePerMonth: str | None = None


class OwnerReviewReplyRequest(BaseModel):
    reply: str | None = Field(default=None, max_length=2000)


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ owner mới được truy cập")
    return current_user


def _get_primary_owner_parking(owner_id: int, db: Session) -> ParkingLot | None:
    assignment = (
        db.query(OwnerParking)
        .filter(OwnerParking.owner_id == owner_id)
        .order_by(OwnerParking.id.asc())
        .first()
    )
    if not assignment:
        return None
    return db.query(ParkingLot).filter(ParkingLot.id == assignment.parking_id).first()


def _get_owner_parking_lots(owner_id: int, db: Session) -> list[ParkingLot]:
    assignments = (
        db.query(OwnerParking)
        .filter(OwnerParking.owner_id == owner_id)
        .order_by(OwnerParking.id.asc())
        .all()
    )
    parking_ids = [assignment.parking_id for assignment in assignments]
    if not parking_ids:
        return []
    return (
        db.query(ParkingLot)
        .filter(ParkingLot.id.in_(parking_ids), ParkingLot.is_active == 1)
        .order_by(ParkingLot.id.asc())
        .all()
    )


def _get_owner_parking_assignment(owner_id: int, parking_id: int | None, db: Session) -> OwnerParking | None:
    if parking_id is None:
        return None
    return (
        db.query(OwnerParking)
        .filter(
            OwnerParking.owner_id == owner_id,
            OwnerParking.parking_id == parking_id,
        )
        .first()
    )


def _normalize_slot_status(value: str | None) -> str:
    mapping = {
        "available": "available",
        "reserved": "occupied",
        "in_use": "occupied",
        "maintenance": "maintenance",
        "occupied": "occupied",
    }
    return mapping.get((value or "").lower(), "available")


def _owner_slot_status(raw_status: str | None, booking_statuses: set[str]) -> str:
    normalized = (raw_status or "").lower()
    if normalized == "maintenance":
        return "maintenance"
    if "checked_in" in booking_statuses:
        return "in_use"
    if booking_statuses.intersection({"pending", "booked"}):
        return "reserved"
    return "available"


def _overview_slot_status(raw_status: str | None, booking_statuses: set[str]) -> str:
    normalized = (raw_status or "").lower()
    if normalized == "maintenance":
        return "maintenance"
    if booking_statuses.intersection({"pending", "booked", "checked_in"}):
        return "occupied"
    if normalized in {"reserved", "occupied", "in_use"}:
        return "occupied"
    return "available"


def _owner_booking_status(value: str | None) -> str:
    mapping = {
        "pending": "pending",
        "booked": "confirmed",
        "checked_in": "in_progress",
        "completed": "completed",
        "cancelled": "cancelled",
    }
    return mapping.get((value or "").lower(), "pending")


def _db_booking_status(value: str) -> str:
    mapping = {
        "pending": "pending",
        "confirmed": "booked",
        "in_progress": "checked_in",
        "completed": "completed",
        "cancelled": "cancelled",
    }
    return mapping[value]


def _slot_layout_meta(slot: ParkingSlot) -> dict:
    return {
        "zone": slot.zone or "Chưa phân khu",
        "level": slot.level or "Chưa gán tầng",
        "type": slot.slot_type or None,
        "updatedAt": _to_vn_iso(slot.updated_at or slot.created_at, fallback_now=True),
    }


def _display_slot_code(slot: ParkingSlot) -> str:
    slot_number = (slot.slot_number or "").strip()
    code = (slot.code or "").strip()
    if slot_number and code == f"{slot.parking_id}-{slot_number}":
        return slot_number
    if code:
        return code
    if slot_number:
        return slot_number
    return f"Slot-{slot.id}"


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return _to_vn_naive(parsed)
    except ValueError:
        return None


def _serialize_slots_overview(parking_lots: list[ParkingLot], db: Session) -> list[dict]:
    parking_ids = [lot.id for lot in parking_lots]
    if not parking_ids:
      return []

    slot_rows = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.parking_id.in_(parking_ids))
        .order_by(ParkingSlot.parking_id.asc(), ParkingSlot.slot_number.asc(), ParkingSlot.code.asc())
        .all()
    )

    slots_by_parking: dict[int, list[ParkingSlot]] = defaultdict(list)
    for slot in slot_rows:
        if slot.parking_id is None:
            continue
        slots_by_parking[int(slot.parking_id)].append(slot)

    active_bookings = (
        db.query(Booking)
        .filter(
            Booking.parking_id.in_(parking_ids),
            Booking.status.in_(["pending", "booked", "checked_in"]),
        )
        .all()
    )
    booking_statuses_by_slot: dict[int, set[str]] = defaultdict(set)
    for booking in active_bookings:
        if booking.slot_id:
            booking_statuses_by_slot[int(booking.slot_id)].add((booking.status or "").lower())

    result = []
    for lot in parking_lots:
        lot_slots = slots_by_parking.get(int(lot.id), [])
        effective_slots = [
            {
                "id": slot.id,
                "code": _display_slot_code(slot),
                "status": _overview_slot_status(slot.status, booking_statuses_by_slot.get(int(slot.id), set())),
            }
            for slot in lot_slots
        ]
        available_count = sum(1 for slot in effective_slots if slot["status"] == "available")
        occupied_count = len(lot_slots) - available_count
        result.append({
            "parking_id": lot.id,
            "parking_name": lot.name,
            "parking_address": lot.address,
            "district": lot.district.name if lot.district else None,
            "available_slots": available_count,
            "occupied_or_reserved_slots": occupied_count,
            "total_slots": len(lot_slots),
            "slots": effective_slots,
        })

    return result


def _serialize_owner_bootstrap(current_user: User, parking_lots: list[ParkingLot], db: Session) -> dict:
    if not parking_lots:
        return {
            "parkingLot": None,
            "parkingLots": [],
            "slots": [],
            "bookings": [],
            "transactions": [],
            "activities": [],
            "settings": None,
            "reviews": [],
        }

    primary_parking_lot = parking_lots[0]
    parking_ids = [lot.id for lot in parking_lots]
    parking_by_id = {int(lot.id): lot for lot in parking_lots}

    slots = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.parking_id.in_(parking_ids))
        .order_by(ParkingSlot.parking_id.asc(), ParkingSlot.id.asc())
        .all()
    )
    bookings = (
        db.query(Booking)
        .filter(Booking.parking_id.in_(parking_ids))
        .order_by(Booking.id.desc())
        .all()
    )
    payments = (
        db.query(Payment)
        .join(Booking, Booking.id == Payment.booking_id)
        .filter(Booking.parking_id.in_(parking_ids))
        .all()
    )
    prices = db.query(ParkingPrice).filter(ParkingPrice.parking_id.in_(parking_ids)).all()
    reviews = (
        db.query(Review)
        .filter(Review.parking_id.in_(parking_ids))
        .order_by(Review.created_at.desc())
        .all()
    )
    prices_by_parking_id = {int(price.parking_id): price for price in prices}
    slot_count_by_parking_id: dict[int, int] = defaultdict(int)
    for slot in slots:
        if slot.parking_id:
            slot_count_by_parking_id[int(slot.parking_id)] += 1

    booking_statuses_by_slot: dict[int, set[str]] = defaultdict(set)
    for booking in bookings:
        if booking.slot_id:
            booking_statuses_by_slot[int(booking.slot_id)].add((booking.status or "").lower())

    slot_rows = []
    for slot in slots:
        layout_meta = _slot_layout_meta(slot)
        slot_rows.append({
            "id": slot.id,
            "code": _display_slot_code(slot),
            "parkingLotId": slot.parking_id,
            "parkingLotName": parking_by_id.get(int(slot.parking_id)).name if slot.parking_id and parking_by_id.get(int(slot.parking_id)) else "Chưa có bãi",
            "zone": layout_meta["zone"],
            "level": layout_meta["level"],
            "status": _owner_slot_status(slot.status, booking_statuses_by_slot.get(int(slot.id), set())),
            "type": layout_meta["type"],
            "updatedAt": layout_meta["updatedAt"],
        })

    booking_rows = []
    for booking in bookings:
        user = booking.user
        slot = booking.slot
        zone = "Chưa phân khu"
        if slot:
            matching_slot = next((item for item in slot_rows if int(item["id"]) == int(slot.id)), None)
            if matching_slot:
                zone = matching_slot["zone"]
        booking_rows.append({
            "id": booking.id,
            "code": f"BK-{booking.id}",
            "parkingLotName": parking_by_id.get(int(booking.parking_id)).name if booking.parking_id and parking_by_id.get(int(booking.parking_id)) else "Chưa có bãi",
            "user": user.name if user else "Unknown user",
            "plate": user.vehicle_plate if user and user.vehicle_plate else "Chưa có biển số",
            "slotCode": _display_slot_code(slot) if slot else "Chưa có",
            "zone": zone,
            "startTime": _to_vn_iso(booking.actual_checkin),
            "endTime": _to_vn_iso(booking.actual_checkout),
            "bookingStartTime": _to_vn_iso(booking.start_time or booking.created_at, fallback_now=True),
            "bookingEndTime": _to_vn_iso(booking.expire_time or booking.created_at, fallback_now=True),
            "price": float(booking.total_amount or 0),
            "status": _owner_booking_status(booking.status),
            "phone": user.phone if user and user.phone else "Chưa có",
        })

    payments_by_booking_id = {int(payment.booking_id): payment for payment in payments}
    transaction_rows = []
    for booking in bookings:
        payment = payments_by_booking_id.get(int(booking.id))
        overtime_fee = float(payment.overtime_fee or 0) if payment else 0
        transaction_rows.append({
            "id": f"TX-{payment.id}" if payment else f"TX-BK-{booking.id}",
            "bookingCode": f"BK-{booking.id}",
            "parkingLotName": parking_by_id.get(int(booking.parking_id)).name if booking.parking_id and parking_by_id.get(int(booking.parking_id)) else "Chưa có bãi",
            "method": (payment.payment_method or "N/A").upper() if payment else "N/A",
            "payer": booking.user.name if booking.user else "Unknown user",
            "time": _to_vn_iso(payment.paid_at or payment.created_at or booking.created_at, fallback_now=True) if payment else _to_vn_iso(booking.created_at, fallback_now=True),
            "amount": float((payment.amount if payment else booking.total_amount) or 0) + overtime_fee,
            "status": payment.payment_status if payment else "pending",
        })

    review_rows = [
        {
            "id": review.id,
            "parkingLotName": parking_by_id.get(int(review.parking_id)).name if review.parking_id and parking_by_id.get(int(review.parking_id)) else "Chưa có bãi",
            "user": review.user.name if review.user else f"User #{review.user_id}",
            "rating": review.rating,
            "createdAt": _to_vn_iso(review.created_at, fallback_now=True),
            "content": review.comment or "",
            "reply": review.owner_reply or "",
            "replyUpdatedAt": _to_vn_iso(review.owner_replied_at),
        }
        for review in reviews
    ]

    activity_rows = []
    for booking in bookings:
        activity_rows.append(
            {
                "id": f"booking-{booking.id}",
                "title": f"Booking BK-{booking.id} tại {parking_by_id.get(int(booking.parking_id)).name if booking.parking_id and parking_by_id.get(int(booking.parking_id)) else 'bãi đỗ'}",
                "time": _to_vn_iso(booking.created_at, fallback_now=True),
                "type": "booking",
            }
        )
    for payment in payments:
        booking = next((item for item in bookings if int(item.id) == int(payment.booking_id)), None)
        activity_rows.append(
            {
                "id": f"payment-{payment.id}",
                "title": f"Thanh toán {int(float((payment.amount or 0) + (payment.overtime_fee or 0)))} VND cho BK-{payment.booking_id}",
                "time": _to_vn_iso(payment.paid_at or payment.created_at, fallback_now=True),
                "type": "success" if payment.payment_status == "paid" else "warning",
            }
        )
    for review in reviews:
        activity_rows.append(
            {
                "id": f"review-{review.id}",
                "title": f"Đánh giá {review.rating}/5 cho {parking_by_id.get(int(review.parking_id)).name if review.parking_id and parking_by_id.get(int(review.parking_id)) else 'bãi đỗ'}",
                "time": _to_vn_iso(review.created_at, fallback_now=True),
                "type": "warning",
            }
        )
    activities = sorted(activity_rows, key=lambda item: item["time"], reverse=True)[:8]

    return {
        "parkingLot": {
            "id": primary_parking_lot.id,
            "name": primary_parking_lot.name,
            "address": primary_parking_lot.address,
        },
        "parkingLots": [
            {
                "id": lot.id,
                "name": lot.name,
                "address": lot.address,
                "district": lot.district.name if lot.district else None,
            }
            for lot in parking_lots
        ],
        "slots": slot_rows,
        "bookings": booking_rows,
        "transactions": transaction_rows,
        "activities": activities,
        "settings": {
            "parkingName": primary_parking_lot.name,
            "managedParkingCount": str(len(parking_lots)),
            "slotCapacity": str(len(slot_rows)),
            "totalSlotCapacity": str(len(slot_rows)),
            "districtName": current_user.managed_district.name if current_user.managed_district else "",
            "pricePerHour": str(int(float(prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_hour))) if prices_by_parking_id.get(int(primary_parking_lot.id)) and prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_hour is not None else "0",
            "pricePerDay": str(int(float(prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_day))) if prices_by_parking_id.get(int(primary_parking_lot.id)) and prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_day is not None else "0",
            "pricePerMonth": str(int(float(prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_month))) if prices_by_parking_id.get(int(primary_parking_lot.id)) and prices_by_parking_id.get(int(primary_parking_lot.id)).price_per_month is not None else "0",
            "contactName": current_user.name,
            "contactPhone": current_user.phone or "",
            "contactEmail": current_user.email,
            "parkingLots": [
                {
                    "id": lot.id,
                    "name": lot.name,
                    "address": lot.address,
                    "district": lot.district.name if lot.district else None,
                    "slotCapacity": slot_count_by_parking_id.get(int(lot.id), 0),
                    "pricePerHour": str(int(float(prices_by_parking_id.get(int(lot.id)).price_per_hour))) if prices_by_parking_id.get(int(lot.id)) and prices_by_parking_id.get(int(lot.id)).price_per_hour is not None else "0",
                    "pricePerDay": str(int(float(prices_by_parking_id.get(int(lot.id)).price_per_day))) if prices_by_parking_id.get(int(lot.id)) and prices_by_parking_id.get(int(lot.id)).price_per_day is not None else "0",
                    "pricePerMonth": str(int(float(prices_by_parking_id.get(int(lot.id)).price_per_month))) if prices_by_parking_id.get(int(lot.id)) and prices_by_parking_id.get(int(lot.id)).price_per_month is not None else "0",
                }
                for lot in parking_lots
            ],
        },
        "reviews": review_rows,
    }


def _serialize_owner_overview(current_user: User, parking_lots: list[ParkingLot], db: Session) -> dict:
    bootstrap = _serialize_owner_bootstrap(current_user, parking_lots, db)
    bookings = bootstrap["bookings"]
    transactions = bootstrap["transactions"]
    today = datetime.now(APP_TIMEZONE).date()

    def _same_day(value: str | None) -> bool:
        parsed = _parse_iso_datetime(value)
        if parsed is None:
            return False
        return parsed.date() == today

    return {
        "stats": {
            "totalSlots": len(bootstrap["slots"]),
            "availableSlots": sum(1 for slot in bootstrap["slots"] if slot["status"] == "available"),
            "usedSlots": sum(1 for slot in bootstrap["slots"] if slot["status"] in {"reserved", "in_use"}),
            "todayRevenue": sum(item["amount"] for item in transactions if item["status"] == "paid" and _same_day(item["time"])),
            "todayBookings": sum(1 for item in bookings if _same_day(item["startTime"])),
            "managedParkingCount": len(bootstrap["parkingLots"]),
        },
        "vehiclesInLot": [item for item in bookings if item["status"] in {"confirmed", "in_progress"}],
        "todayBookings": [item for item in bookings if _same_day(item["startTime"])],
        "transactions": transactions,
        "activities": bootstrap["activities"],
    }


@router.get("/customers")
def get_owner_customers(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    parking_ids = [lot.id for lot in parking_lots]
    if not parking_ids:
        return {"customers": []}

    bookings = (
        db.query(Booking)
        .filter(Booking.parking_id.in_(parking_ids))
        .order_by(Booking.id.desc())
        .all()
    )
    booking_ids = [booking.id for booking in bookings]
    payments_by_booking_id = {}
    if booking_ids:
        payments = db.query(Payment).filter(Payment.booking_id.in_(booking_ids)).all()
        payments_by_booking_id = {int(payment.booking_id): payment for payment in payments}

    customer_map: dict[int, dict] = {}
    for booking in bookings:
        if booking.user is None:
            continue
        user_id = int(booking.user.id)
        vehicle_profile = booking.user.vehicle_profile
        customer = customer_map.setdefault(
            user_id,
            {
                "id": booking.user.id,
                "name": booking.user.name,
                "phone": booking.user.phone or "",
                "vehicles": [],
                "bookings": [],
                "transactions": [],
                "total_spent": 0,
                "paid_amount": 0,
                "pending_amount": 0,
            },
        )

        booking_amount = float(booking.total_amount or 0)
        customer["total_spent"] += booking_amount
        customer["bookings"].append(
            {
                "id": booking.id,
                "code": f"BK-{booking.id}",
                "plate": booking.user.vehicle_plate or (vehicle_profile.license_plate if vehicle_profile and vehicle_profile.license_plate else "Chưa có biển số"),
                "start_time": _to_vn_iso(booking.start_time or booking.created_at, fallback_now=True),
                "end_time": _to_vn_iso(booking.expire_time or booking.created_at, fallback_now=True),
                "price": booking_amount,
                "status": _owner_booking_status(booking.status),
                "parking_lot_name": booking.parking_lot.name if booking.parking_lot else "Chưa có bãi",
            }
        )

        payment = payments_by_booking_id.get(int(booking.id))
        if payment:
            amount = float(payment.amount or 0) + float(payment.overtime_fee or 0)
            customer["transactions"].append(
                {
                    "id": f"TX-{payment.id}",
                    "booking_code": f"BK-{booking.id}",
                    "method": (payment.payment_method or "N/A").upper(),
                    "amount": amount,
                    "time": _to_vn_iso(payment.paid_at or payment.created_at, fallback_now=True),
                    "status": payment.payment_status,
                }
            )
            if payment.payment_status == "paid":
                customer["paid_amount"] += amount
            else:
                customer["pending_amount"] += amount
        elif booking_amount > 0 and (booking.status or "").lower() not in {"cancelled"}:
            customer["pending_amount"] += booking_amount

    for customer in customer_map.values():
        vehicles = []
        user = db.query(User).filter(User.id == customer["id"]).first()
        if user:
            profile = user.vehicle_profile
            if profile and profile.license_plate:
                vehicles.append(
                    {
                        "plate": profile.license_plate,
                        "type": profile.brand or profile.vehicle_model or "Chưa cập nhật",
                        "firstUsed": customer["bookings"][-1]["start_time"] if customer["bookings"] else None,
                    }
                )
            elif user.vehicle_plate:
                vehicles.append(
                    {
                        "plate": user.vehicle_plate,
                        "type": "Chưa cập nhật",
                        "firstUsed": customer["bookings"][-1]["start_time"] if customer["bookings"] else None,
                    }
                )
        customer["vehicles"] = vehicles

    customers = sorted(customer_map.values(), key=lambda item: (item["total_spent"], len(item["bookings"])), reverse=True)
    return {"customers": customers}


@router.get("/bootstrap")
def owner_bootstrap(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    return _serialize_owner_bootstrap(current_user, parking_lots, db)


@router.get("/overview")
def owner_overview(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    return _serialize_owner_overview(current_user, parking_lots, db)


@router.get("/revenue")
def owner_revenue(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    bootstrap = _serialize_owner_bootstrap(current_user, parking_lots, db)
    return {
        "transactions": bootstrap["transactions"],
        "parkingLots": bootstrap["parkingLots"],
    }


@router.get("/reviews")
def owner_reviews(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    bootstrap = _serialize_owner_bootstrap(current_user, parking_lots, db)
    return {"reviews": bootstrap["reviews"]}


@router.get("/settings")
def owner_settings(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    bootstrap = _serialize_owner_bootstrap(current_user, parking_lots, db)
    return {"settings": bootstrap["settings"]}


@router.get("/parking-lots/slots-overview")
def get_owner_parking_lots_slots_overview(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lots = _get_owner_parking_lots(current_user.id, db)
    return _serialize_slots_overview(parking_lots, db)


@router.get("/slots/{slot_id}/detail")
def get_owner_slot_detail(
    slot_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")

    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == slot.parking_id).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Không tìm thấy bãi đỗ")

    owner_assignment = _get_owner_parking_assignment(current_user.id, parking_lot.id, db)
    has_owner_detail = owner_assignment is not None

    active_bookings = (
        db.query(Booking)
        .filter(
            Booking.slot_id == slot.id,
            Booking.status.in_(["pending", "booked", "checked_in"]),
        )
        .order_by(Booking.id.desc())
        .all()
    )
    booking_statuses = {(item.status or "").lower() for item in active_bookings}
    active_booking = active_bookings[0] if active_bookings else None
    user = active_booking.user if active_booking else None
    payment = db.query(Payment).filter(Payment.booking_id == active_booking.id).first() if active_booking else None
    layout_meta = _slot_layout_meta(slot)
    effective_status = _owner_slot_status(slot.status, booking_statuses)

    return {
        "parking": {
            "id": parking_lot.id,
            "name": parking_lot.name,
            "address": parking_lot.address,
            "district": parking_lot.district.name if parking_lot.district else None,
        },
        "slot": {
            "id": slot.id,
            "code": _display_slot_code(slot),
            "status": effective_status,
            "rawStatus": slot.status,
            **layout_meta,
        },
        "access": {
            "has_owner_detail": has_owner_detail,
            "owner_parking_id": owner_assignment.parking_id if owner_assignment else None,
        },
        "booking": (
            {
                "id": active_booking.id,
                "code": f"BK-{active_booking.id}",
                "status": _owner_booking_status(active_booking.status),
                "startTime": _to_vn_iso(active_booking.start_time or active_booking.created_at, fallback_now=True),
                "endTime": _to_vn_iso(active_booking.expire_time or active_booking.created_at, fallback_now=True),
                "price": float(active_booking.total_amount or 0),
                "user": user.name if user else "Unknown user",
                "plate": user.vehicle_plate if user and user.vehicle_plate else "Chưa có biển số",
                "phone": user.phone if user and user.phone else "Chưa có",
                "paymentStatus": payment.payment_status if payment else None,
            }
            if has_owner_detail and active_booking
            else None
        ),
    }


@router.post("/slots")
def create_owner_slot(
    payload: OwnerSlotCreateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == payload.parkingId, ParkingLot.is_active == 1).first()
    if not parking_lot or _get_owner_parking_assignment(current_user.id, parking_lot.id, db) is None:
        raise HTTPException(status_code=404, detail="Owner không có quyền thêm chỗ đỗ tại bãi này")

    code = payload.code.strip()
    existing = db.query(ParkingSlot).filter(ParkingSlot.code == code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại")
    duplicate_slot_number = (
        db.query(ParkingSlot)
        .filter(
            ParkingSlot.parking_id == parking_lot.id,
            ParkingSlot.slot_number == code,
        )
        .first()
    )
    if duplicate_slot_number:
        raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại trong bãi")

    slot = ParkingSlot(
        parking_id=parking_lot.id,
        slot_number=code,
        slot_type="normal",
        zone=payload.zone.strip(),
        level=payload.level.strip(),
        code=code,
        status=_normalize_slot_status(payload.status),
    )
    db.add(slot)
    db.commit()
    return {"message": "Đã thêm chỗ đỗ"}


@router.patch("/slots/{slot_id}")
def update_owner_slot(
    slot_id: int,
    payload: OwnerSlotUpdateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot or slot.parking_id is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == slot.parking_id, ParkingLot.is_active == 1).first()
    if not parking_lot or _get_owner_parking_assignment(current_user.id, parking_lot.id, db) is None:
        raise HTTPException(status_code=404, detail="Owner không có quyền cập nhật chỗ đỗ tại bãi này")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id, ParkingSlot.parking_id == parking_lot.id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")

    if payload.code is not None:
        normalized_code = payload.code.strip()
        duplicate = db.query(ParkingSlot).filter(ParkingSlot.code == normalized_code, ParkingSlot.id != slot.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại")
        duplicate_slot_number = (
            db.query(ParkingSlot)
            .filter(
                ParkingSlot.parking_id == parking_lot.id,
                ParkingSlot.slot_number == normalized_code,
                ParkingSlot.id != slot.id,
            )
            .first()
        )
        if duplicate_slot_number:
            raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại trong bãi")
        slot.code = normalized_code
        slot.slot_number = normalized_code
    if payload.zone is not None:
        slot.zone = payload.zone.strip()
    if payload.level is not None:
        slot.level = payload.level.strip()
    if payload.status is not None:
        slot.status = _normalize_slot_status(payload.status)

    db.commit()
    return {"message": "Đã cập nhật chỗ đỗ"}


@router.delete("/slots/{slot_id}")
def delete_owner_slot(
    slot_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot or slot.parking_id is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == slot.parking_id, ParkingLot.is_active == 1).first()
    if not parking_lot or _get_owner_parking_assignment(current_user.id, parking_lot.id, db) is None:
        raise HTTPException(status_code=404, detail="Owner không có quyền xóa chỗ đỗ tại bãi này")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id, ParkingSlot.parking_id == parking_lot.id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")

    active_booking = (
        db.query(Booking)
        .filter(Booking.slot_id == slot.id, Booking.status.in_(["pending", "booked", "checked_in"]))
        .first()
    )
    if active_booking:
        raise HTTPException(status_code=409, detail="Chỗ đỗ đang có booking hoạt động, không thể xóa")

    db.delete(slot)
    db.commit()
    return {"message": "Đã xóa chỗ đỗ"}


@router.patch("/bookings/{booking_id}/status")
def update_owner_booking_status(
    booking_id: int,
    payload: OwnerBookingStatusUpdateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")
    if _get_owner_parking_assignment(current_user.id, booking.parking_id, db) is None:
        raise HTTPException(status_code=404, detail="Owner không có quyền cập nhật booking này")

    booking.status = _db_booking_status(payload.status)
    if payload.status == "cancelled" and booking.slot:
        booking.slot.status = "available"
    elif payload.status == "confirmed" and booking.slot:
        booking.slot.status = "reserved"
    elif payload.status == "in_progress" and booking.slot:
        booking.slot.status = "occupied"
    elif payload.status == "completed" and booking.slot:
        booking.slot.status = "available"
    db.commit()
    return {"message": "Đã cập nhật booking"}


@router.patch("/account")
def update_owner_account(
    payload: OwnerAccountUpdateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.lower().strip()
    duplicate = db.query(User).filter(User.email == normalized_email, User.id != current_user.id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Email đã được sử dụng")

    if payload.password or payload.confirmPassword:
        if not payload.password or payload.password != payload.confirmPassword:
            raise HTTPException(status_code=400, detail="Mật khẩu xác nhận không khớp")
        ensure_strong_password(payload.password)
        current_user.password = "__legacy_disabled__"
        current_user.password_hash = generate_password_hash(payload.password)

    current_user.email = normalized_email
    db.commit()
    return {
        "message": "Đã cập nhật tài khoản owner",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "name": current_user.name,
        },
    }


@router.patch("/settings")
def update_owner_settings(
    payload: OwnerParkingSettingsUpdateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    if payload.contactPhone is not None:
        current_user.phone = payload.contactPhone.strip()
    if payload.contactEmail is not None and payload.contactEmail.strip():
        duplicate = db.query(User).filter(User.email == payload.contactEmail.lower().strip(), User.id != current_user.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Email liên hệ đã được sử dụng")
        current_user.email = payload.contactEmail.lower().strip()

    db.commit()
    return {"message": "Đã cập nhật thông tin owner"}


@router.patch("/parking-lots/{parking_id}/settings")
def update_owner_managed_parking_settings(
    parking_id: int,
    payload: OwnerManagedParkingSettingsUpdateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == parking_id, ParkingLot.is_active == 1).first()
    if not parking_lot or _get_owner_parking_assignment(current_user.id, parking_lot.id, db) is None:
        raise HTTPException(status_code=404, detail="Owner không có quyền cập nhật bãi này")

    if payload.parkingName is not None and payload.parkingName.strip():
        parking_lot.name = payload.parkingName.strip()

    price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == parking_lot.id).first()
    if not price:
        price = ParkingPrice(parking_id=parking_lot.id, price_per_hour=0, price_per_day=0, price_per_month=0)
        db.add(price)

    if payload.pricePerHour is not None:
        price.price_per_hour = float(payload.pricePerHour or 0)
    if payload.pricePerDay is not None:
        price.price_per_day = float(payload.pricePerDay or 0)
    if payload.pricePerMonth is not None:
        price.price_per_month = float(payload.pricePerMonth or 0)

    db.commit()
    return {"message": "Đã cập nhật cấu hình bãi"}


@router.post("/seed-test-data-public")
def seed_test_data_public(db: Session = Depends(get_db)):
    """Tạo dữ liệu test (public endpoint - không cần xác thực)"""
    from datetime import timedelta
    
    try:
        # 1. Lấy owner first (hoặc tạo nếu chưa có)
        owner = db.query(User).filter(User.email == "owner1@gmail.com").first()
        if not owner:
            owner = User(
                name="Owner One",
                email="owner1@gmail.com",
                phone="0901111111",
                role="owner",
                status="active",
                is_active=1,
                password_hash=""
            )
            db.add(owner)
            db.commit()
        
        # 2. Tạo parking lot nếu chưa tồn tại
        parking_lot = db.query(ParkingLot).filter(
            ParkingLot.name == "Smart Parking - Tân Phú"
        ).first()
        
        if not parking_lot:
            parking_lot = ParkingLot(
                name="Smart Parking - Tân Phú",
                address="123 Đường Tân Phú, Quận 5, TP.HCM",
                latitude=10.7910,
                longitude=106.6255,
                has_roof=1,
                is_active=1
            )
            db.add(parking_lot)
            db.commit()
        
        # 3. Gán bãi cho owner nếu chưa tồn tại
        owner_parking = db.query(OwnerParking).filter(
            OwnerParking.owner_id == owner.id,
            OwnerParking.parking_id == parking_lot.id
        ).first()
        
        if not owner_parking:
            owner_parking = OwnerParking(
                owner_id=owner.id,
                parking_id=parking_lot.id
            )
            db.add(owner_parking)
            db.commit()
        
        # 4. Tạo parking slots
        slot_codes = ["A-01", "A-02", "B-01", "B-02", "C-01"]
        for code in slot_codes:
            existing = db.query(ParkingSlot).filter(
                ParkingSlot.code == code
            ).first()
            if not existing:
                slot = ParkingSlot(
                    parking_id=parking_lot.id,
                    code=code,
                    status="available"
                )
                db.add(slot)
        db.commit()
        
        # 5. Tạo test users (khách hàng) nếu chưa tồn tại
        test_customers = [
            {"name": "Nguyễn Văn A", "email": "customer1@gmail.com", "phone": "0901234567"},
            {"name": "Trần Thị B", "email": "customer2@gmail.com", "phone": "0909876543"},
            {"name": "Phạm Văn C", "email": "customer3@gmail.com", "phone": "0912345678"},
        ]
        
        customer_users = []
        for cust in test_customers:
            existing = db.query(User).filter(User.email == cust["email"]).first()
            if not existing:
                user = User(
                    name=cust["name"],
                    email=cust["email"],
                    phone=cust["phone"],
                    role="user",
                    status="active",
                    is_active=1,
                    password_hash=""
                )
                db.add(user)
                db.commit()
                customer_users.append(user)
            else:
                customer_users.append(existing)
        
        # 6. Tạo bookings
        now = _vn_now()
        for i, user in enumerate(customer_users):
            # Kiểm tra xem user này đã có booking chưa
            existing_booking = db.query(Booking).filter(
                Booking.user_id == user.id,
                Booking.parking_id == parking_lot.id
            ).first()
            
            if not existing_booking:
                slot = db.query(ParkingSlot).filter(
                    ParkingSlot.code == slot_codes[i % len(slot_codes)]
                ).first()
                
                booking = Booking(
                    user_id=user.id,
                    parking_id=parking_lot.id,
                    slot_id=slot.id if slot else None,
                    start_time=now - timedelta(hours=2),
                    end_time=now + timedelta(hours=1),
                    total_amount=50000 * (i + 1),
                    status="completed" if i % 2 == 0 else "checked_in",
                    booking_mode="hourly",
                    created_at=now
                )
                db.add(booking)
                db.commit()
                
                # 7. Tạo payment
                payment = Payment(
                    booking_id=booking.id,
                    amount=50000 * (i + 1),
                    status="paid" if i % 2 == 0 else "pending",
                    created_at=now - timedelta(hours=1)
                )
                db.add(payment)
                db.commit()
        
        return {
            "status": "success",
            "message": "Dữ liệu test đã được tạo",
            "parking_lot": {
                "id": parking_lot.id,
                "name": parking_lot.name
            },
            "owner": {
                "id": owner.id,
                "email": owner.email
            },
            "customers_created": len(customer_users)
        }
    
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"Lỗi khi tạo dữ liệu test: {str(e)}"
        }
