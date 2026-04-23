import { useEmployeeContext } from "../../employee/useEmployeeContext";

export default function EmployeeRevenue() {
  const { revenue } = useEmployeeContext();

  return (
    <section className="employee-grid employee-grid--summary">
      <article className="employee-card">
        <h2>Doanh thu ngày</h2>
        <p className="employee-stat-value">{Number(revenue?.revenueToday || 0).toLocaleString("vi-VN")}đ</p>
      </article>
      <article className="employee-card">
        <h2>Doanh thu tháng</h2>
        <p className="employee-stat-value">{Number(revenue?.revenueMonth || 0).toLocaleString("vi-VN")}đ</p>
      </article>
    </section>
  );
}
