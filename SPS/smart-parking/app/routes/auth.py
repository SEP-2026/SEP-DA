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
from app.models.models import RevokedToken, User, Wallet
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


def create_access_token(user: User) -> tuple[str, datetime, str]:
    return _create_access_token(user)


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


def authorize(*roles: str):
    allowed_roles = {role.strip().lower() for role in roles if role}

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if allowed_roles and current_user.role.lower() not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p tÃ i nguyÃªn nÃ y",
            )
        return current_user

    return _dependency


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
        user=UserInfo(
            id=user.id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone=user.phone,
            vehicle_plate=user.vehicle_plate,
            vehicle_color=user.vehicle_color,
        ),
    )


@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
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
    db.flush()

    wallet = Wallet(user_id=user.id, balance=0, reserved_balance=0)
    db.add(wallet)
    db.commit()
    db.refresh(user)
    db.refresh(wallet)

    return RegisterResponse(
        message="Tạo tài khoản user thành công",
        user=UserInfo(
            id=user.id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone=user.phone,
            vehicle_plate=user.vehicle_plate,
            vehicle_color=user.vehicle_color,
        ),
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
    return UserInfo(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        name=current_user.name,
        phone=current_user.phone,
        vehicle_plate=current_user.vehicle_plate,
        vehicle_color=current_user.vehicle_color,
    )


@router.put("/me", response_model=UpdateProfileResponse)
def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "employee":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee chá»‰ cÃ³ quyá»n xem há»“ sÆ¡")

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
        user=UserInfo(
            id=user.id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone=user.phone,
            vehicle_plate=user.vehicle_plate,
            vehicle_color=user.vehicle_color,
        ),
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "employee":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee khÃ´ng Ä‘Æ°á»£c Ä‘á»•i máº­t kháº©u táº¡i mÃ n hÃ¬nh nÃ y")

    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")

    if payload.old_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu mới phải khác mật khẩu cũ")

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
