from app.database import SessionLocal
from app.models.models import ParkingLot, ParkingPrice, ParkingSlot, User
from werkzeug.security import generate_password_hash

db = SessionLocal()


def seed_slots():
    first_lot = db.query(ParkingLot).order_by(ParkingLot.id.asc()).first()
    if not first_lot:
        print("No parking lot found for slot seeding")
        return

    for i in range(1, 11):
        code = f"A{i}"
        exists = db.query(ParkingSlot).filter(ParkingSlot.code == code).first()
        if not exists:
            slot = ParkingSlot(
                code=code,
                slot_number=code,
                parking_id=first_lot.id,
                status="available",
            )
            db.add(slot)
        else:
            exists.slot_number = exists.slot_number or code
            if exists.parking_id is None:
                exists.parking_id = first_lot.id

    db.commit()
    print("Seeded slots!")


def seed_default_user():
    accounts = [
        {
            "name": "Demo User",
            "email": "user1@gmail.com",
            "phone": "0900000000",
            "vehicle_plate": "30A-12345",
            "role": "user",
            "password": "123456",
        },
        {
            "name": "Owner One",
            "email": "owner1@gmail.com",
            "phone": "0900000001",
            "vehicle_plate": "59A-88888",
            "role": "owner",
            "password": "123456",
        },
        {
            "name": "Admin One",
            "email": "admin1@gmail.com",
            "phone": "0900000002",
            "vehicle_plate": "51A-99999",
            "role": "admin",
            "password": "123456",
        },
    ]

    for item in accounts:
        user = db.query(User).filter(User.email == item["email"]).first()
        if not user:
            user = User(
                name=item["name"],
                email=item["email"],
                phone=item["phone"],
                vehicle_plate=item["vehicle_plate"],
                role=item["role"],
                is_active=1,
            )
            db.add(user)

        user.name = item["name"]
        user.phone = item["phone"]
        user.vehicle_plate = item["vehicle_plate"]
        user.role = item["role"]
        user.email = item["email"]
        user.password = item["password"]
        user.password_hash = generate_password_hash(item["password"])
        user.status = "active"
        user.is_active = 1

    db.commit()
    print("Seeded default users!")


def seed_parking_lots_and_prices():
    lots = [
        {
            "name": "Bai xe Nguyen Van Sang",
            "address": "Nguyen Van Sang, Tan Phu, TP.HCM",
            "latitude": 10.7915,
            "longitude": 106.6261,
            "has_roof": 1,
            "price_per_hour": 10000,
            "price_per_day": 70000,
            "price_per_month": 1500000,
        },
        {
            "name": "Bai xe Tan Ky Tan Quy",
            "address": "Tan Ky Tan Quy, Tan Phu, TP.HCM",
            "latitude": 10.7932,
            "longitude": 106.6250,
            "has_roof": 0,
            "price_per_hour": 12000,
            "price_per_day": 80000,
            "price_per_month": 1700000,
        },
        {
            "name": "Bai xe Luy Ban Bich",
            "address": "Luy Ban Bich, Tan Phu, TP.HCM",
            "latitude": 10.7818,
            "longitude": 106.6364,
            "has_roof": 1,
            "price_per_hour": 9000,
            "price_per_day": 65000,
            "price_per_month": 1400000,
        },
        {
            "name": "Bai xe Au Co",
            "address": "Au Co, Tan Phu, TP.HCM",
            "latitude": 10.7864,
            "longitude": 106.6402,
            "has_roof": 0,
            "price_per_hour": 11000,
            "price_per_day": 75000,
            "price_per_month": 1600000,
        },
        {
            "name": "Bai xe Truong Chinh",
            "address": "Truong Chinh, Tan Phu, TP.HCM",
            "latitude": 10.8031,
            "longitude": 106.6287,
            "has_roof": 1,
            "price_per_hour": 10000,
            "price_per_day": 72000,
            "price_per_month": 1550000,
        },
    ]

    for item in lots:
        lot = db.query(ParkingLot).filter(ParkingLot.name == item["name"]).first()
        if not lot:
            lot = ParkingLot(
                name=item["name"],
                address=item["address"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                has_roof=item["has_roof"],
                is_active=1,
            )
            db.add(lot)
            db.flush()
        else:
            lot.address = item["address"]
            lot.latitude = item["latitude"]
            lot.longitude = item["longitude"]
            lot.has_roof = item["has_roof"]
            lot.is_active = 1

        price = db.query(ParkingPrice).filter(ParkingPrice.parking_id == lot.id).first()
        if not price:
            price = ParkingPrice(
                parking_id=lot.id,
                price_per_hour=item["price_per_hour"],
                price_per_day=item["price_per_day"],
                price_per_month=item["price_per_month"],
            )
            db.add(price)
        else:
            price.price_per_hour = item["price_per_hour"]
            price.price_per_day = item["price_per_day"]
            price.price_per_month = item["price_per_month"]

    db.commit()
    print("Seeded parking lots and prices!")


if __name__ == "__main__":
    seed_parking_lots_and_prices()
    seed_slots()
    seed_default_user()
