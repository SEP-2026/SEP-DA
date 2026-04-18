from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models.models import Booking, Payment, User, UserVehicle, ParkingLot, Transaction
from app.routes.auth import get_current_user

router = APIRouter(prefix="/owner", tags=["owner"])


@router.get("/customers")
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách khách hàng của bãi mà owner quản lý"""
    
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ owner mới có quyền truy cập"
        )
    
    # Lấy bãi đỗ mà owner quản lý (tạm thời lấy ParkingLot đầu tiên)
    # Trong tương lai sẽ cần lưu relationship giữa Owner và ParkingLot
    parking_lots = db.query(ParkingLot).limit(1).all()
    if not parking_lots:
        return {"customers": []}
    
    parking_lot_ids = [lot.id for lot in parking_lots]
    
    # Lấy danh sách booking của bãi
    bookings = db.query(Booking).filter(
        Booking.parking_lot_id.in_(parking_lot_ids)
    ).all()
    
    # Extract unique users từ bookings
    user_ids = list(set(booking.user_id for booking in bookings if booking.user_id))
    if not user_ids:
        return {"customers": []}
    
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    
    customers = []
    for user in users:
        # Lấy bookings của user
        user_bookings = [b for b in bookings if b.user_id == user.id]
        
        # Tính tổng tiền
        total_amount = sum(b.total_amount or 0 for b in user_bookings)
        
        # Lấy vehicles từ bookings
        vehicles = []
        for booking in user_bookings:
            if booking.slot and booking.slot.slot_number:
                plate = booking.slot.slot_number
                if not any(v["plate"] == plate for v in vehicles):
                    vehicles.append({
                        "plate": plate,
                        "type": "Không xác định",
                        "firstUsed": booking.start_time.isoformat() if booking.start_time else None
                    })
        
        # Lấy transactions liên quan đến user này
        user_transaction_ids = [b.id for b in user_bookings]
        transactions = db.query(Transaction).filter(
            Transaction.booking_id.in_(user_transaction_ids)
        ).all() if user_transaction_ids else []
        
        paid_amount = sum(t.amount for t in transactions if t.payment_status == "paid")
        pending_amount = sum(t.amount for t in transactions if t.payment_status == "pending")
        
        customers.append({
            "id": user.id,
            "name": user.name,
            "phone": user.phone or "Chưa cập nhật",
            "bookings_count": len(user_bookings),
            "total_spent": total_amount,
            "paid_amount": paid_amount,
            "pending_amount": pending_amount,
            "vehicles": vehicles,
            "bookings": [
                {
                    "id": b.id,
                    "code": f"BK-{b.id}",
                    "plate": b.slot.slot_number if b.slot else "N/A",
                    "start_time": b.start_time.isoformat() if b.start_time else None,
                    "end_time": b.expire_time.isoformat() if b.expire_time else None,
                    "price": b.total_amount or 0,
                    "status": b.status,
                }
                for b in user_bookings
            ],
            "transactions": [
                {
                    "id": t.id,
                    "booking_code": f"BK-{t.booking_id}",
                    "method": "VNPay",  # Có thể cập nhật từ Payment model
                    "amount": t.amount,
                    "time": t.created_at.isoformat() if t.created_at else None,
                    "status": t.payment_status,
                }
                for t in transactions
            ]
        })
    
    return {
        "customers": customers,
        "total_count": len(customers)
    }


@router.get("/bootstrap")
def bootstrap_owner_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy dữ liệu bootstrap cho owner dashboard"""
    
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ owner mới có quyền truy cập"
        )
    
    # Lấy ParkingLot (tạm thời lấy cái đầu tiên)
    parking_lot = db.query(ParkingLot).first()
    
    if not parking_lot:
        return {
            "parkingLot": None,
            "slots": [],
            "bookings": [],
            "transactions": [],
            "reviews": [],
            "activities": [],
            "settings": {}
        }
    
    # Lấy bookings
    bookings = db.query(Booking).filter(
        Booking.parking_lot_id == parking_lot.id
    ).all()
    
    # Lấy transactions
    booking_ids = [b.id for b in bookings]
    transactions = db.query(Transaction).filter(
        Transaction.booking_id.in_(booking_ids)
    ).all() if booking_ids else []
    
    return {
        "parkingLot": {
            "id": parking_lot.id,
            "name": parking_lot.name,
            "address": parking_lot.address,
        },
        "slots": [],
        "bookings": [
            {
                "id": b.id,
                "code": f"BK-{b.id}",
                "user": b.user.name if b.user else "Unknown",
                "phone": b.user.phone if b.user else "",
                "plate": b.user.vehicle_plate or "N/A",
                "startTime": b.start_time.isoformat() if b.start_time else None,
                "endTime": b.expire_time.isoformat() if b.expire_time else None,
                "price": b.total_amount or 0,
                "status": b.status,
            }
            for b in bookings
        ],
        "transactions": [
            {
                "id": t.id,
                "bookingCode": f"BK-{t.booking_id}",
                "method": "VNPay",
                "payer": "Unknown",
                "time": t.created_at.isoformat() if t.created_at else None,
                "amount": t.amount,
                "status": t.payment_status,
            }
            for t in transactions
        ],
        "reviews": [],
        "activities": [],
        "settings": {
            "parkingName": parking_lot.name,
            "slotCapacity": "0",
            "pricePerHour": "25000",
            "pricePerDay": "120000",
            "pricePerMonth": "1800000",
        }
    }
