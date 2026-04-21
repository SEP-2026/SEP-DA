import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from app.database import get_db
from app.models.models import District, RevokedToken, User
from app.security.password_policy import ensure_strong_password
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RegisterRequest,
    RegisterResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    UserInfo,
)

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "3"))


def _build_user_info(user: User) -> UserInfo:
    return UserInfo(
        id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
        phone=user.phone,
        vehicle_plate=user.vehicle_plate,
        vehicle_color=user.vehicle_color,
        managed_district_id=user.managed_district_id,
        managed_district=user.managed_district.name if user.managed_district else None,
    )


def _create_access_token(user: User) -> tuple[str, datetime, str]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    jti = str(uuid4())
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, expires_at, jti


def _decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã hết hạn",
        ) from exc
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        ) from exc


def _is_token_revoked(db: Session, jti: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu access token",
        )

    payload = _decode_token(credentials.credentials)
    jti = payload.get("jti")
    if not jti or _is_token_revoked(db, jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã bị thu hồi",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        )

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ",
        ) from exc

    user = db.query(User).filter(User.id == user_id_int, User.is_active == 1).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc đã bị khóa",
        )

    if user.status and user.status.lower() == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai email hoặc mật khẩu")

    password_ok = False
    if user.password_hash:
        password_ok = check_password_hash(user.password_hash, payload.password)
    elif user.password:
        password_ok = user.password == payload.password

    if not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai email hoặc mật khẩu")

    if not user.password_hash:
        user.password_hash = generate_password_hash(payload.password)
        db.commit()

    if user.is_active != 1 or (user.status and user.status.lower() == "banned"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị vô hiệu hóa")

    token, expires_at, _ = _create_access_token(user)

    return LoginResponse(
        message="Đăng nhập thành công",
        token=token,
        expires_in=int((expires_at - datetime.now(timezone.utc)).total_seconds()),
        user=_build_user_info(user),
    )


@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    ensure_strong_password(payload.password)
    normalized_email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email đã được sử dụng")

    user = User(
        name=payload.name.strip(),
        email=normalized_email,
        password="__legacy_disabled__",
        password_hash=generate_password_hash(payload.password),
        phone=payload.phone.strip() if payload.phone else None,
        vehicle_plate=payload.vehicle_plate.strip() if payload.vehicle_plate else None,
        vehicle_color=payload.vehicle_color.strip() if payload.vehicle_color else None,
        role="user",
        status="active",
        is_active=1,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return RegisterResponse(
        message="Tạo tài khoản user thành công",
        user=_build_user_info(user),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu access token",
        )

    payload = _decode_token(credentials.credentials)
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")

    if not _is_token_revoked(db, jti):
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
        db.commit()

    return LogoutResponse(message="Đăng xuất thành công")


@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)):
    return _build_user_info(current_user)


@router.put("/me", response_model=UpdateProfileResponse)
def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên không được để trống")
        user.name = name

    if payload.phone is not None:
        phone = payload.phone.strip()
        user.phone = phone or None

    if payload.managed_district_id is not None:
        if user.role not in {"owner", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ owner hoặc admin mới được cập nhật quận quản lý",
            )
        district = db.query(District).filter(District.id == payload.managed_district_id).first()
        if not district:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quận không tồn tại")
        user.managed_district_id = district.id

    if payload.email is not None:
        normalized_email = payload.email.lower().strip()
        if normalized_email != user.email:
            existing_user = db.query(User).filter(User.email == normalized_email, User.id != user.id).first()
            if existing_user:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email đã được sử dụng")
            user.email = normalized_email

    db.commit()
    db.refresh(user)

    return UpdateProfileResponse(
        message="Cập nhật hồ sơ thành công",
        user=_build_user_info(user),
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")

    if payload.old_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu mới phải khác mật khẩu cũ")

    ensure_strong_password(payload.new_password)

    password_ok = False
    if user.password_hash:
        password_ok = check_password_hash(user.password_hash, payload.old_password)
    elif user.password:
        password_ok = user.password == payload.old_password

    if not password_ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu cũ không đúng")

    user.password_hash = generate_password_hash(payload.new_password)
    user.password = "__legacy_disabled__"
    db.commit()

    return ChangePasswordResponse(message="Đổi mật khẩu thành công")
