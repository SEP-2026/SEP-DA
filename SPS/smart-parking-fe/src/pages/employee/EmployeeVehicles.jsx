import { useEffect, useMemo, useState } from "react";

import EmployeeParkingBoard from "../../employee/EmployeeParkingBoard";
import { getEmployeeVehicles } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";

const STATUS_LABEL = {
  checked_in: "Đang đỗ",
  booked: "Đã đặt chỗ",
  pending: "Chờ xử lý",
};

export default function EmployeeVehicles() {
  const { slotsOverview } = useEmployeeContext();
  const [data, setData] = useState({ vehicles: [], total_count: 0 });

  useEffect(() => {
    getEmployeeVehicles().then(setData).catch(() => setData({ vehicles: [], total_count: 0 }));
  }, []);

  const latestCheckIn = useMemo(() => {
    const first = data.vehicles?.[0];
    return first?.check_in_time ? new Date(first.check_in_time).toLocaleString("vi-VN") : "--";
  }, [data.vehicles]);

  return (
    <section className="employee-card employee-section-shell">
      <div className="employee-section-headline">
        <h2>Xe trong bãi</h2>
        <span className="employee-chip">Tổng xe hiện tại: {data.total_count}</span>
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
        {data.vehicles.map((vehicle) => (
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
      </div>
    </section>
  );
}
