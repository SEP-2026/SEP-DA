import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import "./Home.css";

const OWNER_VISIBLE_BOOKING_STATUSES = new Set(["pending", "confirmed", "in_progress"]);

function formatStatusLabel(status) {
  const mapping = {
    available: "Trống",
    reserved: "Giữ chỗ",
    occupied: "Đã có xe",
    maintenance: "Bảo trì",
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    in_progress: "Đang trong bãi",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };

  return mapping[status] || status || "Không rõ";
}

function formatDateTime(value) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
}

function getDesktopColumns() {
  if (typeof window === "undefined") {
    return 5;
  }
  if (window.innerWidth <= 640) {
    return 2;
  }
  if (window.innerWidth <= 992) {
    return 3;
  }
  return 5;
}

function getPopoverPosition(anchorRect, compact = false, slotIndex = 0) {
  if (!anchorRect || typeof window === "undefined") {
    return { top: 0, left: 0, placement: "right", arrowOffset: 48, maxHeight: null, width: compact ? 420 : 520 };
  }

  if (window.innerWidth <= 640) {
    return { top: 0, left: 0, placement: "sheet", arrowOffset: 0, maxHeight: Math.round(window.innerHeight * 0.62), width: 0 };
  }

  const width = Math.min(compact ? 420 : 520, window.innerWidth - 24);
  const gap = 2;
  const margin = 12;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const viewportLeft = scrollX;
  const viewportRight = scrollX + window.innerWidth;
  const anchorCenterX = anchorRect.left + (anchorRect.width / 2);
  const anchorLeft = anchorRect.left;
  const anchorRight = anchorRect.right;
  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.bottom;
  const anchorCenterY = anchorTop + (anchorRect.height / 2);
  const columns = getDesktopColumns();
  const columnIndex = slotIndex % columns;
  const openBottom = columns >= 5 && columnIndex === 2;
  const openRight = columnIndex < Math.floor(columns / 2);

  let placement = openBottom ? "bottom" : (openRight ? "right" : "left");
  let left = scrollX;

  if (placement === "bottom") {
    left = Math.max(
      viewportLeft + margin,
      Math.min(scrollX + anchorCenterX - (width / 2), viewportRight - width - margin),
    );
  } else {
    left = scrollX + (placement === "right" ? anchorRight + gap : anchorLeft - width - gap);

    if (placement === "right" && left + width > viewportRight - margin) {
      placement = "left";
      left = scrollX + anchorLeft - width - gap;
    } else if (placement === "left" && left < viewportLeft + margin) {
      placement = "right";
      left = scrollX + anchorRight + gap;
    }

    if (placement === "right" && left + width > viewportRight - margin) {
      left = viewportRight - width - margin;
    }
    if (placement === "left" && left < viewportLeft + margin) {
      left = viewportLeft + margin;
    }
  }

  const top = scrollY + (placement === "bottom" ? anchorBottom + gap : anchorTop + 6);
  const arrowOffset = placement === "bottom"
    ? Math.max(30, Math.min(width - 30, scrollX + anchorCenterX - left))
    : Math.max(26, Math.min((compact ? 320 : 560) - 26, anchorCenterY - anchorTop + 6));

  return { top, left, placement, arrowOffset, maxHeight: null, width };
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "available") {
    return "success";
  }
  if (normalized === "reserved" || normalized === "pending" || normalized === "confirmed") {
    return "warning";
  }
  if (normalized === "occupied" || normalized === "in_progress") {
    return "danger";
  }
  if (normalized === "maintenance" || normalized === "cancelled") {
    return "muted";
  }
  return "info";
}

function buildOwnerSlotLookup(ownerBootstrap) {
  const ownerParkingId = ownerBootstrap?.parkingLot?.id;
  const slots = Array.isArray(ownerBootstrap?.slots) ? ownerBootstrap.slots : [];
  const bookings = Array.isArray(ownerBootstrap?.bookings) ? ownerBootstrap.bookings : [];

  const slotMap = new Map(
    slots.map((slot) => [
      String(slot.code),
      {
        ...slot,
        booking: null,
      },
    ]),
  );

  bookings.forEach((booking) => {
    if (!OWNER_VISIBLE_BOOKING_STATUSES.has(booking.status)) {
      return;
    }

    const slotKey = String(booking.slotCode);
    if (!slotMap.has(slotKey)) {
      return;
    }

    const existing = slotMap.get(slotKey);
    slotMap.set(slotKey, {
      ...existing,
      booking,
    });
  });

  return { ownerParkingId, slotMap };
}

