from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, UserVehicle
from app.routes.auth import get_current_user

router = APIRouter(prefix="/vehicle", tags=["vehicle"])


class VehicleProfilePayload(BaseModel):
    license_plate: str | None = Field(default=None, max_length=30)
    brand: str | None = Field(default=None, max_length=100)
    vehicle_model: str | None = Field(default=None, max_length=100)
    seat_count: int | None = Field(default=None, ge=1, le=99)
    vehicle_color: str | None = Field(default=None, max_length=50)


def _serialize_vehicle(vehicle: UserVehicle | None, user: User) -> dict:
    return {
        "license_plate": vehicle.license_plate if vehicle else user.vehicle_plate,
        "brand": vehicle.brand if vehicle else None,
        "vehicle_model": vehicle.vehicle_model if vehicle else None,
        "seat_count": vehicle.seat_count if vehicle else None,
        "vehicle_color": vehicle.vehicle_color if vehicle else user.vehicle_color,
    }


@router.get("/my")
def get_my_vehicle_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vehicle = db.query(UserVehicle).filter(UserVehicle.user_id == current_user.id).first()
    return {
        "user_id": current_user.id,
        "vehicle": _serialize_vehicle(vehicle, current_user),
    }


@router.post("/my/save")
def save_my_vehicle_profile(
    payload: VehicleProfilePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

    vehicle = db.query(UserVehicle).filter(UserVehicle.user_id == user.id).with_for_update().first()
    if not vehicle:
        vehicle = UserVehicle(user_id=user.id)
        db.add(vehicle)

    if payload.license_plate is not None:
        license_plate = payload.license_plate.strip().upper()
        vehicle.license_plate = license_plate or None
        user.vehicle_plate = license_plate or None

    if payload.brand is not None:
        brand = payload.brand.strip()
        vehicle.brand = brand or None

    if payload.vehicle_model is not None:
        vehicle_model = payload.vehicle_model.strip()
        vehicle.vehicle_model = vehicle_model or None

    if payload.seat_count is not None:
        vehicle.seat_count = payload.seat_count

    if payload.vehicle_color is not None:
        vehicle_color = payload.vehicle_color.strip()
        vehicle.vehicle_color = vehicle_color or None
        user.vehicle_color = vehicle_color or None

    db.commit()
    db.refresh(user)
    db.refresh(vehicle)

    return {
        "message": "Lưu thông tin xe thành công",
        "user_id": user.id,
        "vehicle": _serialize_vehicle(vehicle, user),
    }
