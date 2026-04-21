from app.database import SessionLocal
from app.models.models import District, OwnerParking, ParkingLot, ParkingPrice, ParkingSlot, User, UserVehicle
from werkzeug.security import generate_password_hash

db = SessionLocal()


def seed_districts() -> dict[str, int]:
    district_names = [
        "Quận 1",
        "Quận 3",
        "Quận Tân Phú",
    ]

    for name in district_names:
        district = db.query(District).filter(District.name == name).first()
        if not district:
            db.add(District(name=name))

    db.commit()

    districts = db.query(District).all()
    return {item.name: item.id for item in districts}


def seed_slots():
    parking_lots = db.query(ParkingLot).order_by(ParkingLot.id.asc()).all()
    if not parking_lots:
        print("No parking lot found for slot seeding")
        return

    for lot in parking_lots:
        for i in range(1, 11):
            code = f"A{i}"
            exists = (
                db.query(ParkingSlot)
                .filter(
                    ParkingSlot.parking_id == lot.id,
                    ParkingSlot.slot_number == code,
                )
                .first()
            )
            if not exists:
                slot = ParkingSlot(
                    code=f"{lot.id}-{code}",
                    slot_number=code,
                    parking_id=lot.id,
                    status="available",
                )
                db.add(slot)
            else:
                exists.code = f"{lot.id}-{code}"
                exists.slot_number = code
                exists.parking_id = lot.id

    db.commit()
    print("Seeded slots!")


