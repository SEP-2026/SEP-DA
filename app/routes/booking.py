import math
from datetime import datetime, timezone
import os
import unicodedata
from urllib.parse import quote_plus
from urllib.request import urlopen
import json

import qrcode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Booking, ParkingLot, ParkingPrice, ParkingSlot, Payment, User
from app.routes.auth import get_current_user

router = APIRouter()


class BookingCreateRequest(BaseModel):
    parking_id: int = Field(gt=0)
    slot_id: int = Field(gt=0)
    license_plate: str = Field(min_length=1, max_length=30)
    owner_name: str = Field(min_length=1, max_length=255)
    vehicle_type: str | None = Field(default=None, max_length=50)
    brand: str | None = Field(default=None, max_length=100)
    booking_mode: str = Field(default="hourly", max_length=20)
    month_count: int | None = Field(default=None, ge=1, le=24)
    checkin_time: datetime
    checkout_time: datetime | None = None


def _normalize_text(value: str) -> str:
    plain = unicodedata.normalize("NFD", value)
    plain = "".join(ch for ch in plain if unicodedata.category(ch) != "Mn")
    return plain.lower().strip()


def _local_geocode_fallback(address: str):
    normalized = _normalize_text(address)
    candidates = {
        "nguyen van sang": (10.7910, 106.6255),
        "tan ky tan quy": (10.7932, 106.6250),
        "luy ban bich": (10.7818, 106.6364),
        "au co": (10.7864, 106.6402),
        "truong chinh": (10.8031, 106.6287),
        "tan phu": (10.7910, 106.6255),
    }
    for key, point in candidates.items():
        if key in normalized:
            return point
    return None


