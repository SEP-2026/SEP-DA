import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.init_db import init_db
from app.routes import admin, auth, booking, employee, gate, owner, payment, vehicle
from app.security.gateway import SecurityGatewayMiddleware

app = FastAPI()

app.add_middleware(SecurityGatewayMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)

os.makedirs("qrcodes", exist_ok=True)
app.mount("/qrcodes", StaticFiles(directory="qrcodes"), name="qrcodes")

app.include_router(booking.router)
app.include_router(gate.router)
app.include_router(payment.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(owner.router)
app.include_router(vehicle.router)
app.include_router(employee.router)
app.include_router(employee.owner_employee_router)


@app.on_event("startup")
def startup_init_db():
    try:
        init_db()
    except Exception:
        logger.exception("Database migration at startup failed; continuing with existing schema.")


@app.get("/")
def root():
    return {"message": "API + CSDL đã sẵn sàng"}
