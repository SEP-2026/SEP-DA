import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.init_db import init_db
from app.routes import admin, auth, booking, owner, payment, vehicle
from app.security.gateway import SecurityGatewayMiddleware

app = FastAPI()
logger = logging.getLogger(__name__)

app.add_middleware(SecurityGatewayMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"http://localhost(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("qrcodes", exist_ok=True)
app.mount("/qrcodes", StaticFiles(directory="qrcodes"), name="qrcodes")

app.include_router(booking.router)
app.include_router(payment.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(owner.router)
app.include_router(vehicle.router)


@app.on_event("startup")
def startup_init_db():
    try:
        init_db()
    except Exception:
        logger.exception("Database migration at startup failed; continuing with existing schema.")


@app.get("/")
def root():
    return {"message": "API + CSDL đã sẵn sàng"}
