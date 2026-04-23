from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.controllers.employee_controller import (
    create_owner_employee_controller,
    employee_check_in_controller,
    employee_check_out_controller,
    employee_dashboard_controller,
    employee_history_controller,
    employee_login_controller,
    employee_parking_status_controller,
    employee_profile_controller,
    employee_revenue_controller,
    employee_vehicles_controller,
)
from app.database import get_db
from app.models.models import EmployeeAccount, RevokedToken, User
from app.routes.auth import decode_access_token, get_current_user
from app.schemas.employee import (
    EmployeeHistoryResponse,
    EmployeeInfo,
    EmployeeLoginRequest,
    EmployeeLoginResponse,
    EmployeeParkingOverview,
    EmployeeParkingStatusRequest,
    EmployeeProfileResponse,
    EmployeeQrActionRequest,
    EmployeeQrActionResponse,
    EmployeeRevenueResponse,
    EmployeeVehicleResponse,
    OwnerCreateEmployeeRequest,
)

router = APIRouter(prefix="/api/employee", tags=["employee"])
owner_employee_router = APIRouter(prefix="/api/owner", tags=["owner-employee"])
security = HTTPBearer(auto_error=False)


def _serialize_employee_info(payload: dict) -> EmployeeInfo:
    return EmployeeInfo(**payload)


def _serialize_parking_info(payload: dict) -> EmployeeParkingOverview:
    return EmployeeParkingOverview(**payload)


def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> EmployeeAccount:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thiáº¿u access token")

    payload = decode_access_token(credentials.credentials)
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃ´ng há»£p lá»‡")
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token Ä‘Ã£ bá»‹ thu há»“i")

    subject = payload.get("sub") or ""
    if not str(subject).startswith("employee:"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃ´ng thuá»™c employee")

    try:
        employee_id = int(str(subject).split(":", 1)[1])
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khÃ´ng há»£p lá»‡") from exc

    employee = db.query(EmployeeAccount).filter(EmployeeAccount.id == employee_id, EmployeeAccount.is_active == 1).first()
    if not employee or employee.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Employee khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ khÃ³a")
    return employee


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chá»‰ owner má»›i Ä‘Æ°á»£c truy cáº­p")
    return current_user


@owner_employee_router.post("/create-employee")
def create_employee(
    payload: OwnerCreateEmployeeRequest,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    employee = create_owner_employee_controller(owner, payload.username, payload.password, payload.parking_id, db)
    return {"message": "Táº¡o employee thÃ nh cÃ´ng", "employee": employee}


@router.post("/login", response_model=EmployeeLoginResponse)
def employee_login(payload: EmployeeLoginRequest, db: Session = Depends(get_db)):
    result = employee_login_controller(payload.username, payload.password, db)
    return EmployeeLoginResponse(
        message=result["message"],
        token=result["token"],
        expires_in=result["expires_in"],
        user=_serialize_employee_info(result["user"]),
    )


@router.get("/me", response_model=EmployeeInfo)
def employee_me(current_employee: EmployeeAccount = Depends(get_current_employee)):
    return _serialize_employee_info(
        {
            "id": current_employee.id,
            "username": current_employee.username,
            "role": current_employee.role,
            "owner_id": current_employee.owner_id,
            "parking_id": current_employee.parking_id,
            "status": current_employee.status,
            "created_at": current_employee.created_at,
        }
    )


@router.get("/parking-lot", response_model=EmployeeParkingOverview)
def employee_dashboard(
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return _serialize_parking_info(employee_dashboard_controller(current_employee, db))


@router.get("/vehicles", response_model=EmployeeVehicleResponse)
def employee_vehicles(
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return EmployeeVehicleResponse(**employee_vehicles_controller(current_employee, db))


@router.get("/revenue", response_model=EmployeeRevenueResponse)
def employee_revenue(
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return EmployeeRevenueResponse(**employee_revenue_controller(current_employee, db))


@router.put("/parking-status", response_model=EmployeeParkingOverview)
def employee_parking_status(
    payload: EmployeeParkingStatusRequest,
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return _serialize_parking_info(employee_parking_status_controller(current_employee, payload.status, db))


@router.get("/profile", response_model=EmployeeProfileResponse)
def employee_profile(
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    profile = employee_profile_controller(current_employee, db)
    return EmployeeProfileResponse(
        employee=_serialize_employee_info(profile["employee"]),
        parking_lot=_serialize_parking_info(profile["parking_lot"]),
    )


@router.get("/history", response_model=EmployeeHistoryResponse)
def employee_history(
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return EmployeeHistoryResponse(**employee_history_controller(current_employee, db))


@router.post("/check-in", response_model=EmployeeQrActionResponse)
def employee_check_in(
    payload: EmployeeQrActionRequest,
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return EmployeeQrActionResponse(**employee_check_in_controller(current_employee, payload.qr_data, db))


@router.post("/check-out", response_model=EmployeeQrActionResponse)
def employee_check_out(
    payload: EmployeeQrActionRequest,
    current_employee: EmployeeAccount = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    return EmployeeQrActionResponse(**employee_check_out_controller(current_employee, payload.qr_data, payload.payment_method, db))
