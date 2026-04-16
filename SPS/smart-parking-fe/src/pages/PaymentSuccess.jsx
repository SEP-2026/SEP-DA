import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import "./PaymentSuccess.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");
const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
  const [shareNotice, setShareNotice] = useState("");

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

  const qrImageUrl = useMemo(() => {
    if (!booking?.qr_code) {
      return "";
    }
    return `${BACKEND_BASE_URL}/${booking.qr_code}`;
  }, [booking?.qr_code]);

  const buildShareMessage = () => {
    if (!booking) {
      return "";
    }
    return [
      `Booking #${booking.booking_id}`,
      `Bai xe: ${booking.parking?.name || "N/A"}`,
      `Slot: ${booking.slot?.code || booking.slot?.id || "N/A"}`,
      `Bien so: ${booking.vehicle?.license_plate || "N/A"}`,
      `Check-in: ${formatDateTimeVN(booking.checkin_time)}`,
      `Check-out: ${formatDateTimeVN(booking.checkout_time)}`,
      `So tien: ${formatMoney(booking.total_amount)}d`,
      qrImageUrl,
    ].join("\n");
  };

  const handleDownloadQr = async () => {
    if (!qrImageUrl) {
      setShareNotice("Khong tim thay QR de tai.");
      return;
    }

    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `booking-${booking.booking_id}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      setShareNotice("Da tai QR thanh cong.");
    } catch {
      setShareNotice("Tai QR that bai. Vui long thu lai.");
    }
  };

  const handleShareEmail = () => {
    if (!booking) {
      return;
    }

    const subject = encodeURIComponent(`Thong tin booking #${booking.booking_id}`);
    const body = encodeURIComponent(buildShareMessage());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareZalo = async () => {
    if (!booking) {
      return;
    }

    const message = buildShareMessage();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Booking #${booking.booking_id}`,
          text: message,
        });
        setShareNotice("Da chia se qua ung dung tren dien thoai.");
        return;
      }

      await navigator.clipboard.writeText(message);
      window.open("https://zalo.me", "_blank", "noopener,noreferrer");
      setShareNotice("Da copy noi dung. Hay dan vao Zalo de gui.");
    } catch {
      setShareNotice("Chia se Zalo that bai. Hay thu lai.");
    }
  };

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
            <p><strong>Số điện thoại:</strong> {booking.vehicle?.phone || "Chưa cập nhật"}</p>
            <p><strong>Biển số:</strong> {booking.vehicle?.license_plate}</p>
            <p><strong>Màu xe:</strong> {booking.vehicle?.vehicle_color || "Chưa cập nhật"}</p>
            <p><strong>Check-in:</strong> {formatDateTimeVN(booking.checkin_time)}</p>
            <p><strong>Check-out:</strong> {formatDateTimeVN(booking.checkout_time)}</p>
            <p><strong>Số tiền:</strong> {formatMoney(booking.total_amount)}đ</p>

            {booking.qr_code && (
              <div className="payment-success-qr-box">
                <img src={qrImageUrl} alt="QR check-in/check-out" />
              </div>
            )}

            <div className="payment-success-actions">
              <button type="button" className="payment-success-btn secondary" onClick={handleDownloadQr}>
                Tai QR
              </button>
              <button type="button" className="payment-success-btn secondary" onClick={handleShareEmail}>
                Gui qua Email
              </button>
              <button type="button" className="payment-success-btn secondary" onClick={handleShareZalo}>
                Gui qua Zalo
              </button>
              <button type="button" className="btn-primary" onClick={() => navigate("/booking", { replace: true })}>
                Quay lại đặt chỗ
              </button>
            </div>
            {shareNotice && <p className="payment-success-share-notice">{shareNotice}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