export default function Home({ role = "" }) {
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [ownerBootstrap, setOwnerBootstrap] = useState(null);
  const popoverRef = useRef(null);

  const isOwner = role === "owner";

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const requests = [API.get("/parking-lots/slots-overview")];
        if (isOwner) {
          requests.push(API.get("/owner/bootstrap"));
        }

        const [overviewRes, ownerRes] = await Promise.all(requests);
        if (!active) {
          return;
        }

        const normalizedLots = (overviewRes.data || []).map((lot) => ({
          ...lot,
          slots: [...(lot.slots || [])].sort((a, b) =>
            String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
          ),
        }));

        setParkingLots(normalizedLots);
        setOwnerBootstrap(ownerRes?.data || null);
      } catch {
        if (!active) {
          return;
        }
        setParkingLots([]);
        setOwnerBootstrap(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [isOwner]);

  const ownerSlotLookup = useMemo(() => buildOwnerSlotLookup(ownerBootstrap), [ownerBootstrap]);

  useEffect(() => {
    if (!selectedSlot) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) {
        return;
      }

      const anchor = document.elementFromPoint(selectedSlot.anchorCenterX, selectedSlot.anchorCenterY);
      if (anchor?.closest?.(`[data-slot-anchor="${selectedSlot.slot.id}"]`)) {
        return;
      }

      setSelectedSlot(null);
    };

    const handleViewportChange = () => {
      setSelectedSlot((prev) => {
        if (!prev) {
          return prev;
        }

        const anchor = document.querySelector(`[data-slot-anchor="${prev.slot.id}"]`);
        if (!anchor) {
          return null;
        }

        const rect = anchor.getBoundingClientRect();
        return {
          ...prev,
          anchorRect: rect,
          anchorCenterX: rect.left + rect.width / 2,
          anchorCenterY: rect.top + rect.height / 2,
        };
      });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [selectedSlot]);

  const handleSlotClick = (lot, slot, slotIndex, event) => {
    if (!isOwner) {
      return;
    }

    const ownerSlotDetail = lot.parking_id === ownerSlotLookup.ownerParkingId
      ? ownerSlotLookup.slotMap.get(String(slot.code)) || null
      : null;
    const anchorRect = event.currentTarget.getBoundingClientRect();

    setSelectedSlot({
      lot,
      slot,
      ownerSlotDetail,
      slotIndex,
      anchorRect,
      anchorCenterX: anchorRect.left + anchorRect.width / 2,
      anchorCenterY: anchorRect.top + anchorRect.height / 2,
    });
  };

  const isCompactPopover = Boolean(selectedSlot) && !selectedSlot.ownerSlotDetail?.booking && !selectedSlot.ownerSlotDetail;
  const popoverPosition = useMemo(
    () => getPopoverPosition(selectedSlot?.anchorRect, isCompactPopover, selectedSlot?.slotIndex || 0),
    [selectedSlot?.anchorRect, isCompactPopover, selectedSlot?.slotIndex],
  );

  return (
    <section className="page-wrap parking-home">
      <div className="page-card parking-board">
        <h1 className="parking-title">Danh sách bãi xe</h1>

        <div className="parking-legend">
          <div className="legend-item">
            <span className="legend-car legend-available">🚗</span>
            <span>Vị trí trống</span>
          </div>
          <div className="legend-item">
            <span className="legend-car legend-occupied">🚗</span>
            <span>Vị trí đã có xe</span>
          </div>
          {isOwner ? (
            <div className="legend-item legend-item--owner">
              <span className="legend-owner-dot" />
              <span>Owner có thể bấm vào ô để xem chi tiết</span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="parking-empty">Đang tải dữ liệu bãi xe...</div>
        ) : null}

        {!loading && parkingLots.length === 0 ? (
          <div className="parking-empty">Chưa có dữ liệu bãi xe để hiển thị.</div>
        ) : null}

        <div className="parking-lot-list">
          {parkingLots.map((lot) => (
            <section key={lot.parking_id} className="parking-lot-card">
              <header className="parking-lot-head">
                <div>
                  <h2 className="parking-lot-name">{lot.parking_name}</h2>
                  <p className="parking-lot-address">{lot.parking_address}</p>
                  {lot.district && <p className="parking-lot-district">{lot.district}</p>}
                </div>
                <div className="parking-lot-stats">
                  <span className="stat-chip stat-available">Trống: {lot.available_slots}</span>
                  <span className="stat-chip stat-occupied">Giữ/Đã có xe: {lot.occupied_or_reserved_slots}</span>
                  <span className="stat-chip stat-total">Tổng: {lot.total_slots}</span>
                </div>
              </header>

              <div className="parking-grid">
                {lot.slots.map((slot, slotIndex) => {
                  const isAvailable = slot.status === "available";

                  return (
                    <article
                      key={slot.id}
                      className={`slot-card${isOwner ? " slot-card--interactive" : ""}`}
                      data-slot-anchor={slot.id}
                      onClick={(event) => handleSlotClick(lot, slot, slotIndex, event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSlotClick(lot, slot, slotIndex, event);
                        }
                      }}
                      role={isOwner ? "button" : undefined}
                      tabIndex={isOwner ? 0 : undefined}
                    >
                      <div className="slot-lane" />
                      <div className={`slot-car ${isAvailable ? "slot-available" : "slot-occupied"}`}>
                        <img
                          src={isAvailable ? "/car-top-view2.png" : "/car-top-view.png"}
                          alt={isAvailable ? "Xe nhìn từ trên xuống - vị trí trống" : "Xe nhìn từ trên xuống - vị trí đã có xe"}
                          className="car-image"
                        />
                      </div>
                      <div className="slot-badge">{slot.code} - {formatStatusLabel(slot.status)}</div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedSlot && typeof document !== "undefined" ? createPortal(
        <div
          ref={popoverRef}
          className={`parking-popover parking-popover--${popoverPosition.placement}${isCompactPopover ? " parking-popover--compact" : ""}`}
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            "--parking-arrow-offset": `${popoverPosition.arrowOffset}px`,
            width: `${isCompactPopover ? Math.min(popoverPosition.width || 640, 420) : (popoverPosition.width || 640)}px`,
          }}
        >
          <div className="parking-popover-arrow" />
          <div
            className="parking-modal"
            style={popoverPosition.maxHeight ? { maxHeight: `${popoverPosition.maxHeight}px` } : undefined}
          >
            <div className="parking-modal-head parking-modal-head--compact">
              <div>
                <p className="parking-modal-kicker">Chi tiết vị trí</p>
                <h2>{selectedSlot.slot.code}</h2>
                <span>{selectedSlot.lot.parking_name}</span>
              </div>
              <button type="button" className="parking-modal-close" onClick={() => setSelectedSlot(null)}>×</button>
            </div>

            <div className={`parking-modal-grid${isCompactPopover ? " parking-modal-grid--compact" : ""}`}>
              <div className="parking-modal-section">
                <h3>Trạng thái bãi</h3>
                <div className="parking-detail-list">
                  <div><span>Bãi xe</span><strong>{selectedSlot.lot.parking_name}</strong></div>
                  <div><span>Địa chỉ</span><strong>{selectedSlot.lot.parking_address}</strong></div>
                  <div><span>Quận</span><strong>{selectedSlot.lot.district || "Chưa có"}</strong></div>
                  <div><span>Mã ô</span><strong>{selectedSlot.slot.code}</strong></div>
                  <div>
                    <span>Trạng thái</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${getStatusTone(selectedSlot.slot.status)}`}>
                        {formatStatusLabel(selectedSlot.slot.status)}
                      </span>
                    </strong>
                  </div>
                  <div>
                    <span>Quyền owner</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${selectedSlot.ownerSlotDetail ? "info" : "muted"}`}>
                        {selectedSlot.ownerSlotDetail ? "Có dữ liệu chi tiết" : "Chỉ xem trạng thái chung"}
                      </span>
                    </strong>
                  </div>
                </div>
              </div>

              <div className="parking-modal-section">
                <h3>Thông tin vị trí</h3>
                {selectedSlot.ownerSlotDetail ? (
                  <div className="parking-detail-list">
                    <div><span>Khu vực</span><strong>{selectedSlot.ownerSlotDetail.zone}</strong></div>
                    <div><span>Tầng</span><strong>{selectedSlot.ownerSlotDetail.level}</strong></div>
                    <div><span>Loại xe</span><strong>{selectedSlot.ownerSlotDetail.type}</strong></div>
                    <div><span>Cập nhật</span><strong>{formatDateTime(selectedSlot.ownerSlotDetail.updatedAt)}</strong></div>
                  </div>
                ) : (
                  <p className="parking-modal-note">
                    Ô này không thuộc bãi do owner hiện tại quản lý, nên chỉ hiển thị trạng thái chung như trang user.
                  </p>
                )}
              </div>
            </div>

            <div className="parking-modal-section">
              <h3>Thông tin xe / booking</h3>
              {selectedSlot.ownerSlotDetail?.booking ? (
                <div className="parking-detail-list">
                  <div><span>Mã booking</span><strong>{selectedSlot.ownerSlotDetail.booking.code}</strong></div>
                  <div>
                    <span>Trạng thái booking</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${getStatusTone(selectedSlot.ownerSlotDetail.booking.status)}`}>
                        {formatStatusLabel(selectedSlot.ownerSlotDetail.booking.status)}
                      </span>
                    </strong>
                  </div>
                  <div><span>Chủ xe</span><strong>{selectedSlot.ownerSlotDetail.booking.user}</strong></div>
                  <div><span>Biển số</span><strong>{selectedSlot.ownerSlotDetail.booking.plate}</strong></div>
                  <div><span>Số điện thoại</span><strong>{selectedSlot.ownerSlotDetail.booking.phone}</strong></div>
                  <div><span>Giờ vào</span><strong>{formatDateTime(selectedSlot.ownerSlotDetail.booking.startTime)}</strong></div>
                  <div><span>Giờ ra</span><strong>{formatDateTime(selectedSlot.ownerSlotDetail.booking.endTime)}</strong></div>
                </div>
              ) : (
                <p className="parking-modal-note">
                  {selectedSlot.slot.status === "available"
                    ? "Ô này đang trống."
                    : "Chưa có dữ liệu booking chi tiết cho ô này."}
                </p>
              )}
            </div>
          </div>
        </div>
      , document.body) : null}
    </section>
  );
}
