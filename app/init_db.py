import time

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.database import Base, SessionLocal, engine
from app.models import models


def _run_ddl_with_retry(statement: str, retries: int = 3, delay_seconds: float = 0.5) -> bool:
    for attempt in range(retries):
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
            return True
        except OperationalError as exc:
            error_code = getattr(exc.orig, "args", [None])[0] if getattr(exc, "orig", None) else None
            if error_code in {1213, 1205} and attempt < retries - 1:
                time.sleep(delay_seconds)
                continue
            print(f"Skipped migration statement after failure: {statement}")
            return False


def migrate_parking_lots_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "parking_lots" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("parking_lots")}
    alter_statements = []

    if "latitude" not in columns:
        alter_statements.append("ADD COLUMN latitude DECIMAL(10,6)")
    if "longitude" not in columns:
        alter_statements.append("ADD COLUMN longitude DECIMAL(10,6)")
    if "district_id" not in columns:
        alter_statements.append("ADD COLUMN district_id INT NULL")
    if "has_roof" not in columns:
        alter_statements.append("ADD COLUMN has_roof TINYINT(1) NOT NULL DEFAULT 0")
    if "is_active" not in columns:
        alter_statements.append("ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE parking_lots {', '.join(alter_statements)}"))
    if "district_id" in columns or any("district_id" in statement for statement in alter_statements):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE parking_lots MODIFY COLUMN district_id INT NULL"))
def migrate_users_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "users" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    alter_statements = []

    if "full_name" not in columns:
        alter_statements.append("ADD COLUMN full_name VARCHAR(255) NULL")
    if "email" not in columns:
        alter_statements.append("ADD COLUMN email VARCHAR(255) NULL")
    if "password" not in columns:
        alter_statements.append("ADD COLUMN password VARCHAR(255) NULL")
    if "password_hash" not in columns:
        alter_statements.append("ADD COLUMN password_hash VARCHAR(255) NULL")
    if "phone" not in columns:
        alter_statements.append("ADD COLUMN phone VARCHAR(30) NULL")
    if "vehicle_plate" not in columns:
        alter_statements.append("ADD COLUMN vehicle_plate VARCHAR(30) NULL")
    if "vehicle_color" not in columns:
        alter_statements.append("ADD COLUMN vehicle_color VARCHAR(50) NULL")
    if "managed_district_id" not in columns:
        alter_statements.append("ADD COLUMN managed_district_id INT NULL")
    if "is_active" not in columns:
        alter_statements.append("ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")
    if "status" not in columns:
        alter_statements.append("ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE users {', '.join(alter_statements)}"))
    if "managed_district_id" in columns or any("managed_district_id" in statement for statement in alter_statements):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users MODIFY COLUMN managed_district_id INT NULL"))

    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET full_name = COALESCE(full_name, 'Unknown User')"))
        conn.execute(text("UPDATE users SET email = CONCAT('legacy_user_', id, '@local.test') WHERE email IS NULL OR email = ''"))
        conn.execute(text("UPDATE users SET password = COALESCE(password, '123456')"))
        conn.execute(text("UPDATE users SET status = COALESCE(status, 'active')"))
        conn.execute(text("UPDATE users SET is_active = COALESCE(is_active, 1)"))

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "uq_users_email" not in indexes:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX uq_users_email ON users (email)"))


