import { useState } from "react";
import API from "../services/api";
import "./Scan.css";

export default function Scan() {
  const [bookingId, setBookingId] = useState("");

  const getValidBookingId = () => {
    const value = Number(bookingId);
    if (!Number.isInteger(value) || value <= 0) {
      alert("Vui lòng nhập Booking ID hợp lệ (số nguyên dương)");
      return null;
    }
    return value;
  };

  const checkIn = async () => {
    const validBookingId = getValidBookingId();
    if (!validBookingId) {
      return;
    }

    try {
      await API.post("/check-in", null, {
        params: { booking_id: validBookingId },
      });
      alert("Check-in thành công");
    } catch (err) {
      alert(err?.response?.data?.detail || "Check-in thất bại");
    }
  };

  const checkOut = async () => {
    const validBookingId = getValidBookingId();
    if (!validBookingId) {
      return;
    }

    try {
      const res = await API.post("/check-out", null, {
        params: { booking_id: validBookingId },
      });
      alert("Tiền: " + res.data.amount);
    } catch (err) {
      alert(err?.response?.data?.detail || "Check-out thất bại");
    }
  };

  return (
    <section className="page-wrap">
      <div className="page-card">
        <h1 className="page-title">Quét mã QR</h1>

        <div className="scan-tools">
          <input
            className="scan-input"
            type="number"
            min="1"
            placeholder="Nhập mã đặt chỗ"
            onChange={(e) => setBookingId(e.target.value)}
          />

          <div className="scan-actions">
            <button className="btn-checkin" onClick={checkIn}>Vào bãi</button>
            <button className="btn-checkout" onClick={checkOut}>Ra bãi</button>
          </div>

          <p className="scan-hint">Lưu ý: cần vào bãi trước khi thực hiện ra bãi.</p>
        </div>
      </div>
    </section>
  );
}
