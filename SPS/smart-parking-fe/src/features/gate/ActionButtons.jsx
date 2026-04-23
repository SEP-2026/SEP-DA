import { canCheckIn, canCheckOut } from "./gatePermissions";

export default function ActionButtons({ booking, uiState, onCheckIn, onCheckOut }) {
  const disabled = uiState === "processing" || uiState === "action_submitting";

  return (
    <div className="scan-actions">
      <button type="button" className="btn-checkin" onClick={onCheckIn} disabled={!canCheckIn(booking) || disabled}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe vào bãi"}
      </button>
      <button type="button" className="btn-checkout" onClick={onCheckOut} disabled={!canCheckOut(booking) || disabled}>
        {uiState === "action_submitting" ? "Đang xử lý..." : "Cho xe ra bãi"}
      </button>
    </div>
  );
}
