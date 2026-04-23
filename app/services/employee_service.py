from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from app.models.models import Booking, EmployeeAccount, EmployeeActivity, OwnerParking, ParkingLot, ParkingOperationalState, ParkingSlot, User
from app.routes.auth import create_access_token_for_subject
from app.routes.gate import _execute_check_in, _execute_check_out, _get_payment, _parse_scan_payload
from app.security.password_policy import ensure_strong_password

APP_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def _get_owner_assignment(owner_id: int, parking_id: int, db: Session) -> OwnerParking | None:
    return (
        db.query(OwnerParking)
        .filter(OwnerParking.owner_id == owner_id, OwnerParking.parking_id == parking_id)
        .first()
    )


def _get_employee_parking(employee: EmployeeAccount, db: Session) -> ParkingLot:
    parking_lot = db.query(ParkingLot).filter(ParkingLot.id == employee.parking_id, ParkingLot.is_active == 1).first()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y bÃ£i Ä‘Æ°á»£c phÃ¢n cÃ´ng")
    return parking_lot


def _get_operational_state(parking_id: int, db: Session) -> ParkingOperationalState:
    state = db.query(ParkingOperationalState).filter(ParkingOperationalState.parking_id == parking_id).first()
    if not state:
        state = ParkingOperationalState(parking_id=parking_id, status="open")
        db.add(state)
        db.flush()
    return state


def _compute_slot_metrics(parking_id: int, db: Session) -> tuple[int, int, int]:
    total_slots = (
        db.query(func.count())
        .select_from(ParkingSlot)
        .filter(ParkingSlot.parking_id == parking_id)
        .scalar()
        or 0
    )
    occupied_slots = (
        db.query(func.count())
        .select_from(Booking)
        .filter(Booking.parking_id == parking_id, Booking.status == "checked_in")
        .scalar()
        or 0
    )
    empty_slots = max(int(total_slots) - int(occupied_slots), 0)
    return int(total_slots), int(occupied_slots), int(empty_slots)


def _resolve_status(parking_id: int, db: Session) -> str:
    total_slots, occupied_slots, _ = _compute_slot_metrics(parking_id, db)
    state = _get_operational_state(parking_id, db)
    if state.status == "closed":
        return "closed"
    if state.status == "full" or (total_slots > 0 and occupied_slots >= total_slots):
        return "full"
    return "open"


def _serialize_employee(employee: EmployeeAccount) -> dict:
    return {
        "id": employee.id,
        "username": employee.username,
        "role": employee.role,
        "owner_id": employee.owner_id,
        "parking_id": employee.parking_id,
        "status": employee.status,
        "created_at": employee.created_at,
    }


def _serialize_parking(parking_lot: ParkingLot, db: Session) -> dict:
    total_slots, occupied_slots, empty_slots = _compute_slot_metrics(parking_lot.id, db)
    return {
        "parking_id": parking_lot.id,
        "parking_name": parking_lot.name,
        "address": parking_lot.address,
        "totalSlots": total_slots,
        "occupiedSlots": occupied_slots,
        "emptySlots": empty_slots,
        "status": _resolve_status(parking_lot.id, db),
    }


def _log_activity(
    employee: EmployeeAccount,
    parking_id: int,
    action: str,
    detail: str,
    db: Session,
    booking_id: int | None = None,
    amount: float = 0,
) -> None:
    db.add(
        EmployeeActivity(
            employee_id=employee.id,
            parking_id=parking_id,
            booking_id=booking_id,
            action=action,
            detail=detail,
            amount=amount,
        )
    )


