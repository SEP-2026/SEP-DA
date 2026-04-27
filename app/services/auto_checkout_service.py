from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import Booking, ParkingPrice, Payment
from app.routes.booking import calculate_checkout_fee
from app.services.qr_service import invalidate_booking_qr_code
from app.utils.timezone import vn_now


def auto_checkout_expired_bookings(db: Session, now: datetime | None = None) -> int:
    """Auto checkout for bookings that are still checked_in but already past expire_time."""
    checkout_at = now or vn_now()
    expired_bookings = (
        db.query(Booking)
        .filter(
            Booking.status == "checked_in",
            Booking.expire_time.isnot(None),
            Booking.expire_time <= checkout_at,
        )
        .with_for_update()
        .all()
    )

    if not expired_bookings:
        return 0

    processed = 0
    try:
        for booking in expired_bookings:
            # Keep behavior consistent with existing manual checkout flow.
            if booking.actual_checkin is None:
                booking.actual_checkin = booking.start_time or checkout_at

            parking_price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == booking.parking_id).first()
            try:
                fee = calculate_checkout_fee(
                    booking,
                    checkout_at,
                    float(parking_price.price_per_hour if parking_price else 0),
                )
            except HTTPException:
                # Fallback to base amount if booking data is incomplete.
                original_fee = float(booking.total_amount or 0)
                fee = {
                    "overstay_minutes": 0,
                    "overstay_fee": 0,
                    "total_actual_fee": original_fee,
                }

            payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
            if payment:
                payment.overtime_fee = float(fee["overstay_fee"] or 0)

            booking.actual_checkout = checkout_at
            booking.overstay_minutes = int(fee["overstay_minutes"] or 0)
            booking.overstay_fee = float(fee["overstay_fee"] or 0)
            booking.total_actual_fee = float(fee["total_actual_fee"] or booking.total_amount or 0)
            booking.status = "completed"
            booking.last_gate_action = "auto_check_out"
            booking.last_gate_action_at = checkout_at

            if booking.slot:
                booking.slot.status = "available"

            invalidate_booking_qr_code(booking, db)
            processed += 1

        db.commit()
        return processed
    except Exception:
        db.rollback()
        raise

