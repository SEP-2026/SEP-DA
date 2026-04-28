import os
import sys
from datetime import datetime, timedelta

# Ensure project root is on PYTHONPATH so `app` package can be imported.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.init_db import init_db
from app.database import SessionLocal, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, ParkingLot, ParkingSlot, Booking
from app.services.auto_checkout_service import auto_checkout_expired_bookings


def setup_test_data(db):
    # Create minimal user, parking lot, slot
    user = User(name="Test User", email="test_auto_cancel@example.com")
    db.add(user)
    db.commit()
    db.refresh(user)

    lot = ParkingLot(name="Test Lot", address="Test Addr", latitude=10.0, longitude=10.0)
    db.add(lot)
    db.commit()
    db.refresh(lot)

    slot = ParkingSlot(parking_id=lot.id, code="SLOT-1", status="reserved")
    db.add(slot)
    db.commit()
    db.refresh(slot)

    now = datetime.utcnow()
    duration = timedelta(minutes=60)
    # start_time 40% into the past so elapsed >= 30%
    start_time = now - timedelta(minutes=int(duration.total_seconds() / 60 * 0.4))
    expire_time = start_time + duration

    booking = Booking(
        user_id=user.id,
        parking_id=lot.id,
        slot_id=slot.id,
        start_time=start_time,
        expire_time=expire_time,
        status="booked",
        total_amount=0,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking, now


if __name__ == "__main__":
    print("Init DB (may create tables)...")
    # Try regular init (connect to configured DB). If it fails (no DB available),
    # fall back to an in-memory SQLite for local testing.
    try:
        init_db()
        db = SessionLocal()
    except Exception as exc:
        print("Falling back to in-memory SQLite for test (init_db failed):", exc)
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        TestSession = sessionmaker(bind=engine)
        db = TestSession()
    try:
        booking, now = setup_test_data(db)
        print(f"Created booking id={booking.id} start_time={booking.start_time} expire_time={booking.expire_time} status={booking.status}")

        processed = auto_checkout_expired_bookings(db, now=now)
        print(f"auto_checkout_expired_bookings processed: {processed}")

        db.expire_all()
        b = db.query(Booking).filter(Booking.id == booking.id).first()
        print(f"Booking after run: id={b.id} status={b.status} cancel_reason={b.cancel_reason} last_gate_action={b.last_gate_action}")
    finally:
        db.close()
