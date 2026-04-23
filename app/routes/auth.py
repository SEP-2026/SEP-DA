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
from app.models.models import District, EmployeeAccount, RevokedToken, User
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
from app.security.password_policy import ensure_strong_password

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "3"))


def _build_user_info(user: User) -> UserInfo:
    return UserInfo(
        id=user.id,
        email=user.email,
        username=None,
        role=user.role,
        owner_id=None,
        parking_id=None,
        status=user.status,
        name=user.name,
        phone=user.phone,
        vehicle_plate=user.vehicle_plate,
        vehicle_color=user.vehicle_color,
        managed_district_id=user.managed_district_id,
        managed_district=user.managed_district.name if user.managed_district else None,
    )


def _build_employee_info(employee: EmployeeAccount) -> UserInfo:
    return UserInfo(
        id=employee.id,
        email=None,
        username=employee.username,
        role=employee.role,
        owner_id=employee.owner_id,
        parking_id=employee.parking_id,
        status=employee.status,
        name=None,
        phone=None,
        vehicle_plate=None,
        vehicle_color=None,
        managed_district_id=None,
        managed_district=None,
    )


def create_access_token_for_subject(subject: str, role: str, identity: str) -> tuple[str, datetime, str]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    jti = str(uuid4())
    payload = {
        "sub": subject,
        "email": identity,
        "role": role,
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, expires_at, jti


def _create_access_token(user: User) -> tuple[str, datetime, str]:
    return create_access_token_for_subject(str(user.id), user.role, user.email)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¿t hÃ¡ÂºÂ¡n") from exc
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡") from exc


def _is_token_revoked(db: Session, jti: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ThiÃ¡ÂºÂ¿u access token")

    payload = decode_access_token(credentials.credentials)
    jti = payload.get("jti")
    if not jti or _is_token_revoked(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ thu hÃ¡Â»â€œi")

    subject = payload.get("sub")
    if not subject or str(subject).startswith("employee:"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃƒÂ´ng thuÃ¡Â»â„¢c ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng hÃ¡Â»â€¡ thÃ¡Â»â€˜ng")

    try:
        user_id = int(subject)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡") from exc

    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NgÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i hoÃ¡ÂºÂ·c Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ khÃƒÂ³a")
    if user.status and user.status.lower() == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="TÃƒÂ i khoÃ¡ÂºÂ£n Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ vÃƒÂ´ hiÃ¡Â»â€¡u hÃƒÂ³a")
    return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identity = payload.email.strip().lower()
    auth_error = "Sai email/username hoac mat khau"

    user = db.query(User).filter(User.email == identity).first()
    user_role = (user.role or "").strip().lower() if user else ""
    if user and user_role != "employee":
        password_ok = False
        if user.password_hash:
            password_ok = check_password_hash(user.password_hash, payload.password)
        elif user.password:
            password_ok = user.password == payload.password
        if not password_ok:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_error)

        if not user.password_hash:
            user.password_hash = generate_password_hash(payload.password)
            db.commit()

        if user.is_active != 1 or (user.status and user.status.lower() == "banned"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tai khoan da bi vo hieu hoa")

        token, expires_at, _ = _create_access_token(user)
        return LoginResponse(
            message="Dang nhap thanh cong",
            token=token,
            expires_in=int((expires_at - datetime.now(timezone.utc)).total_seconds()),
            user=_build_user_info(user),
        )

    employee_identities = {identity}
    if "@" in identity:
        local_part = identity.split("@", 1)[0].strip().lower()
        if local_part:
            employee_identities.add(local_part)

    employee = (
        db.query(EmployeeAccount)
        .filter(EmployeeAccount.username.in_(employee_identities), EmployeeAccount.is_active == 1)
        .first()
    )
    if not employee or employee.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_error)
    employee_password_ok = bool(employee.password_hash and check_password_hash(employee.password_hash, payload.password))
    if not employee_password_ok:
        # One-time legacy bridge:
        # some deployments store employee credentials in users(role=employee) while employee_accounts exists.
        # If legacy password matches, synchronize employee_accounts hash so next login is consistent.
        if user and user_role == "employee":
            legacy_ok = False
            if user.password_hash:
                legacy_ok = check_password_hash(user.password_hash, payload.password)
            elif user.password:
                legacy_ok = user.password == payload.password
            if legacy_ok:
                employee.password_hash = generate_password_hash(payload.password)
                db.commit()
                employee_password_ok = True

    if not employee_password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_error)

    token, expires_at, _ = create_access_token_for_subject(
        subject=f"employee:{employee.id}",
        role="employee",
        identity=employee.username,
    )
    return LoginResponse(
        message="Dang nhap employee thanh cong",
        token=token,
        expires_in=int((expires_at - datetime.now(timezone.utc)).total_seconds()),
        user=_build_employee_info(employee),
    )


@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    ensure_strong_password(payload.password)
    normalized_email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c sÃ¡Â»Â­ dÃ¡Â»Â¥ng")

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
    return RegisterResponse(message="TÃ¡ÂºÂ¡o tÃƒÂ i khoÃ¡ÂºÂ£n user thÃƒÂ nh cÃƒÂ´ng", user=_build_user_info(user))


@router.post("/logout", response_model=LogoutResponse)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ThiÃ¡ÂºÂ¿u access token")

    payload = decode_access_token(credentials.credentials)
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡")

    if not _is_token_revoked(db, jti):
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
        db.commit()
    return LogoutResponse(message="Ã„ÂÃ„Æ’ng xuÃ¡ÂºÂ¥t thÃƒÂ nh cÃƒÂ´ng")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NgÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TÃƒÂªn khÃƒÂ´ng Ã„â€˜Ã†Â°Ã¡Â»Â£c Ã„â€˜Ã¡Â»Æ’ trÃ¡Â»â€˜ng")
        user.name = name
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    if payload.managed_district_id is not None:
        if user.role not in {"owner", "admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ChÃ¡Â»â€° owner hoÃ¡ÂºÂ·c admin mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t quÃ¡ÂºÂ­n quÃ¡ÂºÂ£n lÃƒÂ½")
        district = db.query(District).filter(District.id == payload.managed_district_id).first()
        if not district:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QuÃ¡ÂºÂ­n khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i")
        user.managed_district_id = district.id
    if payload.email is not None:
        normalized_email = payload.email.lower().strip()
        if normalized_email != user.email:
            existing_user = db.query(User).filter(User.email == normalized_email, User.id != user.id).first()
            if existing_user:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c sÃ¡Â»Â­ dÃ¡Â»Â¥ng")
            user.email = normalized_email

    db.commit()
    db.refresh(user)
    return UpdateProfileResponse(message="CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t hÃ¡Â»â€œ sÃ†Â¡ thÃƒÂ nh cÃƒÂ´ng", user=_build_user_info(user))


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NgÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i")
    if payload.old_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u mÃ¡Â»â€ºi phÃ¡ÂºÂ£i khÃƒÂ¡c mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u cÃ…Â©")

    ensure_strong_password(payload.new_password)
    password_ok = False
    if user.password_hash:
        password_ok = check_password_hash(user.password_hash, payload.old_password)
    elif user.password:
        password_ok = user.password == payload.old_password
    if not password_ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MÃ¡ÂºÂ­t khÃ¡ÂºÂ©u cÃ…Â© khÃƒÂ´ng Ã„â€˜ÃƒÂºng")

    user.password_hash = generate_password_hash(payload.new_password)
    user.password = "__legacy_disabled__"
    db.commit()
    return ChangePasswordResponse(message="Ã„ÂÃ¡Â»â€¢i mÃ¡ÂºÂ­t khÃ¡ÂºÂ©u thÃƒÂ nh cÃƒÂ´ng")