def create_employee_for_owner(owner: User, username: str, password: str, parking_id: int, db: Session) -> dict:
    if owner.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chá»‰ owner má»›i táº¡o Ä‘Æ°á»£c employee")
    if _get_owner_assignment(owner.id, parking_id, db) is None:
        raise HTTPException(status_code=403, detail="Owner khÃ´ng quáº£n lÃ½ bÃ£i nÃ y")

    ensure_strong_password(password)
    normalized_username = username.strip().lower()
    existing = db.query(EmployeeAccount).filter(EmployeeAccount.username == normalized_username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username employee Ä‘Ã£ tá»“n táº¡i")

    employee = EmployeeAccount(
        username=normalized_username,
        password_hash=generate_password_hash(password),
        owner_id=owner.id,
        parking_id=parking_id,
        role="employee",
        status="active",
        is_active=1,
    )
    db.add(employee)
    db.flush()

    _get_operational_state(parking_id, db)
    _log_activity(employee, parking_id, "employee_created", f"Owner #{owner.id} táº¡o employee {normalized_username}", db)
    db.commit()
    db.refresh(employee)
    return _serialize_employee(employee)


def employee_login(username: str, password: str, db: Session) -> dict:
    normalized_username = username.strip().lower()
    employee = (
        db.query(EmployeeAccount)
        .filter(EmployeeAccount.username == normalized_username, EmployeeAccount.is_active == 1)
        .first()
    )
    if not employee or employee.status != "active":
        raise HTTPException(status_code=401, detail="Sai username hoáº·c máº­t kháº©u")
    if not check_password_hash(employee.password_hash, password):
        raise HTTPException(status_code=401, detail="Sai username hoáº·c máº­t kháº©u")

    token, expires_at, _ = create_access_token_for_subject(
        subject=f"employee:{employee.id}",
        role="employee",
        identity=employee.username,
    )
    return {
        "message": "ÄÄƒng nháº­p employee thÃ nh cÃ´ng",
        "token": token,
        "expires_in": int((expires_at - datetime.now(expires_at.tzinfo)).total_seconds()),
        "user": _serialize_employee(employee),
    }


def get_employee_profile(employee: EmployeeAccount, db: Session) -> dict:
    parking_lot = _get_employee_parking(employee, db)
    return {
        "employee": _serialize_employee(employee),
        "parking_lot": _serialize_parking(parking_lot, db),
    }


def get_employee_dashboard(employee: EmployeeAccount, db: Session) -> dict:
    parking_lot = _get_employee_parking(employee, db)
    return _serialize_parking(parking_lot, db)


def get_employee_vehicles(employee: EmployeeAccount, db: Session) -> dict:
    rows = db.execute(
        text(
            """
            SELECT
                b.id AS booking_id,
                u.vehicle_plate AS license_plate,
                COALESCE(b.actual_checkin, b.checkin_time) AS check_in_time,
                b.status AS status,
                COALESCE(ps.slot_number, ps.code) AS slot_code
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN parking_slots ps ON ps.id = b.slot_id
            WHERE b.parking_id = :parking_id
              AND b.status = 'checked_in'
            ORDER BY COALESCE(b.actual_checkin, b.checkin_time) DESC, b.id DESC
            """
        ),
        {"parking_id": employee.parking_id},
    ).mappings().all()
    vehicles = [
        {
            "booking_id": row["booking_id"],
            "license_plate": row["license_plate"],
            "check_in_time": row["check_in_time"],
            "status": row["status"],
            "slot_code": row["slot_code"],
        }
        for row in rows
    ]
    return {"vehicles": vehicles, "total_count": len(vehicles)}


def get_employee_revenue(employee: EmployeeAccount, db: Session) -> dict:
    today = datetime.now(APP_TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    month_start = today.replace(day=1)
    revenue_today = 0.0
    revenue_month = 0.0
    rows = db.execute(
        text(
            """
            SELECT
                COALESCE(p.paid_at, p.created_at) AS paid_time,
                COALESCE(p.amount, 0) + COALESCE(p.overtime_fee, 0) AS total_amount
            FROM payments p
            INNER JOIN bookings b ON b.id = p.booking_id
            WHERE b.parking_id = :parking_id
              AND p.payment_status = 'paid'
            """
        ),
        {"parking_id": employee.parking_id},
    ).mappings().all()
    for row in rows:
        paid_at = row["paid_time"]
        amount = float(row["total_amount"] or 0)
        if paid_at and paid_at >= month_start:
            revenue_month += amount
            if paid_at >= today:
                revenue_today += amount
    return {
        "revenueToday": round(revenue_today, 2),
        "revenueMonth": round(revenue_month, 2),
    }


def update_employee_parking_status(employee: EmployeeAccount, status_value: str, db: Session) -> dict:
    _get_employee_parking(employee, db)
    state = _get_operational_state(employee.parking_id, db)
    state.status = status_value
    state.updated_at = datetime.utcnow()
    _log_activity(employee, employee.parking_id, "parking_status_updated", f"Cáº­p nháº­t tráº¡ng thÃ¡i bÃ£i sang {status_value}", db)
    db.commit()
    return get_employee_dashboard(employee, db)


def employee_check_in(employee: EmployeeAccount, qr_data: str, db: Session) -> dict:
    parsed = _parse_scan_payload(qr_data, "qr_scan")
    booking = db.query(Booking).filter(Booking.id == parsed["booking_id"]).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y booking")
    payment = _get_payment(booking.id, db, lock=True)
    detail = _execute_check_in(
        booking=booking,
        payment=payment,
        gate_id=f"EMP-{employee.username}",
        source_type="qr_scan",
        actor=employee,
        db=db,
    )
    _log_activity(
        employee,
        employee.parking_id,
        "check_in",
        f"Check-in booking BK-{booking.id}",
        db,
        booking_id=booking.id,
    )
    db.commit()
    return {
        "message": "Employee check-in thÃ nh cÃ´ng",
        "booking": detail,
        "payment_preview": detail.get("pricing_preview"),
    }


def employee_check_out(employee: EmployeeAccount, qr_data: str, payment_method: str, db: Session) -> dict:
    parsed = _parse_scan_payload(qr_data, "qr_scan")
    booking = db.query(Booking).filter(Booking.id == parsed["booking_id"]).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y booking")
    payment = _get_payment(booking.id, db, lock=True)
    detail = _execute_check_out(
        booking=booking,
        payment=payment,
        gate_id=f"EMP-{employee.username}",
        source_type="qr_scan",
        payment_method=payment_method,
        actor=employee,
        db=db,
    )
    amount = float(detail.get("pricing_preview", {}).get("total_charge") or 0)
    _log_activity(
        employee,
        employee.parking_id,
        "check_out",
        f"Check-out booking BK-{booking.id}",
        db,
        booking_id=booking.id,
        amount=amount,
    )
    db.commit()
    return {
        "message": "Employee check-out thÃ nh cÃ´ng",
        "booking": detail,
        "payment_preview": detail.get("pricing_preview"),
    }


def get_employee_history(employee: EmployeeAccount, db: Session) -> dict:
    rows = (
        db.query(EmployeeActivity)
        .filter(EmployeeActivity.employee_id == employee.id)
        .order_by(EmployeeActivity.created_at.desc(), EmployeeActivity.id.desc())
        .limit(200)
        .all()
    )
    history = [
        {
            "id": row.id,
            "action": row.action,
            "detail": row.detail,
            "amount": float(row.amount or 0),
            "created_at": row.created_at,
        }
        for row in rows
    ]
    return {"history": history, "total_count": len(history)}
