from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column("full_name", String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    password = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)
    phone = Column(String(30))
    vehicle_plate = Column(String(30), nullable=True)
    vehicle_color = Column(String(50), nullable=True)
    role = Column(String(50), default="user")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="active")
    is_active = Column(Integer, default=1)
    vehicle_profile = relationship("UserVehicle", back_populates="user", uselist=False)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class UserVehicle(Base):
    __tablename__ = "user_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    license_plate = Column(String(30), nullable=True)
    brand = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    seat_count = Column(Integer, nullable=True)
    vehicle_color = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="vehicle_profile")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"

    id = Column(Integer, primary_key=True, index=True)
    parking_id = Column(Integer, nullable=True)
    slot_number = Column(String(20), nullable=True)
    code = Column(String(50), unique=True)
    status = Column(String(50), default="available")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))
    vehicle_id = Column(Integer, nullable=True)
    parking_id = Column(Integer, nullable=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"))
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True)

    start_time = Column("checkin_time", DateTime, default=datetime.utcnow)
    expire_time = Column("checkout_time", DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    booking_mode = Column(String(20), default="hourly")
    billed_units = Column(Float, default=0)
    total_amount = Column(Float, default=0)

    status = Column(String(50), default="pending")
    qr_code = Column(String(255))

    user = relationship("User")
    slot = relationship("ParkingSlot")
    parking_lot = relationship("ParkingLot")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    booking_id = Column(Integer, ForeignKey("bookings.id"))

    amount = Column(Float)
    payment_status = Column(String(50), default="pending")

    created_at = Column(DateTime, default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)

    amount = Column(Float, nullable=False)
    overtime_fee = Column(Float, default=0)
    payment_method = Column(String(50), default="vnpay")
    payment_status = Column(String(20), default="pending")
    paid_at = Column(DateTime, nullable=True)
    vnpay_url = Column(String(500), nullable=True)
    qr_code = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    has_roof = Column(Integer, default=0)
    is_active = Column(Integer, default=1)


class ParkingPrice(Base):
    __tablename__ = "parking_prices"

    id = Column(Integer, primary_key=True, index=True)
    parking_id = Column(Integer, ForeignKey("parking_lots.id"), unique=True, nullable=False)
    price_per_hour = Column(Float, nullable=False)
    price_per_day = Column(Float, nullable=False)
    price_per_month = Column(Float, nullable=False)

    parking = relationship("ParkingLot")


class OwnerParking(Base):
    __tablename__ = "owner_parking"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    parking_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)

    owner = relationship("User")
    parking_lot = relationship("ParkingLot")


class ParkingLotOperational(Base):
    __tablename__ = "parking_lot_operational"

    id = Column(Integer, primary_key=True, index=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), unique=True, nullable=False, index=True)
    total_slots = Column(Integer, nullable=False, default=0)
    occupied_slots = Column(Integer, nullable=False, default=0)
    empty_slots = Column(Integer, nullable=False, default=0)
    status = Column(String(20), default="open")
    revenue_today = Column(Float, default=0)
    revenue_month = Column(Float, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parking_lot = relationship("ParkingLot")


class EmployeeVehicle(Base):
    __tablename__ = "employee_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    license_plate = Column(String(30), nullable=False, index=True)
    check_in_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    check_out_time = Column(DateTime, nullable=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    status = Column(String(20), default="parked")
    fee_amount = Column(Float, default=0)
    qr_data = Column(Text, nullable=True)

    parking_lot = relationship("ParkingLot")
    employee = relationship("User")
    booking = relationship("Booking")


class EmployeeActivity(Base):
    __tablename__ = "employee_activities"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    parking_lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    detail = Column(Text, nullable=True)
    vehicle_id = Column(Integer, ForeignKey("employee_vehicles.id"), nullable=True, index=True)
    amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employee = relationship("User")
    parking_lot = relationship("ParkingLot")
    vehicle = relationship("EmployeeVehicle")
