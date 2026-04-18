import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import "./Payment.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");
const STATIC_PAYMENT_QR = "/payment/merchant-qr.png";
const VIETQR_BANK_ID = "VCB";
const VIETQR_ACCOUNT_NO = "1021209511";
const VIETQR_ACCOUNT_NAME = "SMART PARKING";


const buildDynamicVietQrUrl = (amount, bookingId) => {
  if (!VIETQR_BANK_ID || !VIETQR_ACCOUNT_NO) {
    return null;
  }

  const amountValue = Math.max(0, Math.round(Number(amount || 0)));
  const addInfo = encodeURIComponent(`BOOKING ${bookingId}`);
  const accountName = encodeURIComponent(VIETQR_ACCOUNT_NAME || "SMART PARKING");

  return `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?amount=${amountValue}&addInfo=${addInfo}&accountName=${accountName}`;
};

const getTotalPaymentAmount = (payment) => {
  const amount = Number(payment?.amount || 0);
  const overtime = Number(payment?.overtime_fee || 0);
  return amount + overtime;
};

export default function Payment() {
  const { bookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(null);
  const [staticQrMissing, setStaticQrMissing] = useState(false);
  const dynamicQrUrl = useMemo(
    () => buildDynamicVietQrUrl(getTotalPaymentAmount(payment), payment?.booking_id),
    [payment?.amount, payment?.overtime_fee, payment?.booking_id],
  );

  const numericBookingId = useMemo(() => Number(bookingId), [bookingId]);

  const loadPayment = async () => {
    if (!Number.isInteger(numericBookingId) || numericBookingId <= 0) {
      setError("Booking ID không hợp lệ");
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);
      const res = await API.post("/payment/create", {
        booking_id: numericBookingId,
      });
      setPayment(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Không tạo được payment");
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericBookingId]);

  const handleMockCallback = async (status) => {
    if (!payment?.booking_id) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await API.post("/payment/callback", null, {
        params: { booking_id: payment.booking_id, status },
      });

      if (status === "success") {
        navigate(`/payment/success/${res.data.booking_id}`, { replace: true });
        return;
      }

      setPayment((prev) => ({
        ...prev,
        payment_status: "failed",
      }));
    } catch (err) {
      setError(err?.response?.data?.detail || "Xử lý callback thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-wrap">
      <div className="page-card payment-shell">
        <h1 className="page-title">Thanh Toán Booking</h1>

        {location.state?.booking?.booking_id && (
          <p className="payment-note">
            Booking #{location.state.booking.booking_id} đã được tạo. Vui lòng quét mã QR VNPay để thanh toán.
          </p>
        )}

        {loading && <p className="payment-note">Đang tạo payment...</p>}
        {error && <p className="payment-error">{error}</p>}

        {payment && !loading && (
          <div className="payment-card">
            <p><strong>Booking ID:</strong> {payment.booking_id}</p>
            <p><strong>Số tiền dự kiến:</strong> {formatMoney(payment.amount)}đ</p>
            <p><strong>Phí lố giờ:</strong> {formatMoney(payment.overtime_fee)}đ</p>
            <p><strong>Tổng tiền phải thanh toán:</strong> {formatMoney(getTotalPaymentAmount(payment))}đ</p>
            <p><strong>Trạng thái:</strong> {payment.payment_status}</p>
            <p className="payment-note">Đường dẫn QR cố định: public/payment/merchant-qr.png</p>

            <p className="payment-note">
              Mã QR cố định thanh toán với số tiền động:
            </p>
            <div className="payment-qr-box">
              {!staticQrMissing && dynamicQrUrl ? (
                <img
                  src={dynamicQrUrl}
                  alt="QR VietQR động theo số tiền"
                  onError={() => setStaticQrMissing(true)}
                />
              ) : payment.qr_code ? (
                <img src={`http://localhost:8000/${payment.qr_code}`} alt="QR thanh toán VNPay fallback" />
              ) : (
                <p className="payment-note">Chưa có QR code để hiển thị</p>
              )}
            </div>

            {!dynamicQrUrl && (
              <p className="payment-note" style={{ color: "red" }}>
                ⚠️ Không thể tạo QR VietQR động.
              </p>
            )}

            <div className="payment-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleMockCallback("success")}
                disabled={submitting || payment.payment_status === "paid"}
              >
                {submitting ? "Đang xử lý..." : "Mô phỏng thanh toán thành công"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleMockCallback("fail")}
                disabled={submitting || payment.payment_status === "paid"}
              >
                Mô phỏng thanh toán thất bại
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
