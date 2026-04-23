import { canCheckIn, canCheckOut } from "./gatePermissions";

export default function ActionButtons({ booking, uiState, onCheckIn, onCheckOut }) {
  const disabled = uiState === "processing" || uiState === "action_submitting";
  const hasBooking = Boolean(booking?.booking_id);
  const status = (booking?.checkin_status || booking?.booking_status || "").toLowerCase();
  const normalizedStatus = status === "completed" ? "checked_out" : status;
  const checkInEnabled = hasBooking && canCheckIn(booking) && normalizedStatus !== "checked_out";
  const checkOutEnabled = hasBooking && canCheckOut(booking) && normalizedStatus !== "checked_out";
  const checkInTitle =
    normalizedStatus === "checked_in"
      ? "Xe đã trong bãi"
      : normalizedStatus === "checked_out"
        ? "Booking đã hoàn tất"
        : "Cho xe vào bãi";
  const checkOutTitle =
    normalizedStatus === "pending" || normalizedStatus === "booked"
      ? "Xe chưa check-in"
      : normalizedStatus === "checked_out"
        ? "Booking đã hoàn tất"
        : "Cho xe ra bãi";

  return (
    <div className="scan-actions">
      <button type="button" className="btn-checkin" onClick={onCheckIn} disabled={!checkInEnabled || disabled} title={checkInTitle}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe vào bãi"}
      </button>
      <button type="button" className="btn-checkout" onClick={onCheckOut} disabled={!checkOutEnabled || disabled} title={checkOutTitle}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe ra bãi"}
      </button>
    </div>
  );
}
