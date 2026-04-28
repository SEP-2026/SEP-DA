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


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    phone: str | None = Field(default=None, max_length=30)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    vehicle_color: str | None = Field(default=None, max_length=50)

    @validator("password")
    def validate_register_password_strength(cls, value: str) -> str:
        if not is_strong_password(value):
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value


class RegisterResponse(BaseModel):
    message: str
    user: UserInfo


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    managed_district_id: int | None = Field(default=None, ge=1)


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
