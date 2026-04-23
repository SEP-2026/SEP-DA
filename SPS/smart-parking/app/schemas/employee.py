from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class OwnerCreateEmployeeRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)
    parking_lot_id: int = Field(gt=0)


class EmployeePublicInfo(BaseModel):
    id: int
    username: str
    role: str
    owner_id: int
    parking_lot_id: int
    created_at: datetime | None = None


class OwnerCreateEmployeeResponse(BaseModel):
    message: str
    employee: EmployeePublicInfo


class EmployeeLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)


class EmployeeLoginResponse(BaseModel):
    message: str
    token: str
    token_type: str = "bearer"
    expires_in: int
    user: EmployeePublicInfo


class EmployeeParkingLotResponse(BaseModel):
    id: int
    name: str
    total_slots: int
    occupied_slots: int
    empty_slots: int
    status: str
    revenue_today: float
    revenue_month: float
    updated_at: datetime | None = None


class EmployeeCheckInRequest(BaseModel):
    qr_data: str = Field(min_length=1, max_length=1024)


class EmployeeCheckOutRequest(BaseModel):
    qr_data: str = Field(min_length=1, max_length=1024)


class EmployeeCheckInOutResponse(BaseModel):
    message: str
    vehicle_id: int
    license_plate: str
    parking_lot_id: int
    status: str
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    fee_amount: float | None = None


class EmployeeVehicleItem(BaseModel):
    id: int
    license_plate: str
    check_in_time: datetime
    check_out_time: datetime | None = None
    status: str


class EmployeeVehiclesResponse(BaseModel):
    vehicles: list[EmployeeVehicleItem]
    total_count: int


class EmployeeUpdateStatusRequest(BaseModel):
    status: Literal["open", "closed", "full"]


class EmployeeRevenueResponse(BaseModel):
    revenue_today: float
    revenue_month: float


class EmployeeProfileResponse(BaseModel):
    employee: EmployeePublicInfo
    parking_lot: EmployeeParkingLotResponse


class EmployeeHistoryItem(BaseModel):
    id: int
    action: str
    detail: str | None = None
    amount: float | None = None
    created_at: datetime


class EmployeeHistoryResponse(BaseModel):
    history: list[EmployeeHistoryItem]
    total_count: int
