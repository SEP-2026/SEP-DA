import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";
import "./BookingHistory.css";

const ACTIVE_STATUSES = ["pending", "booked", "checked_in"];

const fmtDateTime = (value) => {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toDatetimeLocal = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const statusText = (status) => {
  const map = {
    pending: "Chờ thanh toán",
    booked: "Đã đặt",
    checked_in: "Đang gửi xe",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };
  return map[status] || status || "N/A";
};

const statusClass = (status) => {
  const map = {
    pending: "is-pending",
    booked: "is-booked",
    checked_in: "is-checked-in",
    completed: "is-completed",
    cancelled: "is-cancelled",
  };
  return map[status] || "is-pending";
};

const buildGoogleMapsLinks = (parking) => {
  const name = parking?.name?.trim() || "";
  const address = parking?.address?.trim() || "";
  const destinationText = address || name;
  const searchText = [name, address].filter(Boolean).join(", ") || destinationText;

  if (!destinationText) {
    return { directionsUrl: "", mapUrl: "" };
  }

  return {
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationText)}`,
    mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(searchText)}`,
  };
};

const timelineSegments = (oldStartRaw, oldEndRaw, newStartRaw, newEndRaw) => {
  const oldStart = new Date(oldStartRaw);
  const oldEnd = new Date(oldEndRaw);
  const newStart = new Date(newStartRaw);
  const newEnd = new Date(newEndRaw);

  if (
    Number.isNaN(oldStart.getTime()) ||
    Number.isNaN(oldEnd.getTime()) ||
    Number.isNaN(newStart.getTime()) ||
    Number.isNaN(newEnd.getTime())
  ) {
    return null;
  }

  const minStart = Math.min(oldStart.getTime(), newStart.getTime());
  const maxEnd = Math.max(oldEnd.getTime(), newEnd.getTime());
  const total = maxEnd - minStart;
  if (total <= 0) {
    return null;
  }

  const overlapStart = Math.max(oldStart.getTime(), newStart.getTime());
  const overlapEnd = Math.min(oldEnd.getTime(), newEnd.getTime());

  const toPct = (value) => ((value - minStart) / total) * 100;

  return {
    old: {
      left: toPct(oldStart.getTime()),
      width: ((oldEnd.getTime() - oldStart.getTime()) / total) * 100,
    },
    requested: {
      left: toPct(newStart.getTime()),
      width: ((newEnd.getTime() - newStart.getTime()) / total) * 100,
    },
    overlap:
      overlapEnd > overlapStart
        ? {
            left: toPct(overlapStart),
            width: ((overlapEnd - overlapStart) / total) * 100,
          }
        : null,
  };
};

