"""
QR Code generation service for parking bookings.
Generates human-readable QR codes with embedded metadata.
"""
import json
import os
from datetime import datetime

import qrcode
from sqlalchemy.orm import Session

from app.models.models import Booking, ParkingLot, ParkingSlot, User
from app.utils.timezone import ensure_vn_local_naive, vn_now


def _ensure_qr_directory() -> None:
    """Ensure qrcodes directory exists."""
    os.makedirs("qrcodes", exist_ok=True)


def _format_datetime_vi(dt: datetime) -> str:
    """Format datetime to Vietnamese format: HH:MM - DD/MM/YYYY"""
    if dt is None:
        return "N/A"
    return dt.strftime("%H:%M - %d/%m/%Y")


def _format_datetime_iso(dt: datetime) -> str:
    """Format datetime to ISO format for metadata."""
    if dt is None:
        return None
    return ensure_vn_local_naive(dt).isoformat()


def generate_booking_qr_code(booking_id: int, db: Session) -> dict:
    """
    Generate a human-readable QR code for a booking.
    
    Format displayed when scanned by phone:
    === PHIẾU GỬI XE THÔNG MINH ===
    Mã đặt chỗ  : #13
    Biển số xe   : 31B-1234666
    Bãi đỗ      : [Tên bãi đỗ]
    Vị trí      : Ô số [slot_number] - Tầng [floor]
    Vào lúc     : 10:36 - 21/04/2026
    Ra dự kiến  : 11:36 - 21/04/2026
    Trạng thái  : Chờ check-in
    ================================
    Quét tại cổng để vào/ra bãi xe
    Hotline: [số điện thoại bãi]
    
    With hidden metadata embedded:
    {"b":13,"u":24,"p":54,"s":258,"v":"31B-1234666","ci":"...","co":"..."}
    
    Args:
        booking_id: ID of the booking
        db: Database session
        
    Returns:
        Dictionary with qr_code_path and status info
    """
    # Query booking with related data
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return {"success": False, "error": "Booking not found"}
    
    # Get related entities
    user = db.query(User).filter(User.id == booking.user_id).first()
    parking = db.query(ParkingLot).filter(ParkingLot.id == booking.parking_id).first()
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()
    
    if not user or not parking or not slot:
        return {"success": False, "error": "Related booking data not found"}
    
    # Extract vehicle info (prioritize from user's vehicle_plate)
    license_plate = user.vehicle_plate or "N/A"
    
    # Format status
    status_map = {
        "pending": "Chờ thanh toán",
        "booked": "Chờ check-in",
        "checked_in": "Đã check-in",
        "checked_out": "Đã check-out",
        "completed": "Hoàn tất",
        "cancelled": "Đã hủy",
    }
    status_text = status_map.get(booking.status, booking.status)
    
    # Extract floor or use slot_type as fallback
    floor = slot.floor or slot.slot_type or "N/A"
    
    # Build human-readable content
    slot_display = f"Ô số {slot.slot_number or slot.code}" if slot.slot_number else f"Ô {slot.code}"
    if floor and floor != "N/A":
        slot_display += f" - Tầng {floor}"
    
    # Try to get parking phone, fallback to generic if not available
    parking_phone = "[Hotline]"
    try:
        if hasattr(parking, 'phone') and parking.phone:
            parking_phone = parking.phone
    except Exception:
        pass  # Use fallback
    
    human_readable_content = (
        "=== PHIẾU GỬI XE THÔNG MINH ===\n"
        f"Mã đặt chỗ  : #{booking.id}\n"
        f"Biển số xe   : {license_plate}\n"
        f"Bãi đỗ      : {parking.name}\n"
        f"Vị trí      : {slot_display}\n"
        f"Vào lúc     : {_format_datetime_vi(booking.start_time)}\n"
        f"Ra dự kiến  : {_format_datetime_vi(booking.expire_time)}\n"
        f"Trạng thái  : {status_text}\n"
        "================================\n"
        "Quét tại cổng để vào/ra bãi xe\n"
        f"Hotline: {parking_phone}"
    )
    
    # Build metadata (compact format)
    metadata = {
        "b": booking.id,
        "u": booking.user_id,
        "p": booking.parking_id,
        "s": booking.slot_id,
        "v": license_plate,
        "ci": _format_datetime_iso(booking.start_time),
        "co": _format_datetime_iso(booking.expire_time),
    }
    metadata_str = json.dumps(metadata, separators=(",", ":"))
    
    # Combine content with metadata
    qr_content = f"{human_readable_content}\n\n{metadata_str}"
    
    # Generate QR code
    _ensure_qr_directory()
    qr = qrcode.QRCode(
        version=None,  # Auto-detect version
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_content)
    qr.make(fit=True)
    
    # Create image with colors
    image = qr.make_image(fill_color="black", back_color="white")
    
    # Save to file
    qr_filename = f"booking_{booking_id}.png"
    qr_path = f"qrcodes/{qr_filename}"
    image.save(qr_path)
    
    # Update booking record
    booking.qr_code_path = qr_path
    booking.qr_generated_at = vn_now()
    booking.qr_code = qr_path  # Keep for backward compatibility
    
    db.commit()
    db.refresh(booking)
    
    return {
        "success": True,
        "booking_id": booking.id,
        "qr_code_path": qr_path,
        "qr_url": f"/qrcodes/{qr_filename}",
        "generated_at": booking.qr_generated_at,
    }
