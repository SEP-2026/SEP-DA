from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserInfo(BaseModel):
    id: int
    email: EmailStr
    role: str
    name: str | None = None


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
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    vehicle_plate: str | None = Field(default=None, max_length=30)


class RegisterResponse(BaseModel):
    message: str
    user: UserInfo
