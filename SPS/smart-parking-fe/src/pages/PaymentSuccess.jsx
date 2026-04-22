import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import { formatDateTimeVN } from "../utils/dateTime";
import "./PaymentSuccess.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");
const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
    if (!booking?.qr_code && !booking?.qr_code_path) {
      return "";
    }
    const qrPath = booking.qr_code_path || booking.qr_code;
    // Extract just the filename if it contains a path
    const filename = qrPath.includes("/") ? qrPath.split("/").pop() : qrPath;
    return `${BACKEND_BASE_URL}/qrcodes/${filename}`;
  }, [booking?.qr_code, booking?.qr_code_path]);

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
      setShareNotice("Không tìm thấy QR để tải.");
      return;
    }

    try {
      const response = await fetch(qrImageUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch QR");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `booking-${booking.booking_id}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      setShareNotice("Đã tải QR thành công.");
    } catch {
      setShareNotice("Tải QR thất bại. Vui lòng thử lại.");
    }
  };

  const handleShareEmail = () => {
    if (!booking) {
      return;
    }

    const subject = encodeURIComponent(`Thông tin booking #${booking.booking_id}`);
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
        setShareNotice("Đã chia sẻ qua ứng dụng trên điện thoại.");
        return;
      }

      await navigator.clipboard.writeText(message);
      window.open("https://zalo.me", "_blank", "noopener,noreferrer");
      setShareNotice("Đã copy nội dung. Hãy dán vào Zalo để gửi.");
    } catch {
      setShareNotice("Chia sẻ Zalo thất bại. Hãy thử lại.");
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

            {booking.qr_code || booking.qr_code_path ? (
              <div className="payment-success-qr-box">
                <img 
                  src={qrImageUrl} 
                  alt="QR check-in/check-out"
                  onError={(e) => { e.target.src = '/placeholder-qr.png'; }}
                  style={{ width: 220, height: 220, border: '1px solid #eee', borderRadius: 8 }}
                />
              </div>
            ) : (
              <p className="payment-success-note">Đang tạo mã QR, vui lòng đợi...</p>
            )}

            <div className="payment-success-actions">
              <button type="button" className="payment-success-btn secondary" onClick={handleDownloadQr}>
                Tải QR
              </button>
              <button type="button" className="payment-success-btn secondary" onClick={handleShareEmail}>
                Gửi qua Email
              </button>
              <button type="button" className="payment-success-btn secondary" onClick={handleShareZalo}>
                Gửi qua Zalo
              </button>
              <button type="button" className="btn-primary" onClick={() => navigate("/booking", { replace: true })}>
                Xem chi tiết booking
              </button>
            </div>
            {shareNotice && <p className="payment-success-share-notice">{shareNotice}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
