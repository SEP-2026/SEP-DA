import re

from pydantic import BaseModel, EmailStr, Field, validator

from app.security.password_policy import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    PASSWORD_POLICY_MESSAGE,
    is_strong_password,
)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class UserInfo(BaseModel):
    id: int
    email: EmailStr | None = None
    username: str | None = None
    role: str
    owner_id: int | None = None
    parking_id: int | None = None
    status: str | None = None
    name: str | None = None
    phone: str | None = None
    vehicle_plate: str | None = None
    vehicle_color: str | None = None
    managed_district_id: int | None = None
    managed_district: str | None = None


class LoginResponse(BaseModel):
    message: str
    token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo


class LogoutResponse(BaseModel):
    message: str


VN_MOBILE_PHONE_PATTERN = re.compile(r"^0[35789]\d{8}$")


def _normalize_vietnam_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if digits.startswith("84"):
        digits = f"0{digits[2:]}"
    return digits


def _validate_vietnam_phone(value: str) -> str:
    normalized = _normalize_vietnam_phone(value)
    if not VN_MOBILE_PHONE_PATTERN.fullmatch(normalized):
        raise ValueError("So dien thoai khong dung dinh dang (VD: 09xxxxxxxx)")
    return normalized


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    phone: str = Field(min_length=1, max_length=30)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    vehicle_color: str | None = Field(default=None, max_length=50)

    @validator("password")
    def validate_register_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value

    @validator("phone")
    def validate_register_phone(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("So dien thoai la bat buoc")
        return _validate_vietnam_phone(stripped)


class RegisterResponse(BaseModel):
    message: str
    user: UserInfo


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    managed_district_id: int | None = Field(default=None, ge=1)

    @validator("phone")
    def validate_profile_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        return _validate_vietnam_phone(stripped)


class UpdateProfileResponse(BaseModel):
    message: str
    user: UserInfo


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @validator("new_password")
    def validate_new_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value


class ChangePasswordResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    identity: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=6, max_length=30)

    @validator("phone")
    def validate_forgot_phone(cls, value: str) -> str:
        return _validate_vietnam_phone(value.strip())


class ForgotPasswordRequestResponse(BaseModel):
    message: str
    reset_token: str
    expires_in: int


class ForgotPasswordResetRequest(BaseModel):
    reset_token: str = Field(min_length=10, max_length=255)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    confirm_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @validator("new_password")
    def validate_reset_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value


class ForgotPasswordResetResponse(BaseModel):
    message: str
