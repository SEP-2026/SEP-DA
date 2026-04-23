import { buildDynamicVietQrUrl, formatCurrency } from "./gateFormatters";
import { getPaymentStatusLabel } from "./statusLabel";

export default function PaymentPanel({ booking, paymentMethod, setPaymentMethod }) {
  const pricing = booking?.pricing_preview;
  const payment = booking?.payment;
  const remainingDue = Number(pricing?.remaining_due || payment?.remaining_amount || 0);
  const vnpayQrUrl = buildDynamicVietQrUrl(remainingDue, booking?.booking_id);

  return (
    <div className="scan-payment-panel">
      <h3>Thanh toán</h3>
      <div className="scan-summary-list">
        <div>
          <span>Tổng tiền</span>
          <strong>{formatCurrency(pricing?.total_charge)}</strong>
        </div>
        <div>
          <span>Đã cọc / đã thu</span>
          <strong>{formatCurrency(pricing?.prepaid_amount || payment?.amount)}</strong>
        </div>
        <div>
          <span>Phát sinh thêm</span>
          <strong>{formatCurrency(pricing?.extra_fee || payment?.overtime_fee)}</strong>
        </div>
        <div>
          <span>Còn phải trả</span>
          <strong>{formatCurrency(pricing?.remaining_due || payment?.remaining_amount)}</strong>
        </div>
        <div>
          <span>Trạng thái thanh toán</span>
          <strong>{getPaymentStatusLabel(payment?.payment_status || pricing?.payment_status)}</strong>
        </div>
      </div>

      <label className="scan-field">
        <span>Phương thức thanh toán khi checkout</span>
        <select className="scan-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
          <option value="cash">Tiền mặt</option>
          <option value="vnpay">VNPay</option>
        </select>
      </label>

      {paymentMethod === "vnpay" ? (
        <div className="scan-vnpay-box">
          <div className="scan-summary-list">
            <div>
              <span>QR VNPay cần thanh toán</span>
              <strong>{remainingDue > 0 ? formatCurrency(remainingDue) : "Không còn số tiền phải trả"}</strong>
            </div>
          </div>

          {remainingDue > 0 && vnpayQrUrl ? (
            <div className="scan-vnpay-qr">
              <img src={vnpayQrUrl} alt="QR thanh toán VNPay tại cổng" />
            </div>
          ) : (
            <p className="scan-hint">Booking này hiện không còn số tiền cần thanh toán qua VNPay.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