def seed_default_user(district_map: dict[str, int]):
    accounts = [
        {
            "name": "Demo User",
            "email": "user1@gmail.com",
            "phone": "0900000000",
            "vehicle_plate": "30A-12345",
            "vehicle_color": "Đen",
            "brand": "VinFast",
            "vehicle_model": "VF e34",
            "seat_count": 5,
            "role": "user",
            "password": "123456",
        },
        {
            "name": "Owner One",
            "email": "owner1@gmail.com",
            "phone": "0900000001",
            "vehicle_plate": "59A-88888",
            "vehicle_color": "Trắng",
            "managed_district_name": "Quận Tân Phú",
            "brand": "Toyota",
            "vehicle_model": "Vios",
            "seat_count": 5,
            "role": "owner",
            "password": "123456",
        },
        {
            "name": "Owner Quan 1",
            "email": "owner2@gmail.com",
            "phone": "0900000003",
            "vehicle_plate": "51H-12345",
            "vehicle_color": "Bạc",
            "managed_district_name": "Quận 1",
            "brand": "Hyundai",
            "vehicle_model": "Accent",
            "seat_count": 5,
            "role": "owner",
            "password": "123456",
        },
        {
            "name": "Owner Quan 3",
            "email": "owner3@gmail.com",
            "phone": "0900000004",
            "vehicle_plate": "59K-67890",
            "vehicle_color": "Xám",
            "managed_district_name": "Quận 3",
            "brand": "Mazda",
            "vehicle_model": "Mazda3",
            "seat_count": 5,
            "role": "owner",
            "password": "123456",
        },
        {
            "name": "Admin One",
            "email": "admin1@gmail.com",
            "phone": "0900000002",
            "vehicle_plate": "51A-99999",
            "vehicle_color": "Xanh",
            "brand": "Kia",
            "vehicle_model": "Morning",
            "seat_count": 4,
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
                vehicle_color=item["vehicle_color"],
                managed_district_id=district_map.get(item.get("managed_district_name", "")),
                role=item["role"],
                is_active=1,
            )
            db.add(user)

        user.name = item["name"]
        user.phone = item["phone"]
        user.vehicle_plate = item["vehicle_plate"]
        user.vehicle_color = item["vehicle_color"]
        user.managed_district_id = district_map.get(item.get("managed_district_name", ""))
        user.role = item["role"]
        user.email = item["email"]
        user.password = item["password"]
        user.password_hash = generate_password_hash(item["password"])
        user.status = "active"
        user.is_active = 1

        db.flush()
        vehicle = db.query(UserVehicle).filter(UserVehicle.user_id == user.id).first()
        if not vehicle:
            vehicle = UserVehicle(user_id=user.id)
            db.add(vehicle)

        vehicle.license_plate = item["vehicle_plate"]
        vehicle.vehicle_color = item["vehicle_color"]
        vehicle.brand = item["brand"]
        vehicle.vehicle_model = item["vehicle_model"]
        vehicle.seat_count = item["seat_count"]

    db.commit()
    print("Seeded default users!")


def seed_parking_lots_and_prices(district_map: dict[str, int]):
    lots = [
        {
            "name": "Bai xe Tao Dan",
            "address": "Cong vien Tao Dan, Quan 1, TP.HCM",
            "district_name": "Quận 1",
            "latitude": 10.7734,
            "longitude": 106.6917,
            "has_roof": 1,
            "price_per_hour": 15000,
            "price_per_day": 90000,
            "price_per_month": 2200000,
        },
        {
            "name": "Ham Vincom Dong Khoi",
            "address": "72 Le Thanh Ton, Quan 1, TP.HCM",
            "district_name": "Quận 1",
            "latitude": 10.7785,
            "longitude": 106.7027,
            "has_roof": 1,
            "price_per_hour": 18000,
            "price_per_day": 110000,
            "price_per_month": 2500000,
        },
        {
            "name": "Bai xe Nguyen Binh Khiem",
            "address": "32 Nguyen Binh Khiem, Quan 1, TP.HCM",
            "district_name": "Quận 1",
            "latitude": 10.7871,
            "longitude": 106.7044,
            "has_roof": 0,
            "price_per_hour": 14000,
            "price_per_day": 85000,
            "price_per_month": 2100000,
        },
        {
            "name": "Bai xe Vo Van Tan",
            "address": "Vo Van Tan, Quan 3, TP.HCM",
            "district_name": "Quận 3",
            "latitude": 10.7788,
            "longitude": 106.6856,
            "has_roof": 1,
            "price_per_hour": 13000,
            "price_per_day": 85000,
            "price_per_month": 1900000,
        },
        {
            "name": "Bai xe Cach Mang Thang 8",
            "address": "Cach Mang Thang 8, Quan 3, TP.HCM",
            "district_name": "Quận 3",
            "latitude": 10.7797,
            "longitude": 106.6809,
            "has_roof": 0,
            "price_per_hour": 12000,
            "price_per_day": 80000,
            "price_per_month": 1800000,
        },
        {
            "name": "Bai xe Ho Xuan Huong",
            "address": "Ho Xuan Huong, Quan 3, TP.HCM",
            "district_name": "Quận 3",
            "latitude": 10.7811,
            "longitude": 106.6843,
            "has_roof": 1,
            "price_per_hour": 14000,
            "price_per_day": 88000,
            "price_per_month": 2000000,
        },
        {
            "name": "Bai xe Nguyen Van Sang",
            "address": "Nguyen Van Sang, Tan Phu, TP.HCM",
            "district_name": "Quận Tân Phú",
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
            "district_name": "Quận Tân Phú",
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
            "district_name": "Quận Tân Phú",
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
            "district_name": "Quận Tân Phú",
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
            "district_name": "Quận Tân Phú",
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
                district_id=district_map.get(item["district_name"]),
                latitude=item["latitude"],
                longitude=item["longitude"],
                has_roof=item["has_roof"],
                is_active=1,
            )
            db.add(lot)
            db.flush()
        else:
            lot.address = item["address"]
            lot.district_id = district_map.get(item["district_name"])
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


def seed_owner_parking_assignments():
    owners = (
        db.query(User)
        .filter(User.role == "owner")
        .order_by(User.id.asc())
        .all()
    )

    for owner in owners:
        if owner.managed_district_id is None:
            continue

        district_lots = (
            db.query(ParkingLot)
            .filter(
                ParkingLot.district_id == owner.managed_district_id,
                ParkingLot.is_active == 1,
            )
            .order_by(ParkingLot.id.asc())
            .all()
        )

        expected_parking_ids = {int(lot.id) for lot in district_lots}
        for lot in district_lots:
            exists = (
                db.query(OwnerParking)
                .filter(
                    OwnerParking.owner_id == owner.id,
                    OwnerParking.parking_id == lot.id,
                )
                .first()
            )
            if not exists:
                db.add(OwnerParking(owner_id=owner.id, parking_id=lot.id))

        existing_assignments = db.query(OwnerParking).filter(OwnerParking.owner_id == owner.id).all()
        for assignment in existing_assignments:
            if int(assignment.parking_id) not in expected_parking_ids:
                db.delete(assignment)

    db.commit()
    print("Seeded owner parking assignments!")


if __name__ == "__main__":
    district_map = seed_districts()
    seed_parking_lots_and_prices(district_map)
    seed_slots()
    seed_default_user(district_map)
    seed_owner_parking_assignments()