def geocode_address(address: str):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    encoded_address = quote_plus(address)

    if api_key:
        geocode_url = (
            "https://maps.googleapis.com/maps/api/geocode/json"
            f"?address={encoded_address}&key={api_key}"
        )

        try:
            with urlopen(geocode_url, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
            results = payload.get("results", [])
            status = payload.get("status")
            if status == "OK" and results:
                location = results[0]["geometry"]["location"]
                return float(location["lat"]), float(location["lng"])
        except Exception:
            pass

    # Fallback khi chưa cấu hình Google API key hoặc Google API không phản hồi.
    nominatim_url = (
        "https://nominatim.openstreetmap.org/search"
        f"?q={encoded_address}&format=json&limit=1"
    )
    try:
        req_headers = {"User-Agent": "smart-parking-app/1.0"}
        from urllib.request import Request

        req = Request(nominatim_url, headers=req_headers)
        with urlopen(req, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=502, detail="Không gọi được dịch vụ geocoding")

    if payload:
        return float(payload[0]["lat"]), float(payload[0]["lon"])

    local_point = _local_geocode_fallback(address)
    if local_point:
        return local_point

    raise HTTPException(status_code=404, detail="Không tìm thấy tọa độ cho địa chỉ đã nhập")


@router.get("/slots")
def get_slots(parking_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(ParkingSlot)
    if parking_id is not None:
        query = query.filter(ParkingSlot.parking_id == parking_id)

    slots = query.all()
    return slots


@router.get("/search-parking")
def search_parking(
    address: str,
    limit: int = 5,
    sort_by: str = "nearest",
    covered_only: bool = False,
    db: Session = Depends(get_db),
):
    if not address or not address.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập địa điểm")

    safe_limit = max(1, min(limit, 20))
    lat, lng = geocode_address(address.strip())

    order_by = "distance ASC"
    if sort_by == "cheapest":
        order_by = "pr.price_per_hour ASC, distance ASC"

    covered_sql = "AND p.has_roof = 1" if covered_only else ""

    query = text(
        f"""
        SELECT
            p.id,
            p.name,
            p.address,
            p.latitude,
            p.longitude,
            p.has_roof,
            pr.price_per_hour,
            pr.price_per_day,
            pr.price_per_month,
            (
                6371 * ACOS(
                    COS(RADIANS(:lat))
                    * COS(RADIANS(p.latitude))
                    * COS(RADIANS(p.longitude) - RADIANS(:lng))
                    + SIN(RADIANS(:lat))
                    * SIN(RADIANS(p.latitude))
                )
            ) AS distance
        FROM parking_lots p
        JOIN parking_prices pr ON p.id = pr.parking_id
                WHERE p.is_active = 1
                    AND p.latitude IS NOT NULL
                    AND p.longitude IS NOT NULL
                    {covered_sql}
        ORDER BY {order_by}
        LIMIT :limit
        """
    )

    rows = db.execute(query, {"lat": lat, "lng": lng, "limit": safe_limit}).mappings().all()

    return {
        "query": address,
        "center": {"lat": lat, "lng": lng},
        "nearest": [
            {
                **dict(row),
                "distance": round(float(row["distance"] or 0), 3),
            }
            for row in rows
        ],
    }


@router.get("/search-parking-by-coords")
def search_parking_by_coords(
    lat: float,
    lng: float,
    limit: int = 5,
    sort_by: str = "nearest",
    covered_only: bool = False,
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 20))

    order_by = "distance ASC"
    if sort_by == "cheapest":
        order_by = "pr.price_per_hour ASC, distance ASC"

    covered_sql = "AND p.has_roof = 1" if covered_only else ""

    query = text(
        f"""
        SELECT
            p.id,
            p.name,
            p.address,
            p.latitude,
            p.longitude,
            p.has_roof,
            pr.price_per_hour,
            pr.price_per_day,
            pr.price_per_month,
            (
                6371 * ACOS(
                    COS(RADIANS(:lat))
                    * COS(RADIANS(p.latitude))
                    * COS(RADIANS(p.longitude) - RADIANS(:lng))
                    + SIN(RADIANS(:lat))
                    * SIN(RADIANS(p.latitude))
                )
            ) AS distance
        FROM parking_lots p
        JOIN parking_prices pr ON p.id = pr.parking_id
        WHERE p.is_active = 1
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          {covered_sql}
        ORDER BY {order_by}
        LIMIT :limit
        """
    )

    rows = db.execute(query, {"lat": lat, "lng": lng, "limit": safe_limit}).mappings().all()

    return {
        "query": "current_location",
        "center": {"lat": lat, "lng": lng},
        "nearest": [
            {
                **dict(row),
                "distance": round(float(row["distance"] or 0), 3),
            }
            for row in rows
        ],
    }


def _ensure_qr_directory() -> None:
    os.makedirs("qrcodes", exist_ok=True)


def _save_booking_qr(content: str, file_path: str) -> None:
    _ensure_qr_directory()
    image = qrcode.make(content)
    image.save(file_path)


def _validate_booking_window(checkin_time: datetime, checkout_time: datetime) -> None:
    now = datetime.utcnow()
    if checkin_time >= checkout_time:
        raise HTTPException(status_code=400, detail="Thời gian vào phải nhỏ hơn thời gian ra")
    if checkin_time < now:
        raise HTTPException(status_code=400, detail="Thời gian vào phải lớn hơn thời gian hiện tại")


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_booking_mode(value: str | None) -> str:
    mode = (value or "hourly").strip().lower()
    if mode not in {"hourly", "daily", "monthly"}:
        raise HTTPException(status_code=400, detail="booking_mode chỉ hỗ trợ: hourly, daily, monthly")
    return mode


def _add_months(start: datetime, months: int) -> datetime:
    year = start.year + (start.month - 1 + months) // 12
    month = (start.month - 1 + months) % 12 + 1
    month_lengths = [
        31,
        29
        if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]
    day = min(start.day, month_lengths[month - 1])
    return start.replace(year=year, month=month, day=day)


def _resolve_checkout_time(payload: BookingCreateRequest, booking_mode: str) -> datetime:
    if booking_mode == "monthly":
        if payload.month_count is None:
            raise HTTPException(status_code=400, detail="Vui lòng nhập số tháng khi đặt theo tháng")
        return _add_months(payload.checkin_time, payload.month_count)

    if payload.checkout_time is None:
        raise HTTPException(status_code=400, detail="Vui lòng chọn thời gian checkout")
    return payload.checkout_time


def _calculate_booking_amount(
    booking_mode: str,
    checkin_time: datetime,
    checkout_time: datetime,
    parking_price: ParkingPrice,
    month_count: int | None,
) -> dict:
    duration_hours = (checkout_time - checkin_time).total_seconds() / 3600

    if booking_mode == "monthly":
        billed_units = float(month_count or 1)
        unit_price = float(parking_price.price_per_month)
        return {
            "resolved_mode": "monthly",
            "billed_unit": "month",
            "billed_units": billed_units,
            "unit_price": unit_price,
            "total_amount": billed_units * unit_price,
            "duration_hours": duration_hours,
        }

    if booking_mode == "daily":
        billed_units = float(max(1, math.ceil(duration_hours / 24)))
        unit_price = float(parking_price.price_per_day)
        return {
            "resolved_mode": "daily",
            "billed_unit": "day",
            "billed_units": billed_units,
            "unit_price": unit_price,
            "total_amount": billed_units * unit_price,
            "duration_hours": duration_hours,
        }

    if duration_hours > 12:
        billed_units = 1.0
        unit_price = float(parking_price.price_per_day)
        return {
            "resolved_mode": "daily",
            "billed_unit": "day",
            "billed_units": billed_units,
            "unit_price": unit_price,
            "total_amount": billed_units * unit_price,
            "duration_hours": duration_hours,
            "auto_converted": True,
        }

    billed_units = float(max(1, math.ceil(duration_hours)))
    unit_price = float(parking_price.price_per_hour)
    return {
        "resolved_mode": "hourly",
        "billed_unit": "hour",
        "billed_units": billed_units,
        "unit_price": unit_price,
        "total_amount": billed_units * unit_price,
        "duration_hours": duration_hours,
    }


def _create_booking_qr_content(booking: Booking, slot: ParkingSlot, user: User) -> str:
    qr_payload = {
        "qr_type": "parking_access",
        "actions": ["check_in", "check_out"],
        "booking_id": booking.id,
        "user_id": user.id,
        "parking_id": booking.parking_id,
        "slot_id": slot.id,
        "license_plate": user.vehicle_plate or "",
        "checkin_time": booking.start_time.isoformat() if booking.start_time else None,
        "checkout_time": booking.expire_time.isoformat() if booking.expire_time else None,
    }
    return json.dumps(qr_payload, ensure_ascii=False, separators=(",", ":"))


def _serialize_booking_response(
    booking: Booking,
    slot: ParkingSlot,
    parking_lot: ParkingLot,
    vehicle: dict,
    billing: dict,
    booking_mode: str,
    month_count: int | None,
    existing_pending_booking: bool = False,
) -> dict:
    return {
        "message": "Booking created successfully" if not existing_pending_booking else "Đã có booking pending, chuyển sang thanh toán",
        "booking_id": booking.id,
        "booking_status": booking.status,
        "qr_code": booking.qr_code,
        "parking": {
            "id": parking_lot.id,
            "name": parking_lot.name,
            "address": parking_lot.address,
        },
        "slot": {
            "id": slot.id,
            "code": slot.code,
        },
        "vehicle": vehicle,
        "billing": billing,
        "booking_mode": booking_mode,
        "month_count": month_count,
        "total_amount": booking.total_amount,
        "checkin_time": booking.start_time,
        "checkout_time": booking.expire_time,
        "payment_required": booking.status == "pending",
        "existing_pending_booking": existing_pending_booking,
    }


@router.get("/booking/my/{booking_id}")
def get_my_booking_detail(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")

    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem booking này")

    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == booking.parking_id).first()
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()

    payment_required = booking.status == "pending"

    return {
        "booking_id": booking.id,
        "booking_status": booking.status,
        "checkin_time": booking.start_time,
        "checkout_time": booking.expire_time,
        "booking_mode": booking.booking_mode,
        "billed_units": booking.billed_units,
        "total_amount": booking.total_amount,
        "qr_code": booking.qr_code,
        "payment_required": payment_required,
        "parking": {
            "id": parking_lot.id if parking_lot else None,
            "name": parking_lot.name if parking_lot else None,
            "address": parking_lot.address if parking_lot else None,
        },
        "slot": {
            "id": slot.id if slot else None,
            "code": slot.code if slot else None,
        },
        "vehicle": {
            "owner_name": current_user.name,
            "license_plate": current_user.vehicle_plate,
        },
    }


@router.get("/booking/gate/{booking_id}")
def get_gate_booking_detail(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem thông tin tại cổng")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")

    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == booking.parking_id).first()
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()
    user = db.query(User).filter(User.id == booking.user_id).first()
    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()

    return {
        "booking_id": booking.id,
        "booking_status": booking.status,
        "checkin_time": booking.start_time,
        "checkout_time": booking.expire_time,
        "actual_checkin": booking.actual_checkin,
        "actual_checkout": booking.actual_checkout,
        "parking": {
            "id": parking_lot.id if parking_lot else None,
            "name": parking_lot.name if parking_lot else None,
            "address": parking_lot.address if parking_lot else None,
        },
        "slot": {
            "id": slot.id if slot else None,
            "code": slot.code if slot else None,
        },
        "vehicle": {
            "owner_name": user.name if user else None,
            "license_plate": user.vehicle_plate if user else None,
        },
        "payment": {
            "amount": payment.amount if payment else None,
            "overtime_fee": payment.overtime_fee if payment else 0,
            "payment_status": payment.payment_status if payment else None,
        },
    }


