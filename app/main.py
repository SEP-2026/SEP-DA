import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import admin, auth, booking, owner, payment

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/")
def root():
    return {"message": "API + CSDL đã sẵn sàng"}
