import { useEffect, useState } from "react";

import { getEmployeeVehicles } from "../../employee/employeeService";

export default function EmployeeVehicles() {
  const [data, setData] = useState({ vehicles: [], total_count: 0 });

  useEffect(() => {
    getEmployeeVehicles().then(setData).catch(() => setData({ vehicles: [], total_count: 0 }));
  }, []);

  return (
    <section className="employee-card">
      <h2>Xe trong bãi</h2>
      <p>Tổng số xe hiện tại: {data.total_count}</p>
      <div className="employee-list">
        {data.vehicles.map((vehicle) => (
          <article key={vehicle.booking_id} className="employee-list-item">
            <div>
              <strong>{vehicle.license_plate || "Chưa có biển số"}</strong>
              <p>Booking BK-{vehicle.booking_id}</p>
            </div>
            <div>
              <p>Vào bãi: {vehicle.check_in_time ? new Date(vehicle.check_in_time).toLocaleString("vi-VN") : "--"}</p>
              <p>Vị trí: {vehicle.slot_code || "--"}</p>
              <p>Trạng thái: {vehicle.status}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
