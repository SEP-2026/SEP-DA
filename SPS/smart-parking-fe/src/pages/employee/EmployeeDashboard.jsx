import { useMemo } from "react";

import { useEmployeeContext } from "../../employee/useEmployeeContext";

export default function EmployeeDashboard() {
  const { parkingLot, revenue, loading } = useEmployeeContext();

  const cards = useMemo(() => ([
    { label: "Tổng số chỗ", value: parkingLot?.totalSlots || 0 },
    { label: "Đang có xe", value: parkingLot?.occupiedSlots || 0 },
    { label: "Chỗ trống", value: parkingLot?.emptySlots || 0 },
    { label: "Trạng thái bãi", value: parkingLot?.status || "open" },
  ]), [parkingLot]);

  return (
    <>
      <section className="employee-grid">
        {cards.map((card) => (
          <article key={card.label} className="employee-card">
            <p>{card.label}</p>
            <div className="employee-stat-value">{loading ? "..." : card.value}</div>
          </article>
        ))}
      </section>

      <section className="employee-grid">
        <article className="employee-card">
          <h2>Doanh thu hôm nay</h2>
          <p className="employee-stat-value">{Number(revenue?.revenueToday || 0).toLocaleString("vi-VN")}đ</p>
        </article>
        <article className="employee-card">
          <h2>Doanh thu tháng</h2>
          <p className="employee-stat-value">{Number(revenue?.revenueMonth || 0).toLocaleString("vi-VN")}đ</p>
        </article>
        <article className="employee-card">
          <h2>Tên bãi</h2>
          <p>{parkingLot?.parking_name || "--"}</p>
          <p>{parkingLot?.address || "--"}</p>
        </article>
        <article className="employee-card">
          <h2>Luồng vận hành</h2>
          <p>Check-in và check-out dùng chung logic cổng hiện có của owner/admin. Employee chỉ thao tác trên bãi được gán.</p>
        </article>
      </section>
    </>
  );
}
