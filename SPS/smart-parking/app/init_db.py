from sqlalchemy import inspect, text

from app.database import engine, Base
from app.models import models


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
    if "has_roof" not in columns:
        alter_statements.append("ADD COLUMN has_roof TINYINT(1) NOT NULL DEFAULT 0")
    if "is_active" not in columns:
        alter_statements.append("ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE parking_lots {', '.join(alter_statements)}"))


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
    if "username" not in columns:
        alter_statements.append("ADD COLUMN username VARCHAR(100) NULL")
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
    if "owner_id" not in columns:
        alter_statements.append("ADD COLUMN owner_id BIGINT NULL")
    if "parking_lot_id" not in columns:
        alter_statements.append("ADD COLUMN parking_lot_id BIGINT NULL")
    if "created_at" not in columns:
        alter_statements.append("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    if "is_active" not in columns:
        alter_statements.append("ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")
    if "status" not in columns:
        alter_statements.append("ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'")

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE users {', '.join(alter_statements)}"))

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
    if "uq_users_username" not in indexes:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX uq_users_username ON users (username)"))


def migrate_employee_operational_tables():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "parking_lot_operational" in table_names:
        columns = {column["name"] for column in inspector.get_columns("parking_lot_operational")}
        alter_statements = []
        if "status" not in columns:
            alter_statements.append("ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open'")
        if "revenue_today" not in columns:
            alter_statements.append("ADD COLUMN revenue_today FLOAT NOT NULL DEFAULT 0")
        if "revenue_month" not in columns:
            alter_statements.append("ADD COLUMN revenue_month FLOAT NOT NULL DEFAULT 0")
        if "updated_at" not in columns:
            alter_statements.append("ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
        if alter_statements:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE parking_lot_operational {', '.join(alter_statements)}"))

    # Seed or refresh operational rows based on parking_lots + parking_slots.
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO parking_lot_operational (
                    parking_lot_id, total_slots, occupied_slots, empty_slots, status, revenue_today, revenue_month, updated_at
                )
                SELECT
                    p.id,
                    COUNT(s.id) AS total_slots,
                    SUM(CASE WHEN s.status IN ('occupied', 'in_use') THEN 1 ELSE 0 END) AS occupied_slots,
                    GREATEST(
                        COUNT(s.id) - SUM(CASE WHEN s.status IN ('occupied', 'in_use') THEN 1 ELSE 0 END),
                        0
                    ) AS empty_slots,
                    'open' AS status,
                    0 AS revenue_today,
                    0 AS revenue_month,
                    CURRENT_TIMESTAMP AS updated_at
                FROM parking_lots p
                LEFT JOIN parking_slots s ON s.parking_id = p.id
                GROUP BY p.id
                ON DUPLICATE KEY UPDATE
                    total_slots = VALUES(total_slots),
                    occupied_slots = LEAST(occupied_slots, VALUES(total_slots)),
                    empty_slots = GREATEST(VALUES(total_slots) - LEAST(occupied_slots, VALUES(total_slots)), 0),
                    updated_at = CURRENT_TIMESTAMP
                """
            )
        )


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

    if alter_statements:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE parking_slots {', '.join(alter_statements)}"))

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE parking_slots MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'available'"))

    indexes = {index["name"] for index in inspector.get_indexes("parking_slots")}
    if "uq_parking_slots_code" not in indexes:
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX uq_parking_slots_code ON parking_slots (code)"))


def migrate_bookings_columns():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "bookings" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("bookings")}
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
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE bookings {', '.join(alter_statements)}"))

    # Ho tro day du trang thai booking cho luong payment moi.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE bookings MODIFY COLUMN vehicle_id INT NULL"))
        conn.execute(text("ALTER TABLE bookings MODIFY COLUMN parking_id INT NULL"))
        conn.execute(
            text(
                """
                ALTER TABLE bookings
                MODIFY COLUMN status ENUM(
                    'pending','booked','checked_in','checked_out','completed','cancelled'
                ) DEFAULT 'pending'
                """
            )
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
    migrate_user_vehicles_table()
    migrate_parking_slots_columns()
    migrate_bookings_columns()
    migrate_payments_columns()
    migrate_employee_operational_tables()


if __name__ == "__main__":
    init_db()
