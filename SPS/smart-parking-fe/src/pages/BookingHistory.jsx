import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReviewForm from "../components/ReviewForm";
import API from "../services/api";
import { formatDateTimeVN, parseVietnamDate, toDatetimeLocalValue, toVietnamIsoString } from "../utils/dateTime";
import "./BookingHistory.css";

const ACTIVE_STATUSES = ["pending", "booked", "checked_in", "checked_out", "completed"];
const BOOKING_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "not_checked_in", label: "Chưa check in" },
  { key: "checked_in", label: "Đang check in" },
  { key: "checked_out", label: "Đã check out" },
  { key: "review", label: "Đánh giá" },
];

const fmtDateTime = (value) => {
  return formatDateTimeVN(value, "N/A");
};

const toDatetimeLocal = (value) => {
  return toDatetimeLocalValue(value);
};

const formatDuration = (start, end) => {
  const startDate = parseVietnamDate(start);
  const endDate = parseVietnamDate(end);
  if (!startDate || !endDate) return "N/A";
  const totalMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} giờ ${minutes} phút`;
};

const statusText = (status) => {
  const map = {
    pending: "Chờ thanh toán",
    booked: "Đã đặt",
    checked_in: "Đang gửi xe",
    checked_out: "Đã check-out",
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
    checked_out: "is-completed",
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
  const oldStart = parseVietnamDate(oldStartRaw);
  const oldEnd = parseVietnamDate(oldEndRaw);
  const newStart = parseVietnamDate(newStartRaw);
  const newEnd = parseVietnamDate(newEndRaw);

  if (
    !oldStart ||
    !oldEnd ||
    !newStart ||
    !newEnd ||
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
  const [reviewModal, setReviewModal] = useState({ isOpen: false, booking: null, review: null, loading: false, error: "" });

  const initialConflict = location.state?.conflictContext || null;
  const [conflictContext, setConflictContext] = useState(initialConflict);
  const [editMode, setEditMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [slotOptions, setSlotOptions] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

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

  useEffect(() => {
    const checkedIn = bookings.filter((item) => (item.checkin_status || item.status) === "checked_in");
    if (!checkedIn.length) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const updates = await Promise.all(
          checkedIn.map(async (item) => {
            const res = await API.get(`/bookings/${item.booking_id}/status`);
            return { booking_id: item.booking_id, payload: res.data };
          }),
        );
        setBookings((prev) =>
          prev.map((item) => {
            const found = updates.find((u) => u.booking_id === item.booking_id);
            if (!found) return item;
            return {
              ...item,
              checkin_status: found.payload.checkin_status,
              actual_checkin: found.payload.actual_checkin || item.actual_checkin,
              actual_checkout: found.payload.actual_checkout || item.actual_checkout,
              overstay_fee: found.payload.overstay_fee,
              total_actual_fee: found.payload.total_actual_fee,
            };
          }),
        );
      } catch {
        // Ignore a failed poll cycle.
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [bookings]);

  const activeBookings = useMemo(
    () => bookings.filter((item) => ACTIVE_STATUSES.includes(item.status)),
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const normalizedStatus = (item) => `${item.checkin_status || item.status || ""}`.toLowerCase();
    if (activeTab === "all") return activeBookings;
    if (activeTab === "not_checked_in") {
      return activeBookings.filter((item) => ["pending", "booked"].includes(normalizedStatus(item)));
    }
    if (activeTab === "checked_in") {
      return activeBookings.filter((item) => normalizedStatus(item) === "checked_in");
    }
    if (activeTab === "checked_out" || activeTab === "review") {
      return activeBookings.filter((item) => {
        const status = normalizedStatus(item);
        const isCheckedOut = status === "checked_out" || status === "completed";
        if (activeTab === "review") {
          return isCheckedOut && Boolean(item.has_review);
        }
        return isCheckedOut;
      });
    }
    return activeBookings;
  }, [activeBookings, activeTab]);

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

  const openReviewModal = async (booking, mode = "view") => {
    setReviewModal({ isOpen: true, booking, review: null, loading: mode === "view", error: "" });
    if (mode !== "view") {
      return;
    }
    try {
      const res = await API.get(`/reviews/booking/${booking.booking_id}`);
      setReviewModal({ isOpen: true, booking, review: res.data, loading: false, error: "" });
    } catch (err) {
      setReviewModal({
        isOpen: true,
        booking,
        review: null,
        loading: false,
        error: err?.response?.data?.detail || "Không tải được đánh giá",
      });
    }
  };

  const closeReviewModal = () => {
    setReviewModal({ isOpen: false, booking: null, review: null, loading: false, error: "" });
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
          <div className="history-tabs" role="tablist" aria-label="Bộ lọc lịch sử booking">
            {BOOKING_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                className={`history-tab ${activeTab === tab.key ? "active" : ""}`}
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {loading ? <p>Đang tải danh sách booking...</p> : null}

          {!loading && filteredBookings.length === 0 && (
            <p className="empty-state">
              {activeTab === "review"
                ? "Chưa có booking nào đã được đánh giá."
                : "Không có booking trong tab này."}
            </p>
          )}

          <div className="history-list">
            {filteredBookings.map((item) => (
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
                {((item.checkin_status || item.status) === "checked_out" || item.status === "completed") ? (
                  <>
                    <p><strong>✅ Trạng thái:</strong> Đã check-out</p>
                    <p><strong>Check-in thực tế:</strong> {fmtDateTime(item.actual_checkin)}</p>
                    <p><strong>Check-out thực tế:</strong> {fmtDateTime(item.actual_checkout)}</p>
                    <p><strong>Thời gian:</strong> {formatDuration(item.actual_checkin || item.checkin_time, item.actual_checkout || item.checkout_time)}</p>
                    <p><strong>Phí đặt chỗ gốc:</strong> {Number(item.total_amount || 0).toLocaleString("vi-VN")}đ</p>
                    <p><strong>Phí quá giờ:</strong> {Number(item.overstay_fee || 0).toLocaleString("vi-VN")}đ</p>
                    <p><strong>Tổng cộng:</strong> {Number(item.total_actual_fee || item.total_amount || 0).toLocaleString("vi-VN")}đ</p>
                  </>
                ) : null}
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
                    {((item.checkin_status || item.status) === "checked_out" || item.status === "completed") ? (
                      item.is_reviewed ? (
                        <button type="button" className="btn-qr" onClick={() => openReviewModal(item, "view")}>
                          <span>Xem đánh giá</span>
                        </button>
                      ) : (
                        <button type="button" className="btn-qr" onClick={() => openReviewModal(item, "create")}>
                          <span>⭐ Đánh giá</span>
                        </button>
                      )
                    ) : null}
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
      {reviewModal.isOpen && (
        <div className="qr-modal-overlay" onClick={closeReviewModal}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={closeReviewModal}>×</button>
            {reviewModal.loading ? <p>Đang tải đánh giá...</p> : null}
            {reviewModal.error ? <p className="qr-modal-error">{reviewModal.error}</p> : null}

            {!reviewModal.loading && !reviewModal.review && reviewModal.booking && !reviewModal.booking.is_reviewed ? (
              <ReviewForm
                bookingId={reviewModal.booking.booking_id}
                parkingName={reviewModal.booking.parking?.name}
                onSkip={closeReviewModal}
                onSubmit={(result) => {
                  setReviewModal((prev) => ({
                    ...prev,
                    review: {
                      review_id: result.review_id,
                      booking_id: result.booking_id,
                      rating: result.rating,
                      comment: result.comment,
                      owner_reply: null,
                      owner_replied_at: null,
                      created_at: result.created_at,
                    },
                  }));
                  setBookings((prev) =>
                    prev.map((item) =>
                      item.booking_id === result.booking_id ? { ...item, is_reviewed: true, has_review: true } : item,
                    ),
                  );
                }}
              />
            ) : null}

            {reviewModal.review ? (
              <div className="booking-review-result">
                <h3>✅ Đánh giá của bạn</h3>
                <p className="owner-review-rating">{"★".repeat(reviewModal.review.rating)}{"☆".repeat(5 - reviewModal.review.rating)} ({reviewModal.review.rating}/5)</p>
                <p>"{reviewModal.review.comment || "Không có nhận xét."}"</p>
                <p>Gửi lúc: {fmtDateTime(reviewModal.review.created_at)}</p>
                <p><strong>Phản hồi từ chủ bãi:</strong></p>
                {reviewModal.review.owner_reply ? (
                  <p>💬 "{reviewModal.review.owner_reply}"</p>
                ) : (
                  <p>⏳ Chưa có phản hồi từ chủ bãi</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
