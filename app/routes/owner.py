from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

from app.database import get_db
from app.models.models import Booking, OwnerParking, ParkingLot, ParkingPrice, ParkingSlot, Payment, Review, User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/owner", tags=["owner"])


class OwnerSlotCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    status: str = Field(pattern="^(available|reserved|in_use|maintenance)$")
    type: str | None = Field(default="Sedan", max_length=50)


class OwnerSlotUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, pattern="^(available|reserved|in_use|maintenance)$")
    type: str | None = Field(default=None, max_length=50)


class OwnerBookingStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(confirmed|cancelled|completed|in_progress|pending)$")


class OwnerAccountUpdateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str | None = Field(default=None, max_length=255)
    confirmPassword: str | None = Field(default=None, max_length=255)


class OwnerParkingSettingsUpdateRequest(BaseModel):
    parkingName: str | None = Field(default=None, max_length=255)
    pricePerHour: str | None = None
    pricePerDay: str | None = None
    pricePerMonth: str | None = None
    contactPhone: str | None = Field(default=None, max_length=30)
    contactEmail: str | None = Field(default=None, max_length=255)


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


def _slot_type_label(slot: ParkingSlot, index: int) -> str:
    if (slot.slot_type or "").lower() == "vip":
        return "SUV"
    return ["Sedan", "SUV", "EV"][index % 3]


def _slot_layout_meta(slot: ParkingSlot, db: Session) -> dict:
    lot_slots = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.parking_id == slot.parking_id)
        .order_by(ParkingSlot.id.asc())
        .all()
    )
    slot_index = next((index for index, item in enumerate(lot_slots) if int(item.id) == int(slot.id)), 0)
    zone_index = slot_index % 4
    level_index = slot_index // 20
    return {
        "zone": f"Khu {chr(65 + zone_index)}",
        "level": f"Tầng {level_index + 1}",
        "type": _slot_type_label(slot, slot_index),
        "updatedAt": datetime.utcnow().isoformat(),
    }


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

    result = []
    for lot in parking_lots:
        lot_slots = slots_by_parking.get(int(lot.id), [])
        available_count = sum(1 for slot in lot_slots if (slot.status or "").lower() == "available")
        occupied_count = len(lot_slots) - available_count
        result.append({
            "parking_id": lot.id,
            "parking_name": lot.name,
            "parking_address": lot.address,
            "district": lot.district.name if lot.district else None,
            "available_slots": available_count,
            "occupied_or_reserved_slots": occupied_count,
            "total_slots": len(lot_slots),
            "slots": [
                {
                    "id": slot.id,
                    "code": slot.slot_number or slot.code,
                    "status": slot.status,
                }
                for slot in lot_slots
            ],
        })

    return result