def migrate_districts_normalization():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "districts" not in table_names:
        return

    parking_columns = {column["name"] for column in inspector.get_columns("parking_lots")}
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    has_legacy_parking_district = "district" in parking_columns
    has_legacy_user_managed_district = "managed_district" in user_columns

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT IGNORE INTO districts (name)
                SELECT 'Quận Tân Phú'
                """
            )
        )

        if has_legacy_parking_district:
            conn.execute(
                text(
                    """
                    INSERT IGNORE INTO districts (name)
                    SELECT DISTINCT TRIM(p.district)
                    FROM parking_lots p
                    WHERE p.district IS NOT NULL AND TRIM(p.district) <> ''
                    """
                )
            )

        if has_legacy_user_managed_district:
            conn.execute(
                text(
                    """
                    INSERT IGNORE INTO districts (name)
                    SELECT DISTINCT TRIM(u.managed_district)
                    FROM users u
                    WHERE u.managed_district IS NOT NULL AND TRIM(u.managed_district) <> ''
                    """
                )
            )

        if has_legacy_parking_district:
            conn.execute(
                text(
                    """
                    UPDATE parking_lots p
                    JOIN districts d ON d.name = TRIM(p.district)
                    SET p.district_id = d.id
                    WHERE p.district_id IS NULL
                      AND p.district IS NOT NULL
                      AND TRIM(p.district) <> ''
                    """
                )
            )

        if has_legacy_user_managed_district:
            conn.execute(
                text(
                    """
                    UPDATE users u
                    JOIN districts d ON d.name = TRIM(u.managed_district)
                    SET u.managed_district_id = d.id
                    WHERE u.managed_district_id IS NULL
                      AND u.managed_district IS NOT NULL
                      AND TRIM(u.managed_district) <> ''
                    """
                )
            )

        conn.execute(
            text(
                """
                UPDATE parking_lots p
                JOIN districts d ON d.name = 'Quận Tân Phú'
                SET p.district_id = d.id
                WHERE p.district_id IS NULL
                  AND (
                    LOWER(p.address) LIKE '%tan phu%'
                    OR LOWER(p.name) LIKE '%tan phu%'
                  )
                """
            )
        )

        conn.execute(
            text(
                """
                UPDATE users u
                JOIN districts d ON d.name = 'Quận Tân Phú'
                SET u.managed_district_id = d.id
                WHERE u.managed_district_id IS NULL
                  AND u.role = 'owner'
                """
            )
        )

    fk_checks = []
    with engine.begin() as conn:
        fk_checks = conn.execute(
            text(
                """
                SELECT TABLE_NAME, COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND REFERENCED_TABLE_NAME = 'districts'
                  AND TABLE_NAME IN ('parking_lots', 'users')
                  AND COLUMN_NAME IN ('district_id', 'managed_district_id')
                """
            )
        ).mappings().all()

        has_parking_fk = any(r["TABLE_NAME"] == "parking_lots" and r["COLUMN_NAME"] == "district_id" for r in fk_checks)
        has_user_fk = any(r["TABLE_NAME"] == "users" and r["COLUMN_NAME"] == "managed_district_id" for r in fk_checks)

        if "district_id" in parking_columns and not has_parking_fk:
            conn.execute(
                text(
                    """
                    ALTER TABLE parking_lots
                    ADD CONSTRAINT fk_parking_lots_district_id
                    FOREIGN KEY (district_id) REFERENCES districts(id)
                    """
                )
            )

        if "managed_district_id" in user_columns and not has_user_fk:
            conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD CONSTRAINT fk_users_managed_district_id
                    FOREIGN KEY (managed_district_id) REFERENCES districts(id)
                    """
                )
            )

    # Legacy text columns are removed after data has been migrated to FK columns.
    drop_statements = []
    if "district" in parking_columns:
        drop_statements.append("ALTER TABLE parking_lots DROP COLUMN district")
    if "managed_district" in user_columns:
        drop_statements.append("ALTER TABLE users DROP COLUMN managed_district")

    if drop_statements:
        with engine.begin() as conn:
            for statement in drop_statements:
                conn.execute(text(statement))


