import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency, formatDateTime, SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

export default function OwnerBookings() {
  const { ownerData, actions, isSyncing } = useOwnerContext();
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("row");
  const [selectedBooking, setSelectedBooking] = useState(null);

  const rowLimitOptions = [5, 10, 25];
  const viewOptions = [
    { value: "row", label: "Hiện ngang" },
    { value: "card", label: "Từng ô" },
  ];

  const filteredBookings = useMemo(() => ownerData.bookings.filter((booking) => (
    statusFilter === "all" ? true : booking.status === statusFilter
  )), [ownerData.bookings, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const visibleBookings = useMemo(
    () => filteredBookings.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredBookings, currentPage, rowsPerPage]
  );

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách đơn đặt chỗ"
        subtitle="Theo dõi booking của bãi và hỗ trợ khách khi phát sinh sự cố như quên điện thoại."
        actions={
          <>
            <select className="owner-input owner-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang hoạt động</option>
              <option value="completed">Hoàn tất</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <div className="owner-segment owner-segment--limits">
              {rowLimitOptions.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  className={`owner-segment-button ${rowsPerPage === limit ? "active" : ""}`}
                  onClick={() => setRowsPerPage(limit)}
                >
                  {limit}
                </button>
              ))}
            </div>
            <div className="owner-segment owner-segment--view-mode">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`owner-segment-button ${viewMode === option.value ? "active" : ""}`}
                  onClick={() => setViewMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        }
      >
        {isSyncing ? <p className="owner-empty">Đang đồng bộ booking từ CSDL...</p> : null}
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Bãi đỗ</th>
                <th>Người dùng</th>
                <th>Biển số</th>
                <th>Thời gian vào</th>
                <th>Thời gian ra</th>
                <th>Giờ booking</th>
                <th>Giá tiền</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {!isSyncing && filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="owner-empty-cell">Chưa có booking nào khớp bộ lọc hiện tại.</td>
                </tr>
              ) : null}
              {viewMode === "row" ? (
                visibleBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.code}</td>
                    <td>{booking.parkingLotName || "Chưa có bãi"}</td>
                    <td>{booking.user}</td>
                    <td>{booking.plate}</td>
                    <td>{formatDateTime(booking.startTime)}</td>
                    <td>{formatDateTime(booking.endTime)}</td>
                    <td>
                      {formatDateTime(booking.bookingStartTime)}
                      <br />
                      {formatDateTime(booking.bookingEndTime)}
                    </td>
                    <td>{formatCurrency(booking.price)}</td>
                    <td><StatusBadge status={booking.status} /></td>
                    <td>
                      <div className="owner-row-actions">
                        {booking.status === "pending" ? (
                          <button type="button" className="btn-primary owner-btn owner-btn--small" onClick={() => actions.updateBookingStatus(booking.id, "confirmed")}>Xác nhận</button>
                        ) : null}
                        {booking.status !== "cancelled" && booking.status !== "completed" ? (
                          <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.updateBookingStatus(booking.id, "cancelled")}>Hủy</button>
                        ) : null}
                        <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking({ ...booking, supportMode: true })}>Hỗ trợ khách</button>
                        <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking(booking)}>Chi tiết</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="owner-card-view-cell">
                    <div className="owner-booking-card-grid">
                      {visibleBookings.map((booking) => (
                        <article className="owner-booking-card" key={booking.id}>
                          <div className="owner-booking-card-head">
                            <strong>{booking.code}</strong>
                            <StatusBadge status={booking.status} />
                          </div>
                          <div className="owner-booking-card-body">
                            <p><span>Bãi đỗ</span> {booking.parkingLotName || "Chưa có bãi"}</p>
                            <p><span>Người dùng</span> {booking.user}</p>
                            <p><span>Biển số</span> {booking.plate}</p>
                            <p><span>Giờ booking</span> {formatDateTime(booking.bookingStartTime)} - {formatDateTime(booking.bookingEndTime)}</p>
                            <p><span>Giá tiền</span> {formatCurrency(booking.price)}</p>
                          </div>
                          <div className="owner-booking-card-actions">
                            {booking.status === "pending" ? (
                              <button type="button" className="btn-primary owner-btn owner-btn--small" onClick={() => actions.updateBookingStatus(booking.id, "confirmed")}>Xác nhận</button>
                            ) : null}
                            {booking.status !== "cancelled" && booking.status !== "completed" ? (
                              <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.updateBookingStatus(booking.id, "cancelled")}>Hủy</button>
                            ) : null}
                            <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking({ ...booking, supportMode: true })}>Hỗ trợ khách</button>
                            <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedBooking(booking)}>Chi tiết</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredBookings.length > rowsPerPage ? (
          <div className="owner-pagination">
            <button
              type="button"
              className="owner-pagination-button owner-pagination-button--arrow"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`owner-pagination-button ${currentPage === page ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="owner-pagination-button owner-pagination-button--arrow"
              disabled={currentPage === pageCount}
              onClick={() => setCurrentPage((page) => Math.min(page + 1, pageCount))}
            >
              ›
            </button>
          </div>
        ) : null}
      </SectionCard>

      {selectedBooking ? createPortal(
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
              <div><span>Bãi đỗ</span><strong>{selectedBooking.parkingLotName || "Chưa có bãi"}</strong></div>
              <div><span>Khách hàng</span><strong>{selectedBooking.user}</strong></div>
              <div><span>Số điện thoại</span><strong>{selectedBooking.phone}</strong></div>
              <div><span>Biển số</span><strong>{selectedBooking.plate}</strong></div>
              <div><span>Chỗ đỗ</span><strong>{selectedBooking.slotCode} • {selectedBooking.zone}</strong></div>
              <div><span>Giờ vào thực tế</span><strong>{formatDateTime(selectedBooking.startTime)}</strong></div>
              <div><span>Giờ ra thực tế</span><strong>{formatDateTime(selectedBooking.endTime)}</strong></div>
              <div><span>Giờ booking</span><strong>{formatDateTime(selectedBooking.bookingStartTime)}</strong></div>
              <div><span>Giờ kết thúc booking</span><strong>{formatDateTime(selectedBooking.bookingEndTime)}</strong></div>
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
      , document.body) : null}
    </div>
  );
}