def _serialize_owner_bootstrap(current_user: User, parking_lot: ParkingLot | None, db: Session) -> dict:
    if not parking_lot:
        return {
            "parkingLot": None,
            "slots": [],
            "bookings": [],
            "transactions": [],
            "activities": [],
            "settings": None,
            "reviews": [],
        }

    slots = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.parking_id == parking_lot.id)
        .order_by(ParkingSlot.id.asc())
        .all()
    )
    bookings = (
        db.query(Booking)
        .filter(Booking.parking_id == parking_lot.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    payments = (
        db.query(Payment)
        .join(Booking, Booking.id == Payment.booking_id)
        .filter(Booking.parking_id == parking_lot.id)
        .all()
    )
    reviews = (
        db.query(Review)
        .filter(Review.parking_id == parking_lot.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == parking_lot.id).first()

    booking_statuses_by_slot: dict[int, set[str]] = defaultdict(set)
    for booking in bookings:
        if booking.slot_id:
            booking_statuses_by_slot[int(booking.slot_id)].add((booking.status or "").lower())

    slot_rows = []
    for index, slot in enumerate(slots):
        zone_index = index % 4
        level_index = index // 20
        slot_rows.append({
            "id": slot.id,
            "code": slot.slot_number or slot.code or f"S-{index + 1}",
            "zone": f"Khu {chr(65 + zone_index)}",
            "level": f"Tầng {level_index + 1}",
            "status": _owner_slot_status(slot.status, booking_statuses_by_slot.get(int(slot.id), set())),
            "type": _slot_type_label(slot, index),
            "updatedAt": (slot_rows[-1]["updatedAt"] if False else datetime.utcnow().isoformat()),
        })

    booking_rows = []
    for booking in bookings:
        user = booking.user
        slot = booking.slot
        zone = "Khu A"
        if slot:
            matching_slot = next((item for item in slot_rows if int(item["id"]) == int(slot.id)), None)
            if matching_slot:
                zone = matching_slot["zone"]
        booking_rows.append({
            "id": booking.id,
            "code": f"BK-{booking.id}",
            "user": user.name if user else "Unknown user",
            "plate": user.vehicle_plate if user and user.vehicle_plate else "Chưa có biển số",
            "slotCode": slot.slot_number if slot and slot.slot_number else (slot.code if slot and slot.code else "Chưa có"),
            "zone": zone,
            "startTime": (booking.start_time or booking.created_at or datetime.utcnow()).isoformat(),
            "endTime": (booking.expire_time or booking.created_at or datetime.utcnow()).isoformat(),
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
            "method": (payment.payment_method or "N/A").upper() if payment else "N/A",
            "payer": booking.user.name if booking.user else "Unknown user",
            "time": (payment.paid_at or payment.created_at or booking.created_at or datetime.utcnow()).isoformat() if payment else (booking.created_at or datetime.utcnow()).isoformat(),
            "amount": float((payment.amount if payment else booking.total_amount) or 0) + overtime_fee,
            "status": payment.payment_status if payment else ("paid" if booking.status in {"booked", "checked_in", "completed"} else "pending"),
        })

    review_rows = [
        {
            "id": f"review-{review.id}",
            "user": review.user.name if review.user else f"User #{review.user_id}",
            "rating": review.rating,
            "createdAt": (review.created_at or datetime.utcnow()).isoformat(),
            "content": review.comment or "",
            "reply": "",
        }
        for review in reviews
    ]

    activities = [
        {
            "id": f"booking-{booking.id}",
            "title": f"Booking BK-{booking.id} tại {parking_lot.name}",
            "time": (booking.created_at or datetime.utcnow()).isoformat(),
            "type": "booking",
        }
        for booking in bookings[:4]
    ]

    return {
        "parkingLot": {
            "id": parking_lot.id,
            "name": parking_lot.name,
            "address": parking_lot.address,
        },
        "slots": slot_rows,
        "bookings": booking_rows,
        "transactions": transaction_rows,
        "activities": activities,
        "settings": {
            "parkingName": parking_lot.name,
            "slotCapacity": str(len(slot_rows)),
            "pricePerHour": str(int(float(price.price_per_hour))) if price and price.price_per_hour is not None else "0",
            "pricePerDay": str(int(float(price.price_per_day))) if price and price.price_per_day is not None else "0",
            "pricePerMonth": str(int(float(price.price_per_month))) if price and price.price_per_month is not None else "0",
            "peakHours": "07:00 - 09:00, 17:00 - 20:00",
            "peakSurcharge": "0",
            "regulations": "Xuất trình mã QR hợp lệ trước khi vào và ra bãi.",
            "contactName": current_user.name,
            "contactPhone": current_user.phone or "",
            "contactEmail": current_user.email,
        },
        "reviews": review_rows,
    }


@router.get("/bootstrap")
def owner_bootstrap(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    return _serialize_owner_bootstrap(current_user, parking_lot, db)


@router.get("/parking-lots/slots-overview")
def get_owner_parking_lots_slots_overview(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    assignments = (
        db.query(OwnerParking)
        .filter(OwnerParking.owner_id == current_user.id)
        .order_by(OwnerParking.id.asc())
        .all()
    )
    parking_ids = [assignment.parking_id for assignment in assignments]
    if not parking_ids:
        return []

    parking_lots = (
        db.query(ParkingLot)
        .filter(ParkingLot.id.in_(parking_ids), ParkingLot.is_active == 1)
        .order_by(ParkingLot.id.asc())
        .all()
    )
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
        .order_by(Booking.created_at.desc())
        .all()
    )
    booking_statuses = {(item.status or "").lower() for item in active_bookings}
    active_booking = active_bookings[0] if active_bookings else None
    user = active_booking.user if active_booking else None
    payment = db.query(Payment).filter(Payment.booking_id == active_booking.id).first() if active_booking else None
    layout_meta = _slot_layout_meta(slot, db)
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
            "code": slot.slot_number or slot.code or f"Slot-{slot.id}",
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
                "startTime": (active_booking.start_time or active_booking.created_at or datetime.utcnow()).isoformat(),
                "endTime": (active_booking.expire_time or active_booking.created_at or datetime.utcnow()).isoformat(),
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
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Owner chưa được gán bãi đỗ")

    code = payload.code.strip()
    existing = db.query(ParkingSlot).filter(ParkingSlot.code == code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại")

    slot_number = str(
        db.query(ParkingSlot).filter(ParkingSlot.parking_id == parking_lot.id).count() + 1
    )
    slot = ParkingSlot(
        parking_id=parking_lot.id,
        slot_number=slot_number,
        slot_type="vip" if (payload.type or "").lower() == "suv" else "normal",
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
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Owner chưa được gán bãi đỗ")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id, ParkingSlot.parking_id == parking_lot.id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỗ đỗ")

    if payload.code is not None:
        normalized_code = payload.code.strip()
        duplicate = db.query(ParkingSlot).filter(ParkingSlot.code == normalized_code, ParkingSlot.id != slot.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Mã chỗ đỗ đã tồn tại")
        slot.code = normalized_code
    if payload.status is not None:
        slot.status = _normalize_slot_status(payload.status)
    if payload.type is not None:
        slot.slot_type = "vip" if payload.type.lower() == "suv" else "normal"

    db.commit()
    return {"message": "Đã cập nhật chỗ đỗ"}


@router.delete("/slots/{slot_id}")
def delete_owner_slot(
    slot_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Owner chưa được gán bãi đỗ")

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
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Owner chưa được gán bãi đỗ")

    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.parking_id == parking_lot.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")

    booking.status = _db_booking_status(payload.status)
    if payload.status == "cancelled" and booking.slot:
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
        current_user.password = payload.password
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
    parking_lot = _get_primary_owner_parking(current_user.id, db)
    if not parking_lot:
        raise HTTPException(status_code=404, detail="Owner chưa được gán bãi đỗ")

    if payload.parkingName is not None and payload.parkingName.strip():
        parking_lot.name = payload.parkingName.strip()

    if payload.contactPhone is not None:
        current_user.phone = payload.contactPhone.strip()
    if payload.contactEmail is not None and payload.contactEmail.strip():
        duplicate = db.query(User).filter(User.email == payload.contactEmail.lower().strip(), User.id != current_user.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Email liên hệ đã được sử dụng")
        current_user.email = payload.contactEmail.lower().strip()

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
