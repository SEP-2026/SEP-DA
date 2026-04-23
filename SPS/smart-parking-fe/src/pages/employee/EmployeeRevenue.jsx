import { useEmployeeContext } from "../../employee/useEmployeeContext";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function RevenueBars({ points }) {
  const data = Array.isArray(points) ? points : [];
  const maxValue = Math.max(...data.map((item) => Number(item.amount || 0)), 1);

  if (!data.length) {
    return <p className="employee-note">Chưa có dữ liệu doanh thu để hiển thị.</p>;
  }

  return (
    <div className="employee-revenue-bars">
      {data.map((item) => {
        const percent = (Number(item.amount || 0) / maxValue) * 100;
        return (
          <div key={item.label} className="employee-revenue-col">
            <div className="employee-revenue-track">
              <div className="employee-revenue-fill" style={{ height: `${Math.max(percent, 3)}%` }} />
            </div>
            <span className="employee-revenue-label">{item.label}</span>
            <strong className="employee-revenue-value">{formatMoney(item.amount || 0)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TrafficSummary({ points }) {
  const data = Array.isArray(points) ? points : [];
  const totalIn = data.reduce((sum, item) => sum + Number(item.check_ins || 0), 0);
  const totalOut = data.reduce((sum, item) => sum + Number(item.check_outs || 0), 0);
  const busiest = data.reduce(
    (best, item) => {
      const load = Number(item.check_ins || 0) + Number(item.check_outs || 0);
      if (load > best.load) {
        return { label: item.label, load };
      }
      return best;
    },
    { label: "--", load: -1 },
  );

  return (
    <div className="employee-traffic-summary">
      <div className="employee-traffic-chip">
        <span>Tổng check-in</span>
        <strong>{totalIn}</strong>
      </div>
      <div className="employee-traffic-chip">
        <span>Tổng check-out</span>
        <strong>{totalOut}</strong>
      </div>
      <div className="employee-traffic-chip">
        <span>Giờ cao điểm</span>
        <strong>{busiest.label}</strong>
      </div>
    </div>
  );
}

export default function EmployeeRevenue() {
  const { revenue } = useEmployeeContext();

  return (
    <div className="employee-revenue-layout">
      <section className="employee-grid employee-grid--summary">
        <article className="employee-card employee-card--kpi">
          <h2>Doanh thu hôm nay</h2>
          <p className="employee-stat-value">{formatMoney(revenue?.revenueToday || 0)}</p>
          <p className="employee-note">Cập nhật theo giao dịch đã thanh toán trong ngày.</p>
        </article>
        <article className="employee-card employee-card--kpi">
          <h2>Doanh thu tháng</h2>
          <p className="employee-stat-value">{formatMoney(revenue?.revenueMonth || 0)}</p>
          <p className="employee-note">Tổng doanh thu đã ghi nhận từ ngày đầu tháng.</p>
        </article>
      </section>

      <section className="employee-grid employee-grid--charts">
        <article className="employee-card">
          <div className="employee-card-head">
            <h2>Biểu đồ doanh thu 7 ngày</h2>
            <span className="employee-chip">Đơn vị: VND</span>
          </div>
          <RevenueBars points={revenue?.revenueByDay} />
        </article>

        <article className="employee-card">
          <div className="employee-card-head">
            <h2>Tóm tắt lưu lượng hôm nay</h2>
            <span className="employee-chip">Theo dữ liệu cổng</span>
          </div>
          <TrafficSummary points={revenue?.trafficByHour} />
          <p className="employee-note">
            Tổng vé đã thanh toán: <strong>{Number(revenue?.totalPaidBookings || 0)}</strong>
          </p>
          <p className="employee-note">
            Tỷ lệ lấp đầy hiện tại: <strong>{Number(revenue?.occupancyRatio || 0).toLocaleString("vi-VN")}%</strong>
          </p>
        </article>
      </section>
    </div>
  );
}
