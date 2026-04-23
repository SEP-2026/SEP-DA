import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import { formatDateTimeVN } from "../utils/dateTime";
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
  return formatDateTimeVN(value, "Chưa có");
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
    return { top: 0, left: 0, placement: "right", arrowOffset: 48, maxHeight: null, width: compact ? 420 : 520, overflowBelow: 0 };
  }

  if (window.innerWidth <= 640) {
    return { top: 0, left: 0, placement: "sheet", arrowOffset: 0, maxHeight: Math.round(window.innerHeight * 0.62), width: 0, overflowBelow: 0 };
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
  const popoverHeight = compact ? 320 : 560;
  const viewportBottom = scrollY + window.innerHeight;
  const overflowBelow = Math.max(0, top + popoverHeight + margin - viewportBottom);
  const arrowOffset = placement === "bottom"
    ? Math.max(30, Math.min(width - 30, scrollX + anchorCenterX - left))
    : Math.max(26, Math.min(popoverHeight - 26, anchorCenterY - anchorTop + 6));

  return { top, left, placement, arrowOffset, maxHeight: null, width, overflowBelow };
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

export default function Home({ role = "" }) {
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [expandedLots, setExpandedLots] = useState({});
  const popoverRef = useRef(null);

  const isOwner = role === "owner";

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const overviewRes = await API.get(isOwner ? "/owner/parking-lots/slots-overview" : "/parking-lots/slots-overview");
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
        setExpandedLots((prev) => {
          const next = {};
          for (const lot of normalizedLots) {
            next[lot.parking_id] = prev[lot.parking_id] ?? false;
          }
          return next;
        });
      } catch {
        if (!active) {
          return;
        }
        setParkingLots([]);
        setExpandedLots({});
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

  useEffect(() => {
    if (!selectedSlot?.slot?.id || !isOwner) {
      return undefined;
    }

    let active = true;

    const loadSlotDetail = async () => {
      try {
        const response = await API.get(`/owner/slots/${selectedSlot.slot.id}/detail`);
        if (!active) {
          return;
        }
        setSelectedSlot((prev) => {
          if (!prev || prev.slot.id !== selectedSlot.slot.id) {
            return prev;
          }
          return {
            ...prev,
            detail: response.data,
            detailLoading: false,
            detailError: "",
          };
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setSelectedSlot((prev) => {
          if (!prev || prev.slot.id !== selectedSlot.slot.id) {
            return prev;
          }
          return {
            ...prev,
            detail: null,
            detailLoading: false,
            detailError: error?.response?.data?.detail || "Không tải được chi tiết chỗ đỗ.",
          };
        });
      }
    };

    loadSlotDetail();

    return () => {
      active = false;
    };
  }, [selectedSlot?.slot?.id, isOwner]);

  const handleSlotClick = (lot, slot, slotIndex, event) => {
    if (!isOwner) {
      return;
    }

    const anchorRect = event.currentTarget.getBoundingClientRect();

    setSelectedSlot({
      lot,
      slot,
      slotIndex,
      anchorRect,
      anchorCenterX: anchorRect.left + anchorRect.width / 2,
      anchorCenterY: anchorRect.top + anchorRect.height / 2,
      detail: null,
      detailLoading: true,
      detailError: "",
    });
  };

  const slotDetail = selectedSlot?.detail || null;
  const detailedSlot = slotDetail?.slot || null;
  const detailParking = slotDetail?.parking || null;
  const detailBooking = slotDetail?.booking || null;
  const hasOwnerDetail = Boolean(slotDetail?.access?.has_owner_detail);
  const isCompactPopover = Boolean(selectedSlot) && !selectedSlot?.detailLoading && !hasOwnerDetail && !detailBooking;
  const popoverPosition = useMemo(
    () => getPopoverPosition(selectedSlot?.anchorRect, isCompactPopover, selectedSlot?.slotIndex || 0),
    [selectedSlot?.anchorRect, isCompactPopover, selectedSlot?.slotIndex],
  );
  const pageSpacerHeight = selectedSlot ? Math.max(0, (popoverPosition.overflowBelow || 0) + 24) : 0;

  const toggleLot = (parkingId) => {
    setExpandedLots((prev) => ({
      ...prev,
      [parkingId]: !prev[parkingId],
    }));
  };

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
        </div>

        {loading ? (
          <div className="parking-empty">Đang tải dữ liệu bãi xe...</div>
        ) : null}

        {!loading && parkingLots.length === 0 ? (
          <div className="parking-empty">Chưa có dữ liệu bãi xe để hiển thị.</div>
        ) : null}

        <div className="parking-lot-list">
          {parkingLots.map((lot) => (
            <section key={lot.parking_id} className={`parking-lot-card${expandedLots[lot.parking_id] ? " is-expanded" : ""}`}>
              <button
                type="button"
                className="parking-lot-head"
                onClick={() => toggleLot(lot.parking_id)}
                aria-expanded={Boolean(expandedLots[lot.parking_id])}
              >
                <div>
                  <h2 className="parking-lot-name">{lot.parking_name}</h2>
                  <p className="parking-lot-rating">⭐ {Number(lot.avg_rating || 0).toFixed(1)} ({lot.review_count || 0} đánh giá)</p>
                  <p className="parking-lot-address">{lot.parking_address}</p>
                  {lot.district && <p className="parking-lot-district">{lot.district}</p>}
                </div>
                <div className="parking-lot-stats">
                  <span className="stat-chip stat-available">Trống: {lot.available_slots}</span>
                  <span className="stat-chip stat-occupied">Giữ/Đã có xe: {lot.occupied_or_reserved_slots}</span>
                  <span className="stat-chip stat-total">Tổng: {lot.total_slots}</span>
                  <span className="parking-lot-toggle" aria-hidden="true">
                    {expandedLots[lot.parking_id] ? "−" : "+"}
                  </span>
                </div>
              </button>

              <div className={`parking-lot-body${expandedLots[lot.parking_id] ? " is-open" : ""}`}>
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
                  <div><span>Bãi xe</span><strong>{detailParking?.name || selectedSlot.lot.parking_name}</strong></div>
                  <div><span>Địa chỉ</span><strong>{detailParking?.address || selectedSlot.lot.parking_address}</strong></div>
                  <div><span>Quận</span><strong>{detailParking?.district || selectedSlot.lot.district || "Chưa có"}</strong></div>
                  <div><span>Mã ô</span><strong>{detailedSlot?.code || selectedSlot.slot.code}</strong></div>
                  <div>
                    <span>Trạng thái</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${getStatusTone(detailedSlot?.status || selectedSlot.slot.status)}`}>
                        {formatStatusLabel(detailedSlot?.status || selectedSlot.slot.status)}
                      </span>
                    </strong>
                  </div>
                  <div>
                    <span>Quyền owner</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${hasOwnerDetail ? "info" : "muted"}`}>
                        {selectedSlot.detailLoading ? "Đang tải..." : hasOwnerDetail ? "Có dữ liệu chi tiết" : "Chỉ xem trạng thái chung"}
                      </span>
                    </strong>
                  </div>
                </div>
              </div>

              <div className="parking-modal-section">
                <h3>Thông tin vị trí</h3>
                {selectedSlot.detailLoading ? (
                  <p className="parking-modal-note">Đang tải dữ liệu chi tiết từ hệ thống...</p>
                ) : selectedSlot.detailError ? (
                  <p className="parking-modal-note">{selectedSlot.detailError}</p>
                ) : hasOwnerDetail && detailedSlot ? (
                  <div className="parking-detail-list">
                    <div><span>Khu vực</span><strong>{detailedSlot.zone}</strong></div>
                    <div><span>Tầng</span><strong>{detailedSlot.level}</strong></div>
                    <div><span>Loại xe</span><strong>{detailedSlot.type}</strong></div>
                    <div><span>Cập nhật</span><strong>{formatDateTime(detailedSlot.updatedAt)}</strong></div>
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
              {selectedSlot.detailLoading ? (
                <p className="parking-modal-note">Đang tải booking hiện tại của ô này...</p>
              ) : detailBooking ? (
                <div className="parking-detail-list">
                  <div><span>Mã booking</span><strong>{detailBooking.code}</strong></div>
                  <div>
                    <span>Trạng thái booking</span>
                    <strong>
                      <span className={`parking-status-pill parking-status-pill--${getStatusTone(detailBooking.status)}`}>
                        {formatStatusLabel(detailBooking.status)}
                      </span>
                    </strong>
                  </div>
                  <div><span>Chủ xe</span><strong>{detailBooking.user}</strong></div>
                  <div><span>Biển số</span><strong>{detailBooking.plate}</strong></div>
                  <div><span>Số điện thoại</span><strong>{detailBooking.phone}</strong></div>
                  <div><span>Giờ vào</span><strong>{formatDateTime(detailBooking.startTime)}</strong></div>
                  <div><span>Giờ ra</span><strong>{formatDateTime(detailBooking.endTime)}</strong></div>
                </div>
              ) : (
                <p className="parking-modal-note">
                  {(detailedSlot?.status || selectedSlot.slot.status) === "available"
                    ? "Ô này đang trống."
                    : "Chưa có dữ liệu booking chi tiết cho ô này."}
                </p>
              )}
            </div>
          </div>
        </div>
      , document.body) : null}
      {pageSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: `${pageSpacerHeight}px` }} /> : null}
    </section>
  );
}
