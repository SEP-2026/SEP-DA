import { useMemo } from "react";

import { useEmployeeContext } from "../../employee/useEmployeeContext";

const STATUS_LABEL = {
  open: "Đang mở",
  closed: "Đang đóng",
  full: "Đã đầy",
  locked: "Đang bị khóa",
};

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function RevenueTrendChart({ points }) {
  const data = Array.isArray(points) && points.length ? points : [];
  const maxValue = Math.max(...data.map((item) => Number(item.amount || 0)), 1);

  if (!data.length) {
    return <p className="employee-note">Chưa có dữ liệu doanh thu 7 ngày gần nhất.</p>;
  }

  const width = 640;
  const height = 220;
  const paddingX = 26;
  const paddingTop = 16;
  const paddingBottom = 44;
  const chartHeight = height - paddingTop - paddingBottom;
  const stepX = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0;

  const chartPoints = data.map((item, index) => {
    const x = paddingX + stepX * index;
    const y = paddingTop + chartHeight - (Number(item.amount || 0) / maxValue) * chartHeight;
    return { ...item, x, y };
  });

  const polyline = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${paddingX},${height - paddingBottom} ${polyline} ${width - paddingX},${height - paddingBottom}`;

  return (
    <svg className="employee-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ doanh thu 7 ngày">
      <defs>
        <linearGradient id="employeeRevenueArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(44, 126, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(44, 126, 255, 0.02)" />
        </linearGradient>
      </defs>

      <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} className="employee-chart-axis" />

      <polygon points={area} fill="url(#employeeRevenueArea)" />
      <polyline points={polyline} className="employee-chart-line" />

      {chartPoints.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="4.5" className="employee-chart-dot" />
          <text x={point.x} y={height - 16} textAnchor="middle" className="employee-chart-label">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}

function TrafficBarsChart({ points }) {
  const data = Array.isArray(points) ? points : [];
  const maxValue = Math.max(
    ...data.map((item) => Math.max(Number(item.check_ins || 0), Number(item.check_outs || 0))),
    1,
  );

  return (
    <div className="employee-traffic-grid">
      {data.map((item) => {
        const inHeight = `${(Number(item.check_ins || 0) / maxValue) * 100}%`;
        const outHeight = `${(Number(item.check_outs || 0) / maxValue) * 100}%`;
        return (
          <div key={item.label} className="employee-traffic-col">
            <div className="employee-traffic-bars">
              <div className="employee-traffic-bar employee-traffic-bar--in" style={{ height: inHeight }} title={`Check-in: ${item.check_ins}`} />
              <div className="employee-traffic-bar employee-traffic-bar--out" style={{ height: outHeight }} title={`Check-out: ${item.check_outs}`} />
            </div>
            <span className="employee-traffic-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function OccupancyDonut({ occupied, total }) {
  const safeTotal = Math.max(Number(total || 0), 1);
  const ratio = Math.min(Math.max(Number(occupied || 0) / safeTotal, 0), 1);
  const percent = Math.round(ratio * 100);

  return (
    <div className="employee-donut-wrap">
      <div
        className="employee-donut"
        style={{ background: `conic-gradient(#2c7eff 0 ${percent}%, rgba(44, 126, 255, 0.16) ${percent}% 100%)` }}
      >
        <div className="employee-donut-inner">
          <strong>{percent}%</strong>
          <span>Lấp đầy</span>
        </div>
      </div>
      <p className="employee-note">{occupied}/{total} chỗ đang có xe</p>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { parkingLot, revenue, slotsOverview, loading } = useEmployeeContext();

  const cards = useMemo(
    () => [
      { label: "Tổng số chỗ", value: parkingLot?.totalSlots || 0 },
      { label: "Đang có xe", value: (slotsOverview?.in_use_slots || 0) + (slotsOverview?.reserved_slots || 0) },
      { label: "Chỗ trống", value: slotsOverview?.available_slots || 0 },
      { label: "Trạng thái bãi", value: STATUS_LABEL[parkingLot?.status] || parkingLot?.status || "Đang mở" },
    ],
    [parkingLot, slotsOverview],
  );

  return (
    <>
      <section className="employee-grid">
        {cards.map((card) => (
          <article key={card.label} className="employee-card employee-card--kpi">
            <p>{card.label}</p>
            <div className="employee-stat-value">{loading ? "..." : card.value}</div>
          </article>
        ))}
      </section>

      <section className="employee-grid employee-grid--charts">
        <article className="employee-card">
          <div className="employee-card-head">
            <h2>Doanh thu 7 ngày gần nhất</h2>
            <span className="employee-chip">Đã thu: {formatMoney(revenue?.revenueMonth || 0)}</span>
          </div>
          <RevenueTrendChart points={revenue?.revenueByDay} />
        </article>

        <article className="employee-card">
          <div className="employee-card-head">
            <h2>Lưu lượng check-in/check-out hôm nay</h2>
            <span className="employee-chip">Vé đã thanh toán: {Number(revenue?.totalPaidBookings || 0)}</span>
          </div>
          <TrafficBarsChart points={revenue?.trafficByHour} />
        </article>
      </section>

      <section className="employee-grid employee-grid--detail">
        <article className="employee-card">
          <h2>Doanh thu hôm nay</h2>
          <p className="employee-stat-value">{formatMoney(revenue?.revenueToday || 0)}</p>
        </article>

        <article className="employee-card">
          <h2>Doanh thu tháng</h2>
          <p className="employee-stat-value">{formatMoney(revenue?.revenueMonth || 0)}</p>
        </article>

        <article className="employee-card">
          <h2>Tỷ lệ lấp đầy bãi</h2>
          <OccupancyDonut occupied={parkingLot?.occupiedSlots || 0} total={parkingLot?.totalSlots || 0} />
        </article>

        <article className="employee-card">
          <h2>Thông tin bãi</h2>
          <p><strong>{parkingLot?.parking_name || "--"}</strong></p>
          <p>{parkingLot?.address || "--"}</p>
          <p className="employee-note">Dữ liệu hiển thị lấy trực tiếp từ cơ sở dữ liệu theo bãi được phân công cho nhân viên.</p>
        </article>
      </section>
    </>
  );
}

