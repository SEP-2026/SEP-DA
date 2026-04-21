import { useState } from "react";
import { SectionCard, StatusBadge, formatCurrency, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function BookingManagement() {
  const { adminData, actions } = useAdminContext();
  const [selectedBooking, setSelectedBooking] = useState(null);
  return (
    <div className="owner-page-grid">
      <SectionCard title="Toàn bộ đặt chỗ" subtitle="Theo dõi đặt chỗ toàn hệ thống, xem chi tiết và hủy khi cần.">
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Người dùng</th><th>Biển số</th><th>Bãi đỗ</th><th>Giờ vào</th><th>Giờ ra</th><th>Trạng thái</th><th>Giá</th><th>Bất thường</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {adminData.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.user}</td>
                  <td>{booking.plate}</td>
                  <td>{booking.parkingLot}</td>
                  <td>{formatDateTime(booking.checkIn)}</td>
                  <td>{formatDateTime(booking.checkOut)}</td>
                  <td><StatusBadge status={booking.status} /></td>
                  <td>{formatCurrency(booking.amount)}</td>
                  <td>{booking.anomaly ? <StatusBadge status="warning" /> : <StatusBadge status="success" />}</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking(booking)}>Chi tiết</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.updateBookingStatus(booking.id, "cancelled")}>Hủy</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {selectedBooking ? (
        <div className="owner-modal-backdrop" onClick={() => setSelectedBooking(null)}>
          <div className="owner-modal owner-modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head"><div><h2>{selectedBooking.id}</h2><p>Chi tiết booking cấp hệ thống.</p></div><button type="button" className="owner-modal-close" onClick={() => setSelectedBooking(null)}>×</button></div>
            <div className="owner-detail-grid">
              <div><span>User</span><strong>{selectedBooking.user}</strong></div>
              <div><span>Biển số</span><strong>{selectedBooking.plate}</strong></div>
              <div><span>Bãi đỗ</span><strong>{selectedBooking.parkingLot}</strong></div>
              <div><span>Trạng thái</span><strong><StatusBadge status={selectedBooking.status} /></strong></div>
              <div><span>Check-in</span><strong>{formatDateTime(selectedBooking.checkIn)}</strong></div>
              <div><span>Check-out</span><strong>{formatDateTime(selectedBooking.checkOut)}</strong></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