def migrate_user_vehicles_table():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "user_vehicles" not in table_names or "users" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("user_vehicles")}
    alter_statements = []

    if "vehicle_color" not in columns:
        alter_statements.append("ADD COLUMN vehicle_color VARCHAR(50) NULL")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE user_vehicles {', '.join(alter_statements)}"))

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO user_vehicles (user_id, license_plate, brand, vehicle_model, seat_count, vehicle_color, created_at, updated_at)
                SELECT u.id, u.vehicle_plate, NULL, NULL, NULL, u.vehicle_color, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM users u
                WHERE (u.vehicle_plate IS NOT NULL OR u.vehicle_color IS NOT NULL)
                  AND NOT EXISTS (
                    SELECT 1 FROM user_vehicles uv WHERE uv.user_id = u.id
                  )
                """
            )
        )


def migrate_parking_slots_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "parking_slots" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("parking_slots")}
    alter_statements = []

    if "code" not in columns:
        alter_statements.append("ADD COLUMN code VARCHAR(50) NULL")
    if "slot_number" not in columns:
        alter_statements.append("ADD COLUMN slot_number VARCHAR(20) NULL")
    if "parking_id" not in columns:
        alter_statements.append("ADD COLUMN parking_id BIGINT NULL")
    if "status" not in columns:
        alter_statements.append("ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'available'")
    if "zone" not in columns:
        alter_statements.append("ADD COLUMN zone VARCHAR(50) NULL")
    if "level" not in columns:
        alter_statements.append("ADD COLUMN level VARCHAR(50) NULL")
    if "created_at" not in columns:
        alter_statements.append("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    if "updated_at" not in columns:
        alter_statements.append("ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE parking_slots {', '.join(alter_statements)}"))

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE parking_slots MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'available'"))
        conn.execute(
            text(
                """
                ALTER TABLE parking_slots
                MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """
            )
        )

    indexes = {index["name"] for index in inspector.get_indexes("parking_slots")}
    if "uq_parking_slots_code" not in indexes:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX uq_parking_slots_code ON parking_slots (code)"))

    session = SessionLocal()
    try:
        slots = (
            session.query(models.ParkingSlot)
            .order_by(models.ParkingSlot.parking_id.asc(), models.ParkingSlot.id.asc())
            .all()
        )
        current_parking_id = None
        lot_index = -1
        for slot in slots:
            if slot.parking_id != current_parking_id:
                current_parking_id = slot.parking_id
                lot_index = 0
            else:
                lot_index += 1

            if not slot.zone:
                slot.zone = f"Khu {chr(65 + (lot_index % 4))}"
            if not slot.level:
                slot.level = f"Tầng {(lot_index // 20) + 1}"
            if not slot.created_at:
                slot.created_at = slot.updated_at
        session.commit()
    finally:
        session.close()


def migrate_reviews_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "reviews" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("reviews")}
    alter_statements = []

    if "owner_reply" not in columns:
        alter_statements.append("ADD COLUMN owner_reply TEXT NULL")
    if "owner_replied_at" not in columns:
        alter_statements.append("ADD COLUMN owner_replied_at DATETIME NULL")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE reviews {', '.join(alter_statements)}"))


def migrate_bookings_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "bookings" not in table_names:
        return

    columns = {column["name"]: column for column in inspector.get_columns("bookings")}
    alter_statements = []

    if "booking_mode" not in columns:
        alter_statements.append("ADD COLUMN booking_mode VARCHAR(20) NOT NULL DEFAULT 'hourly'")
    if "billed_units" not in columns:
        alter_statements.append("ADD COLUMN billed_units FLOAT NOT NULL DEFAULT 0")
    if "total_amount" not in columns:
        alter_statements.append("ADD COLUMN total_amount FLOAT NOT NULL DEFAULT 0")
    if "created_at" not in columns:
        alter_statements.append("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")

    if alter_statements:
        _run_ddl_with_retry(f"ALTER TABLE bookings {', '.join(alter_statements)}")

    # Ho tro day du trang thai booking cho luong payment moi.
    booking_vehicle_column = columns.get("vehicle_id")
    if booking_vehicle_column is not None and not booking_vehicle_column["nullable"]:
        _run_ddl_with_retry("ALTER TABLE bookings MODIFY COLUMN vehicle_id INT NULL")

    booking_parking_column = columns.get("parking_id")
    if booking_parking_column is not None and not booking_parking_column["nullable"]:
        _run_ddl_with_retry("ALTER TABLE bookings MODIFY COLUMN parking_id INT NULL")

    booking_status_column = columns.get("status")
    current_status_type = str(booking_status_column["type"]).lower() if booking_status_column is not None else ""
    if "enum" not in current_status_type:
        _run_ddl_with_retry(
            """
            ALTER TABLE bookings
            MODIFY COLUMN status ENUM(
                'pending','booked','checked_in','checked_out','completed','cancelled'
            ) DEFAULT 'pending'
            """.strip()
        )


def migrate_payments_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "payments" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("payments")}
    alter_statements = []

    if "amount" not in columns:
        alter_statements.append("ADD COLUMN amount FLOAT NOT NULL DEFAULT 0")
    if "overtime_fee" not in columns:
        alter_statements.append("ADD COLUMN overtime_fee FLOAT NOT NULL DEFAULT 0")
    if "payment_method" not in columns:
        alter_statements.append("ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'vnpay'")
    if "payment_status" not in columns:
        alter_statements.append("ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'")
    if "paid_at" not in columns:
        alter_statements.append("ADD COLUMN paid_at DATETIME NULL")
    if "vnpay_url" not in columns:
        alter_statements.append("ADD COLUMN vnpay_url VARCHAR(500) NULL")
    if "qr_code" not in columns:
        alter_statements.append("ADD COLUMN qr_code VARCHAR(255) NULL")
    if "created_at" not in columns:
        alter_statements.append("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE payments {', '.join(alter_statements)}"))

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE payments
                MODIFY COLUMN payment_method ENUM('qr','cash','vnpay') DEFAULT 'vnpay'
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE payments
                MODIFY COLUMN payment_status ENUM('pending','paid','failed') DEFAULT 'pending'
                """
            )
        )

    indexes = {index["name"] for index in inspector.get_indexes("payments")}
    if "uq_payments_booking_id" not in indexes:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX uq_payments_booking_id ON payments (booking_id)"))


def init_db():
    Base.metadata.create_all(bind=engine)
    migrate_parking_lots_columns()
    migrate_users_columns()
    migrate_districts_normalization()
    migrate_user_vehicles_table()
    migrate_parking_slots_columns()
    migrate_reviews_columns()
    migrate_bookings_columns()
    migrate_payments_columns()


if __name__ == "__main__":
    init_db()
