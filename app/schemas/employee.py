from datetime import datetime

from pydantic import BaseModel, Field


class EmployeeLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=255)


class EmployeeInfo(BaseModel):
    id: int
    username: str
    role: str = "employee"
    owner_id: int
    parking_id: int
    status: str
    created_at: datetime | None = None


class EmployeeLoginResponse(BaseModel):
    message: str
    token: str
    token_type: str = "bearer"
    expires_in: int
    user: EmployeeInfo


class OwnerCreateEmployeeRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    username: str | None = Field(default=None, min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=255)
    parking_id: int = Field(gt=0)


class OwnerEmployeeItem(BaseModel):
    id: int
    user_id: int | None = None
    username: str
    email: str | None = None
    full_name: str | None = None
    phone: str | None = None
    role: str = "employee"
    owner_id: int
    parking_id: int
    parking_name: str | None = None
    status: str
    created_at: datetime | None = None


class OwnerEmployeeListResponse(BaseModel):
    employees: list[OwnerEmployeeItem]
    total_count: int


class EmployeeParkingOverview(BaseModel):
    parking_id: int
    parking_name: str
    address: str
    totalSlots: int
    occupiedSlots: int
    emptySlots: int
    status: str


class EmployeeProfileResponse(BaseModel):
    employee: EmployeeInfo
    parking_lot: EmployeeParkingOverview


class EmployeeVehicleItem(BaseModel):
    booking_id: int
    license_plate: str | None = None
    check_in_time: datetime | None = None
    status: str
    slot_code: str | None = None


class EmployeeVehicleResponse(BaseModel):
    vehicles: list[EmployeeVehicleItem]
    total_count: int


class EmployeeRevenuePoint(BaseModel):
    label: str
    amount: float


class EmployeeTrafficPoint(BaseModel):
    label: str
    check_ins: int
    check_outs: int


class EmployeeRevenueResponse(BaseModel):
    revenueToday: float
    revenueMonth: float
    revenueByDay: list[EmployeeRevenuePoint] = Field(default_factory=list)
    trafficByHour: list[EmployeeTrafficPoint] = Field(default_factory=list)
    occupancyRatio: float = 0
    totalPaidBookings: int = 0


class EmployeeParkingStatusRequest(BaseModel):
    status: str = Field(pattern="^(open|closed|full)$")


class EmployeeQrActionRequest(BaseModel):
    qr_data: str = Field(min_length=1, max_length=4000)
    payment_method: str = Field(default="cash", pattern="^(cash|bank_transfer|qr|vnpay)$")


class EmployeeQrActionResponse(BaseModel):
    message: str
    booking: dict
    payment_preview: dict | None = None


class EmployeeHistoryItem(BaseModel):
    id: int
    action: str
    detail: str | None = None
    amount: float = 0
    created_at: datetime


class EmployeeHistoryResponse(BaseModel):
    history: list[EmployeeHistoryItem]
    total_count: int
