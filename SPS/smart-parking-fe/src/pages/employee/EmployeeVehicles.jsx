import { useEffect, useMemo, useState } from "react";

import EmployeeParkingBoard from "../../employee/EmployeeParkingBoard";
import { getEmployeeVehicles } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";

const STATUS_LABEL = {
  checked_in: "Đang đỗ",
  in_progress: "Đang đỗ",
  booked: "Đã đặt chỗ",
  pending: "Chờ xử lý",
};

export default function EmployeeVehicles() {
  const { slotsOverview, refreshEmployee } = useEmployeeContext();
  const [data, setData] = useState({ vehicles: [], total_count: 0 });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refreshVehicles = async () => {
    const res = await getEmployeeVehicles();
    setData(res);
  };

  useEffect(() => {
    refreshVehicles().catch(() => setData({ vehicles: [], total_count: 0 }));
    const timerId = window.setInterval(() => {
      refreshVehicles().catch(() => null);
      refreshEmployee();
    }, 10000);
    return () => window.clearInterval(timerId);
  }, [refreshEmployee]);

  const latestCheckIn = useMemo(() => {
    const first = data.vehicles?.[0];
    return first?.check_in_time ? new Date(first.check_in_time).toLocaleString("vi-VN") : "--";
  }, [data.vehicles]);

  const filteredVehicles = useMemo(
    () => (data.vehicles || []).filter((vehicle) => {
      const statusOk = statusFilter === "all" ? true : String(vehicle.status || "").toLowerCase() === statusFilter;
      if (!statusOk) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      const haystack = `${vehicle.license_plate || ""} ${vehicle.slot_code || ""} BK-${vehicle.booking_id}`.toLowerCase();
      return haystack.includes(q);
    }),
    [data.vehicles, query, statusFilter],
  );

  return (
    <section className="employee-card employee-section-shell">
      <div className="employee-section-headline">
        <h2>Xe trong bãi</h2>
        <div className="employee-action-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm biển số, slot hoặc mã booking..."
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="checked_in">Đang đỗ</option>
            <option value="in_progress">Đang vận hành</option>
            <option value="booked">Đã đặt chỗ</option>
          </select>
          <span className="employee-chip">Tổng xe hiện tại: {data.total_count}</span>
        </div>
      </div>

      <div className="employee-traffic-summary">
        <div className="employee-traffic-chip">
          <span>Số xe đang đỗ</span>
          <strong>{data.total_count}</strong>
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

      <EmployeeParkingBoard slotsOverview={slotsOverview} title="Sơ đồ bãi đồng bộ với trang user" />

      <div className="employee-list">
        {filteredVehicles.map((vehicle) => (
          <article key={vehicle.booking_id} className="employee-list-item employee-list-item--rich">
            <div>
              <strong>{vehicle.license_plate || "Chưa có biển số"}</strong>
              <p>Booking BK-{vehicle.booking_id}</p>
            </div>
            <div className="employee-vehicle-meta">
              <p>Vào bãi: {vehicle.check_in_time ? new Date(vehicle.check_in_time).toLocaleString("vi-VN") : "--"}</p>
              <p>Vị trí: {vehicle.slot_code || "--"}</p>
              <span className="employee-status-pill">{STATUS_LABEL[vehicle.status] || vehicle.status}</span>
            </div>
          </article>
        ))}
        {filteredVehicles.length === 0 ? <p className="employee-note">Không có xe phù hợp bộ lọc hiện tại.</p> : null}
      </div>
    </section>
  );
}
