import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import "./PaymentSuccess.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");

const formatDateTimeVN = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function PaymentSuccess() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  const numericBookingId = useMemo(() => Number(bookingId), [bookingId]);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!Number.isInteger(numericBookingId) || numericBookingId <= 0) {
        setError("Booking ID không hợp lệ");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await API.get(`/booking/my/${numericBookingId}`);
        setBooking(res.data);
      } catch (err) {
        setBooking(null);
        setError(err?.response?.data?.detail || "Không tải được thông tin booking");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [numericBookingId]);

  return (
    <section className="page-wrap">
      <div className="page-card payment-success-shell">
        <h1 className="page-title">Thanh Toán Thành Công</h1>
        <p className="payment-success-note">Mang mã QR này đến cổng để quét check-in và check-out.</p>

        {loading && <p className="payment-success-note">Đang tải thông tin booking...</p>}
        {error && <p className="payment-success-error">{error}</p>}

        {booking && !loading && (
          <div className="payment-success-card">
            <p><strong>Booking ID:</strong> {booking.booking_id}</p>
            <p><strong>Trạng thái:</strong> {booking.booking_status}</p>
            <p><strong>Bãi xe:</strong> {booking.parking?.name}</p>
            <p><strong>Slot:</strong> {booking.slot?.code || booking.slot?.id}</p>
            <p><strong>Chủ xe:</strong> {booking.vehicle?.owner_name}</p>
            <p><strong>Biển số:</strong> {booking.vehicle?.license_plate}</p>
            <p><strong>Check-in:</strong> {formatDateTimeVN(booking.checkin_time)}</p>
            <p><strong>Check-out:</strong> {formatDateTimeVN(booking.checkout_time)}</p>
            <p><strong>Số tiền:</strong> {formatMoney(booking.total_amount)}đ</p>

            {booking.qr_code && (
              <div className="payment-success-qr-box">
                <img src={`http://localhost:8000/${booking.qr_code}`} alt="QR check-in/check-out" />
              </div>
            )}

            <div className="payment-success-actions">
              <button type="button" className="btn-primary" onClick={() => navigate("/booking", { replace: true })}>
                Quay lại đặt chỗ
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
