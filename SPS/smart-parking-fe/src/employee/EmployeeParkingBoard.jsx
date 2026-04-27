import { useEffect, useMemo, useState } from "react";
import "../pages/Home.css";

function formatStatusLabel(status) {
  const mapping = {
    available: "Trống",
    reserved: "Đang đỗ",
    in_use: "Đang đỗ",
    occupied: "Đang đỗ",
    maintenance: "Trống",
  };
  return mapping[status] || "Trống";
}

function formatServiceLabel(mode) {
  const mapping = {
    hourly: "Theo giờ",
    daily: "Theo ngày",
    monthly: "Theo tháng",
  };
  return mapping[String(mode || "").toLowerCase()] || "Không rõ";
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

export default function EmployeeParkingBoard({ slotsOverview, title = "Sơ đồ bãi xe" }) {
  const [selectedVehicleSlot, setSelectedVehicleSlot] = useState(null);
  const slots = Array.isArray(slotsOverview?.slots) ? slotsOverview.slots : [];
  const total = Number(slotsOverview?.total_slots || 0);
  const available = Number(slotsOverview?.available_slots || 0);
  const occupied = Number(slotsOverview?.in_use_slots || 0) + Number(slotsOverview?.reserved_slots || 0);

  const normalizedSlots = useMemo(
    () =>
      slots.map((slot) => ({
        ...slot,
        clickable: slot.status === "occupied" || slot.status === "in_use" || slot.status === "reserved",
      })),
    [slots],
  );

  useEffect(() => {
    if (!selectedVehicleSlot) return;
    const stillVisible = normalizedSlots.some((slot) => slot.id === selectedVehicleSlot.id);
    if (!stillVisible) {
      setSelectedVehicleSlot(null);
    }
  }, [normalizedSlots, selectedVehicleSlot]);

  return (
    <section className="parking-lot-card employee-parking-board">
      <div className="parking-lot-head employee-parking-board-head">
        <div>
          <h2 className="parking-lot-name">{slotsOverview?.parking_name || title}</h2>
          <p className="parking-lot-address">{title}</p>
        </div>
        <div className="parking-lot-stats">
          <span className="stat-chip stat-available">Trống: {available}</span>
          <span className="stat-chip stat-occupied">Đang đỗ: {occupied}</span>
          <span className="stat-chip stat-total">Tổng: {total}</span>
        </div>
      </div>

      <div className="parking-grid">
        {normalizedSlots.map((slot) => {
          const isAvailable = slot.status === "available" || slot.status === "maintenance";
          const cardClass = `slot-card${slot.clickable ? " employee-slot-card--interactive" : " employee-slot-card--static"}`;
          return (
            <article
              key={slot.id}
              className={cardClass}
              role={slot.clickable ? "button" : undefined}
              tabIndex={slot.clickable ? 0 : undefined}
              onClick={() => {
                if (!slot.clickable) return;
                setSelectedVehicleSlot(slot);
              }}
              onKeyDown={(event) => {
                if (!slot.clickable) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedVehicleSlot(slot);
                }
              }}
            >
              <div className="slot-lane" />
              <div className={`slot-car ${isAvailable ? "slot-available" : "slot-occupied"}`}>
                <img
                  src={isAvailable ? "/car-top-view2.png" : "/car-top-view.png"}
                  alt={isAvailable ? "Vị trí trống" : "Vị trí đã có xe"}
                  className="car-image"
                />
              </div>
              <div className="slot-badge">
                {slot.code} - {formatStatusLabel(slot.status)}
              </div>
            </article>
          );
        })}
      </div>

      {selectedVehicleSlot ? (
        <div className="employee-vehicle-modal-backdrop" onClick={() => setSelectedVehicleSlot(null)}>
          <div className="employee-vehicle-modal" onClick={(event) => event.stopPropagation()}>
            <div className="employee-vehicle-modal-head">
              <h3>Thông tin xe tại ô {selectedVehicleSlot.code}</h3>
              <button type="button" className="employee-vehicle-modal-close" onClick={() => setSelectedVehicleSlot(null)}>
                ×
              </button>
            </div>
            <div className="employee-vehicle-modal-body">
              <p>
                <strong>Tên chủ xe:</strong> {selectedVehicleSlot.owner_name || "--"}
              </p>
              <p>
                <strong>Biển số xe:</strong> {selectedVehicleSlot.vehicle_plate || "--"}
              </p>
              <p>
                <strong>Số điện thoại:</strong> {selectedVehicleSlot.owner_phone || "--"}
              </p>
              <p>
                <strong>Dịch vụ khách chọn:</strong> {formatServiceLabel(selectedVehicleSlot.booking_mode)}
              </p>
              <p>
                <strong>Giờ vào:</strong> {formatDateTime(selectedVehicleSlot.check_in_time)}
              </p>
              <p>
                <strong>Giờ ra dự kiến:</strong> {formatDateTime(selectedVehicleSlot.check_out_time)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
