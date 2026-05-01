import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import { formatDateTimeVN } from "../utils/dateTime";
import "./Payment.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState(null);

  const numericBookingId = useMemo(() => Number(bookingId), [bookingId]);
  const remainingAmount = Math.max(0, Number(booking?.total_amount || 0) - Number(booking?.upfront_amount || 0));

  const refreshData = async () => {
    const [bookingRes, walletRes] = await Promise.all([
      API.get(`/booking/my/${numericBookingId}`),
      API.get("/wallet/me"),
    ]);
    setBooking(bookingRes.data);
    setWallet(walletRes.data?.wallet || null);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!Number.isInteger(numericBookingId) || numericBookingId <= 0) {
        setError("Booking ID không hợp lệ");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        await refreshData();
      } catch (err) {
        setError(err?.response?.data?.detail || "Không tải được thông tin booking");
        setBooking(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [numericBookingId]);

  const handleMockPaid = async () => {
    if (!booking?.booking_id) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await API.post("/payment/mock-success", { booking_id: booking.booking_id });
      await refreshData();
      navigate(`/payment/success/${booking.booking_id}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Không mô phỏng thanh toán được");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-wrap">
      <div className="page-card payment-shell">
        <h1 className="page-title">Thanh Toán Bằng Ví</h1>
        <p className="payment-note">Flow cũ bằng QR ngân hàng đã được thay bằng ví nội bộ.</p>

        {loading && <p className="payment-note">Đang tải thông tin booking...</p>}
        {error && <p className="payment-error">{error}</p>}

        {booking && !loading && (
          <div className="payment-card">
            <p><strong>Booking ID:</strong> {booking.booking_id}</p>
            <p><strong>Trạng thái:</strong> {booking.booking_status}</p>
            <p><strong>Bãi xe:</strong> {booking.parking?.name}</p>
            <p><strong>Slot:</strong> {booking.slot?.code || booking.slot?.id}</p>
            <p><strong>Biển số:</strong> {booking.vehicle?.license_plate}</p>
            <p><strong>Check-in:</strong> {formatDateTimeVN(booking.checkin_time)}</p>
            <p><strong>Check-out:</strong> {formatDateTimeVN(booking.checkout_time)}</p>
            <p><strong>Tổng tiền booking:</strong> {formatMoney(booking.total_amount)}đ</p>
            <p><strong>Đã giữ 30%:</strong> {formatMoney(booking.upfront_amount)}đ</p>
            <p><strong>Còn lại khi checkout:</strong> {formatMoney(remainingAmount)}đ</p>
            {wallet ? <p><strong>Số dư ví:</strong> {formatMoney(wallet.balance)}đ</p> : null}

            <div className="payment-actions">
              <button type="button" className="btn-primary" onClick={handleMockPaid} disabled={submitting}>
                {submitting ? "Đang mô phỏng..." : "Mô phỏng đã thanh toán"}
              </button>
              <button type="button" className="btn-primary" onClick={() => navigate(`/payment/success/${booking.booking_id}`, { replace: true })}>
                Xem chi tiết booking
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>Về hồ sơ ví</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}