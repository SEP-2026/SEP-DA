from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models.models import Booking, Payment, User, UserVehicle, ParkingLot, Transaction, OwnerParking, ParkingSlot
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
    
    # Lấy các bãi đỗ mà owner quản lý từ bảng owner_parking
    owner_parkings = db.query(OwnerParking).filter(
        OwnerParking.owner_id == current_user.id
    ).all()
    
    if not owner_parkings:
        return {"customers": [], "total_count": 0}
    
    parking_lot_ids = [op.parking_id for op in owner_parkings]
    
    # Lấy danh sách booking của các bãi này
    bookings = db.query(Booking).filter(
        Booking.parking_lot_id.in_(parking_lot_ids)
    ).all()
    
    # Extract unique users từ bookings
    user_ids = list(set(booking.user_id for booking in bookings if booking.user_id))
    if not user_ids:
        return {"customers": [], "total_count": 0}
    
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    
    customers = []
    for user in users:
        # Lấy bookings của user
        user_bookings = [b for b in bookings if b.user_id == user.id]
        
        # Tính tổng tiền
        total_amount = sum(b.total_amount or 0 for b in user_bookings)
        
        # Lấy vehicles từ user_vehicles table
        user_vehicles = db.query(UserVehicle).filter(
            UserVehicle.user_id == user.id
        ).all()
        
        vehicles = []
        if user_vehicles:
            # Nếu có thông tin xe trong user_vehicles
            for vehicle in user_vehicles:
                vehicles.append({
                    "plate": vehicle.license_plate or "N/A",
                    "type": f"{vehicle.brand} {vehicle.vehicle_model}".strip() if vehicle.brand or vehicle.vehicle_model else "Không xác định",
                    "firstUsed": min([b.start_time.isoformat() for b in user_bookings if b.start_time], default=None)
                })
        else:
            # Fallback: lấy từ booking
            for booking in user_bookings:
                if booking.slot and booking.slot.slot_number:
                    plate = booking.slot.slot_number
                    if not any(v["plate"] == plate for v in vehicles):
                        vehicles.append({
                            "plate": plate,
                            "type": "Không xác định",
                            "firstUsed": booking.start_time.isoformat() if booking.start_time else None
                        })
        
        # Lấy transactions liên quan đến bookings này
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
                    "plate": b.user.vehicle_plate if b.user else "N/A",
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
                    "method": "VNPay",
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


@router.post("/seed-test-data-public")
def seed_test_data_public(db: Session = Depends(get_db)):
    """Tạo dữ liệu test (public endpoint - không cần xác thực)"""
    
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
                is_active=1
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
                    slot_number=code,
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
                    is_active=1
                )
                db.add(user)
                db.commit()
                customer_users.append(user)
            else:
                customer_users.append(existing)
        
        # 6. Tạo bookings
        now = datetime.utcnow()
        for i, user in enumerate(customer_users):
            # Kiểm tra xem user này đã có booking chưa
            existing_booking = db.query(Booking).filter(
                Booking.user_id == user.id,
                Booking.parking_lot_id == parking_lot.id
            ).first()
            
            if not existing_booking:
                slot = db.query(ParkingSlot).filter(
                    ParkingSlot.code == slot_codes[i % len(slot_codes)]
                ).first()
                
                booking = Booking(
                    user_id=user.id,
                    parking_lot_id=parking_lot.id,
                    slot_id=slot.id if slot else None,
                    start_time=now - timedelta(hours=2),
                    expire_time=now + timedelta(hours=1),
                    total_amount=50000 * (i + 1),
                    status="completed" if i % 2 == 0 else "in_progress",
                    booking_mode="hourly"
                )
                db.add(booking)
                db.commit()
                
                # 7. Tạo transaction
                transaction = Transaction(
                    booking_id=booking.id,
                    amount=50000 * (i + 1),
                    payment_status="paid" if i % 2 == 0 else "pending",
                    created_at=now - timedelta(hours=1)
                )
                db.add(transaction)
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


@router.post("/seed-test-data")
def seed_test_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo dữ liệu test cho owner (chỉ dùng cho development)"""
    
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ owner mới có quyền truy cập"
        )
    
    try:
        # 1. Tạo parking lot nếu chưa tồn tại
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
        
        # 2. Gán bãi cho owner nếu chưa tồn tại
        owner_parking = db.query(OwnerParking).filter(
            OwnerParking.owner_id == current_user.id,
            OwnerParking.parking_id == parking_lot.id
        ).first()
        
        if not owner_parking:
            owner_parking = OwnerParking(
                owner_id=current_user.id,
                parking_id=parking_lot.id
            )
            db.add(owner_parking)
            db.commit()
        
        # 3. Tạo parking slots
        slot_codes = ["A-01", "A-02", "B-01", "B-02", "C-01"]
        for code in slot_codes:
            existing = db.query(ParkingSlot).filter(
                ParkingSlot.code == code
            ).first()
            if not existing:
                slot = ParkingSlot(
                    parking_id=parking_lot.id,
                    slot_number=code,
                    code=code,
                    status="available"
                )
                db.add(slot)
        db.commit()
        
        # 4. Tạo test users (khách hàng) nếu chưa tồn tại
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
                    is_active=1
                )
                db.add(user)
                db.commit()
                customer_users.append(user)
            else:
                customer_users.append(existing)
        
        # 5. Tạo bookings
        now = datetime.utcnow()
        for i, user in enumerate(customer_users):
            # Kiểm tra xem user này đã có booking chưa
            existing_booking = db.query(Booking).filter(
                Booking.user_id == user.id,
                Booking.parking_lot_id == parking_lot.id
            ).first()
            
            if not existing_booking:
                slot = db.query(ParkingSlot).filter(
                    ParkingSlot.code == slot_codes[i % len(slot_codes)]
                ).first()
                
                booking = Booking(
                    user_id=user.id,
                    parking_lot_id=parking_lot.id,
                    slot_id=slot.id if slot else None,
                    start_time=now - timedelta(hours=2),
                    expire_time=now + timedelta(hours=1),
                    total_amount=50000 * (i + 1),
                    status="completed" if i % 2 == 0 else "in_progress",
                    booking_mode="hourly"
                )
                db.add(booking)
                db.commit()
                
                # 6. Tạo transaction
                transaction = Transaction(
                    booking_id=booking.id,
                    amount=50000 * (i + 1),
                    payment_status="paid" if i % 2 == 0 else "pending",
                    created_at=now - timedelta(hours=1)
                )
                db.add(transaction)
                db.commit()
        
        return {
            "status": "success",
            "message": "Dữ liệu test đã được tạo",
            "parking_lot": {
                "id": parking_lot.id,
                "name": parking_lot.name
            },
            "customers_created": len(customer_users)
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tạo dữ liệu test: {str(e)}"
        )
