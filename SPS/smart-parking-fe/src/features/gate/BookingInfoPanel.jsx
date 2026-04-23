import { formatDateTime, formatInputType } from "./gateFormatters";
import { getBookingStatusLabel } from "./statusLabel";

export default function BookingInfoPanel({ booking }) {
  const checkinTime = booking?.checkin_time || booking?.start_time;
  const checkoutTime = booking?.checkout_time || booking?.expire_time;

  return (
    <div className="scan-summary">
      <h2>Thông tin booking tại cổng</h2>
      <div className="scan-summary-list">
        <div>
          <span>Mã booking</span>
          <strong>{booking?.booking_id || "--"}</strong>
        </div>
        <div>
          <span>Nguồn dữ liệu</span>
          <strong>{formatInputType(booking?.input_type)}</strong>
        </div>
        <div>
          <span>Bãi đỗ</span>
          <strong>{booking?.parking?.name || "--"}</strong>
        </div>
        <div>
          <span>Vị trí / slot</span>
          <strong>{booking?.slot?.code || "--"}</strong>
        </div>
        <div>
          <span>Biển số</span>
          <strong>{booking?.vehicle?.license_plate || "--"}</strong>
        </div>
        <div>
          <span>Chủ xe</span>
          <strong>{booking?.vehicle?.owner_name || "--"}</strong>
        </div>
        <div>
          <span>Loại booking</span>
          <strong>{booking?.booking_mode_label || "--"}</strong>
        </div>
        <div>
          <span>Trạng thái</span>
          <strong>{getBookingStatusLabel(booking?.booking_status)}</strong>
        </div>
        <div>
          <span>Thời gian booking</span>
          <strong>{`${formatDateTime(checkinTime)} - ${formatDateTime(checkoutTime)}`}</strong>
        </div>
        <div>
          <span>Thời gian vào thực tế</span>
          <strong>{formatDateTime(booking?.actual_checkin)}</strong>
        </div>
        <div>
          <span>Thời gian ra thực tế</span>
          <strong>{formatDateTime(booking?.actual_checkout)}</strong>
        </div>
      </div>
    </div>
  );
}