@router.post("/booking/create")
def create_booking(
    payload: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        booking_mode = _normalize_booking_mode(payload.booking_mode)
        normalized_checkin_time = _to_utc_naive(payload.checkin_time)
        resolved_checkout_time = _resolve_checkout_time(payload, booking_mode)
        normalized_checkout_time = _to_utc_naive(resolved_checkout_time)
        _validate_booking_window(normalized_checkin_time, normalized_checkout_time)

        parking_lot = (
            db.query(ParkingLot)
            .filter(ParkingLot.id == payload.parking_id, ParkingLot.is_active == 1)
            .first()
        )
        if not parking_lot:
            raise HTTPException(status_code=404, detail="Bãi xe không tồn tại")

        parking_price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == parking_lot.id).first()
        if not parking_price:
            raise HTTPException(status_code=400, detail="Bãi xe chưa được cấu hình bảng giá")

        billing = _calculate_booking_amount(
            booking_mode=booking_mode,
            checkin_time=normalized_checkin_time,
            checkout_time=normalized_checkout_time,
            parking_price=parking_price,
            month_count=payload.month_count,
        )

        user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

        active_booking = (
            db.query(Booking)
            .filter(
                Booking.user_id == user.id,
                Booking.status.in_(["pending", "booked", "checked_in"]),
                Booking.start_time < normalized_checkout_time,
                Booking.expire_time > normalized_checkin_time,
            )
            .first()
        )
        if active_booking:
            if active_booking.status == "pending":
                active_slot = db.query(ParkingSlot).filter(ParkingSlot.id == active_booking.slot_id).first()
                if not active_slot:
                    raise HTTPException(status_code=400, detail="Booking pending tồn tại nhưng slot không hợp lệ")

                active_parking = db.query(ParkingLot).filter(ParkingLot.id == active_booking.parking_id).first()
                if not active_parking:
                    raise HTTPException(status_code=400, detail="Booking pending tồn tại nhưng bãi xe không hợp lệ")

                active_billing = {
                    "requested_mode": active_booking.booking_mode,
                    "resolved_mode": active_booking.booking_mode,
                    "billed_unit": "day" if active_booking.booking_mode == "daily" else ("month" if active_booking.booking_mode == "monthly" else "hour"),
                    "billed_units": float(active_booking.billed_units or 0),
                    "unit_price": float(active_booking.total_amount or 0) / float(active_booking.billed_units or 1),
                    "duration_hours": round((active_booking.expire_time - active_booking.start_time).total_seconds() / 3600, 2) if active_booking.expire_time and active_booking.start_time else 0,
                    "auto_converted_to_daily": active_booking.booking_mode == "daily" and float(active_booking.billed_units or 0) >= 1,
                    "total_amount": float(active_booking.total_amount or 0),
                }
                return _serialize_booking_response(
                    active_booking,
                    active_slot,
                    active_parking,
                    {
                        "owner_name": user.name,
                        "license_plate": user.vehicle_plate,
                        "vehicle_type": payload.vehicle_type,
                        "brand": payload.brand,
                    },
                    active_billing,
                    active_booking.booking_mode,
                    payload.month_count,
                    existing_pending_booking=True,
                )

            raise HTTPException(status_code=400, detail="Bạn đã có booking đang hoạt động")

        slot = (
            db.query(ParkingSlot)
            .filter(
                ParkingSlot.id == payload.slot_id,
                ParkingSlot.parking_id == payload.parking_id,
            )
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(status_code=404, detail="Slot không tồn tại")

        if slot.status != "available":
            raise HTTPException(status_code=400, detail="Slot đã được đặt hoặc không còn trống")

        overlapping_slot_booking = (
            db.query(Booking)
            .filter(
                Booking.slot_id == slot.id,
                Booking.status.in_(["pending", "booked", "checked_in"]),
                Booking.start_time < normalized_checkout_time,
                Booking.expire_time > normalized_checkin_time,
            )
            .first()
        )
        if overlapping_slot_booking:
            raise HTTPException(status_code=400, detail="Slot đã được đặt trong khung giờ này")

        user.vehicle_plate = payload.license_plate.strip().upper()
        if payload.owner_name.strip() and not user.name:
            user.name = payload.owner_name.strip()

        booking = Booking(
            user_id=user.id,
            slot_id=slot.id,
            parking_id=parking_lot.id,
            start_time=normalized_checkin_time,
            expire_time=normalized_checkout_time,
            booking_mode=billing["resolved_mode"],
            billed_units=billing["billed_units"],
            total_amount=billing["total_amount"],
            status="pending",
            qr_code="",
        )

        db.add(booking)
        db.flush()

        qr_content = _create_booking_qr_content(booking, slot, user)
        qr_path = f"qrcodes/booking_{booking.id}.png"
        _save_booking_qr(qr_content, qr_path)

        booking.qr_code = qr_path
        slot.status = "reserved"

        db.commit()
        db.refresh(booking)
        db.refresh(slot)

        return _serialize_booking_response(
            booking=booking,
            slot=slot,
            parking_lot=parking_lot,
            vehicle={
                "owner_name": payload.owner_name.strip(),
                "license_plate": user.vehicle_plate,
                "vehicle_type": payload.vehicle_type,
                "brand": payload.brand,
            },
            billing={
                "requested_mode": booking_mode,
                "resolved_mode": billing["resolved_mode"],
                "billed_unit": billing["billed_unit"],
                "billed_units": billing["billed_units"],
                "unit_price": billing["unit_price"],
                "duration_hours": round(billing["duration_hours"], 2),
                "auto_converted_to_daily": bool(billing.get("auto_converted", False)),
                "total_amount": billing["total_amount"],
            },
            booking_mode=booking.booking_mode,
            month_count=payload.month_count,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/check-in")
def check_in(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking không tồn tại")

    if booking.status == "pending":
        raise HTTPException(status_code=400, detail="Booking chưa được thanh toán")

    if booking.status != "booked":
        raise HTTPException(status_code=400, detail="Booking không hợp lệ")

    booking.status = "checked_in"
    booking.start_time = datetime.utcnow()
    if booking.slot:
        booking.slot.status = "occupied"

    db.commit()

    return {"message": "Check-in thành công"}


@router.post("/check-out")
def check_out(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy booking")

    if booking.status != "checked_in":
        raise HTTPException(status_code=400, detail="Chưa check-in")

    actual_checkout = datetime.utcnow()
    overtime_fee = 0.0

    if booking.expire_time and actual_checkout > booking.expire_time:
        extra_hours = (actual_checkout - booking.expire_time).total_seconds() / 3600
        price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == booking.parking_id).first()
        if price:
            overtime_fee = round(max(0, extra_hours) * float(price.price_per_hour), 2)

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if payment and overtime_fee > 0:
        payment.overtime_fee = overtime_fee

    booking.status = "completed"
    if booking.slot:
        booking.slot.status = "available"

    db.commit()

    return {
        "message": "Check-out thành công",
        "booking_id": booking.id,
        "booking_status": booking.status,
        "overtime_fee": overtime_fee,
        "total_paid": round(float(payment.amount + payment.overtime_fee), 2) if payment else None,
    }