export default function BookingHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrModal, setQrModal] = useState({ isOpen: false, bookingId: null, qrUrl: null, loading: false });

  const initialConflict = location.state?.conflictContext || null;
  const [conflictContext, setConflictContext] = useState(initialConflict);
  const [editMode, setEditMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [slotOptions, setSlotOptions] = useState([]);

  const conflictingBooking = conflictContext?.conflicting_booking || null;
  const requestedBooking = conflictContext?.requested_booking_view || conflictContext?.requested_booking || null;
  const pendingCreatePayload = conflictContext?.pending_create_payload || null;

  const [editForm, setEditForm] = useState(() => ({
    checkin_time: toDatetimeLocal(conflictingBooking?.checkin_time),
    checkout_time: toDatetimeLocal(conflictingBooking?.checkout_time),
    slot_id: conflictingBooking?.slot_id || "",
  }));

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/booking/my");
        setBookings(res.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Không tải được lịch sử booking");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    setEditForm({
      checkin_time: toDatetimeLocal(conflictingBooking?.checkin_time),
      checkout_time: toDatetimeLocal(conflictingBooking?.checkout_time),
      slot_id: conflictingBooking?.slot_id || "",
    });
  }, [conflictingBooking?.booking_id]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!conflictingBooking?.parking_id || !editMode) {
        setSlotOptions([]);
        return;
      }
      try {
        const res = await API.get("/slots", {
          params: { parking_id: conflictingBooking.parking_id },
        });
        const options = (res.data || []).filter(
          (slot) => slot.status === "available" || slot.id === conflictingBooking.slot_id,
        );
        setSlotOptions(options);
      } catch {
        setSlotOptions([]);
      }
    };

    loadSlots();
  }, [conflictingBooking?.parking_id, conflictingBooking?.slot_id, editMode]);

  const activeBookings = useMemo(
    () => bookings.filter((item) => ACTIVE_STATUSES.includes(item.status)),
    [bookings],
  );

  const segments = useMemo(() => {
    if (!conflictingBooking || !requestedBooking) {
      return null;
    }
    return timelineSegments(
      conflictingBooking.checkin_time,
      conflictingBooking.checkout_time,
      requestedBooking.checkin_time,
      requestedBooking.checkout_time,
    );
  }, [conflictingBooking, requestedBooking]);

  const retryCreatePending = async () => {
    if (!pendingCreatePayload) {
      throw new Error("Không có dữ liệu booking mới để tạo lại");
    }

    const createRes = await API.post("/booking/create", pendingCreatePayload);
    navigate(`/payment/${createRes.data.booking_id}`, {
      state: { booking: createRes.data },
    });
  };

  const refreshBookings = async () => {
    const res = await API.get("/booking/my");
    setBookings(res.data || []);
  };

  const handleViewQr = async (bookingId) => {
    setQrModal({ isOpen: true, bookingId, qrUrl: null, loading: true });
    try {
      const res = await API.get(`/bookings/${bookingId}/qr`);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const fullQrUrl = `${baseUrl}${res.data.qr_url}`;
      setQrModal({ isOpen: true, bookingId, qrUrl: fullQrUrl, loading: false });
    } catch (err) {
      setQrModal({ isOpen: true, bookingId, qrUrl: null, loading: false, error: err?.response?.data?.detail || "Lỗi tải QR" });
    }
  };

  const handleDownloadQr = async () => {
    if (!qrModal.qrUrl) {
      return;
    }
    try {
      const response = await fetch(qrModal.qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `booking-${qrModal.bookingId}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Handle download error silently
    }
  };

  const closeQrModal = () => {
    setQrModal({ isOpen: false, bookingId: null, qrUrl: null, loading: false });
  };

  const handleKeepOldBooking = () => {
    setConflictContext(null);
    setEditMode(false);
    setNotice("Bạn đã chọn giữ booking cũ. Hệ thống đã hủy thao tác đặt mới.");
  };

  const handleUpdateOldBooking = async () => {
    if (!conflictingBooking?.booking_id) {
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setNotice("");

      await API.patch(`/booking/my/${conflictingBooking.booking_id}`, {
        slot_id: Number(editForm.slot_id),
        checkin_time: new Date(editForm.checkin_time).toISOString(),
        checkout_time: new Date(editForm.checkout_time).toISOString(),
      });

      await refreshBookings();
      await retryCreatePending();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.reason === "overlap_booking") {
        setConflictContext((prev) => ({ ...prev, ...detail }));
      }
      setError(
        (typeof detail === "string" && detail) ||
          detail?.message ||
          "Cập nhật booking cũ thất bại",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelOldAndRebook = async () => {
    if (!conflictingBooking?.booking_id) {
      return;
    }

    const confirmCancel = window.confirm("Bạn có chắc muốn hủy booking hiện tại không?");
    if (!confirmCancel) {
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setNotice("");

      await API.post(`/booking/my/${conflictingBooking.booking_id}/cancel`);
      await refreshBookings();
      await retryCreatePending();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.reason === "overlap_booking") {
        setConflictContext((prev) => ({ ...prev, ...detail }));
      }
      setError(
        (typeof detail === "string" && detail) ||
          detail?.message ||
          "Hủy booking cũ và đặt lại thất bại",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="page-wrap booking-history-wrap">
      <div className="page-card booking-history-shell">
        <header className="booking-history-head">
          <h1 className="page-title">Lịch sử booking</h1>
          <p className="page-subtitle">Theo dõi booking hiện tại và xử lý booking bị trùng nhanh chóng</p>
        </header>

        {notice && <p className="booking-history-notice">{notice}</p>}
        {error && <p className="booking-history-error">{error}</p>}

        {conflictContext && conflictingBooking && requestedBooking && (
          <section className="conflict-panel">
            <h2>Thông báo lỗi booking bị trùng</h2>
            <p className="conflict-message">
              {conflictContext.message || "Booking mới của bạn bị trùng với booking hiện tại."}
            </p>

            <div className="conflict-grid">
              <article className="conflict-card old-booking">
                <h3>Booking đang gây xung đột</h3>
                <p><strong>Mã booking:</strong> #{conflictingBooking.booking_id}</p>
                <p><strong>Bãi xe:</strong> {conflictingBooking.parking_name || "N/A"}</p>
                <p><strong>Vị trí:</strong> {conflictingBooking.slot_code || conflictingBooking.slot_id}</p>
                <p><strong>Biển số:</strong> {conflictingBooking.license_plate || "N/A"}</p>
                <p><strong>Check-in:</strong> {fmtDateTime(conflictingBooking.checkin_time)}</p>
                <p><strong>Check-out:</strong> {fmtDateTime(conflictingBooking.checkout_time)}</p>
                <p>
                  <strong>Trạng thái:</strong>{" "}
                  <span className={`status-chip ${statusClass(conflictingBooking.status)}`}>
                    {statusText(conflictingBooking.status)}
                  </span>
                </p>
              </article>

              <article className="conflict-card new-booking">
                <h3>Booking mới bạn vừa nhập</h3>
                <p><strong>Bãi xe mới:</strong> {requestedBooking.parking_name || requestedBooking.parking_id || "N/A"}</p>
                <p><strong>Vị trí mới:</strong> {requestedBooking.slot_code || requestedBooking.slot_id || "N/A"}</p>
                <p><strong>Check-in mới:</strong> {fmtDateTime(requestedBooking.checkin_time)}</p>
                <p><strong>Check-out mới:</strong> {fmtDateTime(requestedBooking.checkout_time)}</p>
                <p><strong>Giá dự kiến:</strong> {Number(requestedBooking.estimated_total_amount || 0).toLocaleString("vi-VN")}đ</p>
              </article>
            </div>

            {segments && (
              <div className="timeline-box">
                <h3>Lịch / timeline trực quan</h3>
                <div className="timeline-track">
                  <div className="timeline-bar timeline-old" style={{ left: `${segments.old.left}%`, width: `${segments.old.width}%` }} />
                  <div className="timeline-bar timeline-new" style={{ left: `${segments.requested.left}%`, width: `${segments.requested.width}%` }} />
                  {segments.overlap && (
                    <div className="timeline-bar timeline-overlap" style={{ left: `${segments.overlap.left}%`, width: `${segments.overlap.width}%` }} />
                  )}
                </div>
                <div className="timeline-legend">
                  <span><i className="dot old" /> Xanh = booking cũ</span>
                  <span><i className="dot overlap" /> Đỏ = phần bị trùng</span>
                  <span><i className="dot requested" /> Vàng = booking mới</span>
                </div>
              </div>
            )}

            <div className="action-cards">
              <button type="button" className="action-card" onClick={handleKeepOldBooking} disabled={processing}>
                <strong>Giữ booking cũ</strong>
                <span>Hủy thao tác đặt mới và quay về danh sách booking</span>
              </button>

              <button
                type="button"
                className="action-card"
                onClick={() => setEditMode((value) => !value)}
                disabled={processing}
              >
                <strong>Chỉnh sửa booking cũ</strong>
                <span>Mở form chỉnh thời gian / đổi vị trí rồi tạo lại booking mới</span>
              </button>

              <button type="button" className="action-card danger" onClick={handleCancelOldAndRebook} disabled={processing}>
                <strong>Hủy booking cũ và đặt lại</strong>
                <span>Chuyển booking cũ sang Đã hủy, sau đó tự động tạo booking mới</span>
              </button>
            </div>

            {editMode && (
              <div className="edit-panel">
                <h3>Chỉnh sửa booking cũ</h3>
                <div className="edit-grid">
                  <label>
                    Thời gian check-in
                    <input
                      type="datetime-local"
                      value={editForm.checkin_time}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, checkin_time: event.target.value }))}
                    />
                  </label>
                  <label>
                    Thời gian check-out
                    <input
                      type="datetime-local"
                      value={editForm.checkout_time}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, checkout_time: event.target.value }))}
                    />
                  </label>
                  <label>
                    Đổi vị trí (nếu cần)
                    <select
                      value={editForm.slot_id}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, slot_id: event.target.value }))}
                    >
                      {slotOptions.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.code} - {slot.status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" className="btn-primary history-submit" onClick={handleUpdateOldBooking} disabled={processing}>
                  {processing ? "Đang xử lý..." : "Lưu booking cũ và tạo lại booking mới"}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="history-panel">
          <h2>Thông tin booking hiện tại</h2>
          {loading ? <p>Đang tải danh sách booking...</p> : null}

          {!loading && activeBookings.length === 0 && (
            <p className="empty-state">Bạn chưa có booking đang hoạt động.</p>
          )}

          <div className="history-list">
            {activeBookings.map((item) => (
              <article key={item.booking_id} className="history-item">
                {(() => {
                  const { directionsUrl, mapUrl } = buildGoogleMapsLinks(item.parking);
                  return (
                    <>
                <header>
                  <h3>#{item.booking_id}</h3>
                  <span className={`status-chip ${statusClass(item.status)}`}>{statusText(item.status)}</span>
                </header>
                <p><strong>Bãi xe:</strong> {item.parking?.name || "N/A"}</p>
                <p><strong>Địa chỉ:</strong> {item.parking?.address || "N/A"}</p>
                <p><strong>Vị trí:</strong> {item.slot?.code || item.slot?.id || "N/A"}</p>
                <p><strong>Biển số:</strong> {item.vehicle?.license_plate || "N/A"}</p>
                <p><strong>Check-in:</strong> {fmtDateTime(item.checkin_time)}</p>
                <p><strong>Check-out:</strong> {fmtDateTime(item.checkout_time)}</p>
                <p><strong>Tổng tiền:</strong> {Number(item.total_amount || 0).toLocaleString("vi-VN")}đ</p>
                {directionsUrl && mapUrl && (
                  <div className="history-item-actions">
                    {item.status !== "pending" && (
                      <button
                        type="button"
                        className="btn-qr"
                        onClick={() => handleViewQr(item.booking_id)}
                        title="Xem mã QR"
                      >
                        <span>Xem QR</span>
                      </button>
                    )}
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-directions"
                      title="Mở Google Maps - Chỉ đường"
                    >
                      <span>Chỉ Đường</span>
                    </a>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-view-map"
                      title="Xem bản đồ"
                    >
                      <span>Xem Bản Đồ</span>
                    </a>
                  </div>
                )}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* QR Code Modal */}
      {qrModal.isOpen && (
        <div className="qr-modal-overlay" onClick={closeQrModal}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={closeQrModal}>×</button>
            <h2>Mã QR - Booking #{qrModal.bookingId}</h2>
            {qrModal.loading && <p>Đang tải mã QR...</p>}
            {qrModal.error && <p className="qr-modal-error">{qrModal.error}</p>}
            {qrModal.qrUrl && (
              <>
                <div className="qr-modal-image">
                  <img src={qrModal.qrUrl} alt="QR Code" />
                </div>
                <button className="qr-modal-download" onClick={handleDownloadQr}>
                  Tải QR
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
