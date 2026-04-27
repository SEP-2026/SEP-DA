import { useCallback, useEffect, useMemo, useState } from "react";

import EmployeeParkingBoard from "../../employee/EmployeeParkingBoard";
import { employeeCheckOut, getEmployeeVehicles } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "parked", label: "Đang đỗ" },
  { value: "available", label: "Trống" },
];

const PARKED_SLOT_STATUSES = ["occupied", "in_use", "reserved"];
const AVAILABLE_SLOT_STATUSES = ["available", "maintenance"];

function createVehicleSearchText(vehicle) {
  return `${vehicle.license_plate || ""} ${vehicle.slot_code || ""} BK-${vehicle.booking_id}`.toLowerCase();
}

function resolveBookingIdFromSlot(slot) {
  if (slot?.booking_id) return Number(slot.booking_id);
  const bookingCode = String(slot?.booking_code || "");
  const match = bookingCode.match(/BK-(\d+)/i);
  return match ? Number(match[1]) : null;
}

export default function EmployeeVehicles() {
  const { slotsOverview, refreshEmployee } = useEmployeeContext();
  const [data, setData] = useState({ vehicles: [], total_count: 0 });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const occupiedOrReserved = (slotsOverview?.in_use_slots || 0) + (slotsOverview?.reserved_slots || 0);

  const refreshVehicles = useCallback(async () => {
    const res = await getEmployeeVehicles();
    setData(res);
  }, []);

  useEffect(() => {
    let mounted = true;

    refreshVehicles().catch(() => {
      if (mounted) {
        setData({ vehicles: [], total_count: 0 });
      }
    });

    const timerId = window.setInterval(() => {
      refreshVehicles().catch(() => null);
    }, 20000);

    return () => {
      mounted = false;
      window.clearInterval(timerId);
    };
  }, [refreshVehicles]);

  const handleManualCheckout = useCallback(
    async (slot, paymentMethod = "cash") => {
      const bookingId = resolveBookingIdFromSlot(slot);
      if (!bookingId) {
        throw new Error("Không xác định được mã booking của ô này.");
      }

      const res = await employeeCheckOut({
        qr_data: String(bookingId),
        payment_method: paymentMethod,
      });

      await Promise.all([refreshVehicles(), refreshEmployee()]);

      return res;
    },
    [refreshEmployee, refreshVehicles],
  );

  const latestCheckIn = useMemo(() => {
    const first = data.vehicles?.[0];
    return first?.check_in_time ? new Date(first.check_in_time).toLocaleString("vi-VN") : "--";
  }, [data.vehicles]);

  const normalizedQuery = query.trim().toLowerCase();

  const boardSlotsOverview = useMemo(() => {
    const slots = Array.isArray(slotsOverview?.slots) ? slotsOverview.slots : [];
    if (!slots.length) return slotsOverview;

    const vehiclesBySlot = new Map();
    (data.vehicles || []).forEach((vehicle) => {
      const slotCode = String(vehicle.slot_code || "").toLowerCase();
      if (!slotCode) return;
      const list = vehiclesBySlot.get(slotCode) || [];
      list.push(vehicle);
      vehiclesBySlot.set(slotCode, list);
    });

    const getStatusOk = (slot) => {
      if (statusFilter === "parked") return PARKED_SLOT_STATUSES.includes(slot.status);
      if (statusFilter === "available") return AVAILABLE_SLOT_STATUSES.includes(slot.status);
      return true;
    };

    const getQueryOk = (slot) => {
      if (!normalizedQuery) return true;
      const code = String(slot.code || "").toLowerCase();
      if (code.includes(normalizedQuery)) return true;
      const relatedVehicles = vehiclesBySlot.get(code) || [];
      return relatedVehicles.some((vehicle) => createVehicleSearchText(vehicle).includes(normalizedQuery));
    };

    const filteredSlots = slots.filter((slot) => getStatusOk(slot) && getQueryOk(slot));

    const availableCount = filteredSlots.filter((slot) => slot.status === "available" || slot.status === "maintenance").length;
    const reservedCount = filteredSlots.filter((slot) => slot.status === "reserved").length;
    const inUseCount = filteredSlots.filter((slot) => slot.status === "in_use" || slot.status === "occupied").length;

    return {
      ...slotsOverview,
      slots: filteredSlots,
      total_slots: filteredSlots.length,
      available_slots: availableCount,
      reserved_slots: reservedCount,
      in_use_slots: inUseCount,
      maintenance_slots: filteredSlots.filter((slot) => slot.status === "maintenance").length,
    };
  }, [data.vehicles, normalizedQuery, slotsOverview, statusFilter]);

  return (
    <section className="employee-card employee-section-shell employee-vehicles-page">
      <div className="employee-section-headline">
        <h2>Xe trong bãi</h2>
      </div>

      <div className="employee-vehicles-toolbar">
        <div className="employee-search-wrap">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm biển số, vị trí đỗ hoặc mã booking..."
          />
        </div>
        <div className="employee-filter-wrap">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_FILTER_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        <span className="employee-chip">Tổng xe hiện tại: {occupiedOrReserved}</span>
      </div>

      <div className="employee-traffic-summary">
        <div className="employee-traffic-chip">
          <span>Số xe giữ/đang đỗ</span>
          <strong>{occupiedOrReserved}</strong>
        </div>
        <div className="employee-traffic-chip">
          <span>Vị trí trống</span>
          <strong>{slotsOverview?.available_slots || 0}</strong>
        </div>
        <div className="employee-traffic-chip">
          <span>Vị trí đã dùng/giữ</span>
          <strong>{(slotsOverview?.in_use_slots || 0) + (slotsOverview?.reserved_slots || 0)}</strong>
        </div>
        <div className="employee-traffic-chip">
          <span>Check-in gần nhất</span>
          <strong className="employee-inline-small">{latestCheckIn}</strong>
        </div>
      </div>

      {boardSlotsOverview?.slots?.length ? (
        <EmployeeParkingBoard
          slotsOverview={boardSlotsOverview}
          title="Sơ đồ bãi đồng bộ với trang user"
          onManualCheckout={handleManualCheckout}
        />
      ) : (
        <div className="employee-empty-state">
          <h3>Không có ô phù hợp bộ lọc</h3>
          <p>Hãy thử đổi trạng thái lọc hoặc từ khóa tìm kiếm để xem dữ liệu.</p>
        </div>
      )}
    </section>
  );
}
