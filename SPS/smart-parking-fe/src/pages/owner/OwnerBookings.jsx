import { useMemo, useState } from "react";
import { formatCurrency, formatDateTime, SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

export default function OwnerBookings() {
  const { ownerData, actions } = useOwnerContext();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);

  const filteredBookings = useMemo(() => ownerData.bookings.filter((booking) => (
    statusFilter === "all" ? true : booking.status === statusFilter
  )), [ownerData.bookings, statusFilter]);

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách đơn đặt chỗ"
        subtitle="Theo dõi booking của bãi và hỗ trợ khách khi phát sinh sự cố như quên điện thoại."
        actions={
          <select className="owner-input owner-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="in_progress">Đang hoạt động</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        }
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Người dùng</th>
                <th>Biển số</th>
                <th>Thời gian vào</th>
                <th>Thời gian ra</th>
                <th>Giá tiền</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.code}</td>
                  <td>{booking.user}</td>
                  <td>{booking.plate}</td>
                  <td>{formatDateTime(booking.startTime)}</td>
                  <td>{formatDateTime(booking.endTime)}</td>
                  <td>{formatCurrency(booking.price)}</td>
                  <td><StatusBadge status={booking.status} /></td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-primary owner-btn owner-btn--small" onClick={() => actions.updateBookingStatus(booking.id, "confirmed")}>Xác nhận</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.updateBookingStatus(booking.id, "cancelled")}>Hủy</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking({ ...booking, supportMode: true })}>Hỗ trợ khách</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking(booking)}>Chi tiết</button>
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
          <div className="owner-modal owner-modal--detail" onClick={(event) => event.stopPropagation()}>
            <div className="owner-modal-head">
              <div>
                <h2>{selectedBooking.code}</h2>
                <p>Thông tin chi tiết booking dành cho vận hành bãi đỗ.</p>
              </div>
              <button type="button" className="owner-modal-close" onClick={() => setSelectedBooking(null)}>×</button>
            </div>
            <div className="owner-detail-grid">
              <div><span>Khách hàng</span><strong>{selectedBooking.user}</strong></div>
              <div><span>Số điện thoại</span><strong>{selectedBooking.phone}</strong></div>
              <div><span>Biển số</span><strong>{selectedBooking.plate}</strong></div>
              <div><span>Chỗ đỗ</span><strong>{selectedBooking.slotCode} • {selectedBooking.zone}</strong></div>
              <div><span>Giờ vào</span><strong>{formatDateTime(selectedBooking.startTime)}</strong></div>
              <div><span>Giờ ra</span><strong>{formatDateTime(selectedBooking.endTime)}</strong></div>
              <div><span>Giá tiền</span><strong>{formatCurrency(selectedBooking.price)}</strong></div>
              <div><span>Trạng thái</span><strong><StatusBadge status={selectedBooking.status} /></strong></div>
            </div>
            {selectedBooking.supportMode ? (
              <div className="owner-support-box">
                <strong>Hướng hỗ trợ nhanh</strong>
                <p>Xác minh biển số, số điện thoại và mã booking trước khi hỗ trợ khách vào hoặc ra bãi thay cho điện thoại.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
