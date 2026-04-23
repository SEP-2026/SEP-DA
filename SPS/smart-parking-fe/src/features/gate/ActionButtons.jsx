import { canCheckIn, canCheckOut } from "./gatePermissions";

export default function ActionButtons({ booking, uiState, onCheckIn, onCheckOut }) {
  const disabled = uiState === "processing" || uiState === "action_submitting";
  const hasBooking = Boolean(booking?.booking_id);
  const checkInEnabled = hasBooking && canCheckIn(booking);
  const checkOutEnabled = hasBooking && canCheckOut(booking);

  return (
    <div className="scan-actions">
      <button type="button" className="btn-checkin" onClick={onCheckIn} disabled={!checkInEnabled || disabled}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe vào bãi"}
      </button>
      <button type="button" className="btn-checkout" onClick={onCheckOut} disabled={!checkOutEnabled || disabled}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe ra bãi"}
      </button>
    </div>
  );
}
