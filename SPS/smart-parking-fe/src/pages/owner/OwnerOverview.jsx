import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildRevenueSeries, getRangeSummaryLabel } from "../../owner/ownerAnalytics";
import { formatCurrency, formatDateTime, LineChart, SectionCard, StatCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

const CHART_RANGE_OPTIONS = [
  { value: "day", label: "Theo ngày" },
  { value: "week", label: "Theo tuần" },
  { value: "month", label: "Theo tháng" },
  { value: "quarter", label: "3 tháng gần nhất" },
  { value: "custom", label: "Khác" },
];

export default function OwnerOverview() {
  const { ownerData, stats } = useOwnerContext();
  const [range, setRange] = useState("day");
  const [dateFrom, setDateFrom] = useState("2026-04-09");
  const [dateTo, setDateTo] = useState("2026-04-15");
  const activeRange = range === "custom" ? "day" : range;
  const vehiclesInLot = useMemo(
    () => ownerData.bookings.filter((booking) => booking.status === "in_progress" || booking.status === "confirmed"),
    [ownerData.bookings],
  );
  const todayBookings = useMemo(
    () => ownerData.bookings.filter((booking) => booking.startTime.startsWith("2026-04-15")),
    [ownerData.bookings],
  );
  const chartData = useMemo(() => {
    const series = buildRevenueSeries(ownerData.transactions, dateFrom, dateTo, activeRange);
    return series.length > 0 ? series : [{ label: "Không có dữ liệu", amount: 0 }];
  }, [ownerData.transactions, dateFrom, dateTo, activeRange]);

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid owner-stats-grid--wide">
        <StatCard title="Tổng số chỗ đỗ" value={stats.totalSlots} note="Sức chứa bãi hiện tại" trend="Bãi đang mở" icon="parking" />
        <StatCard title="Đang sử dụng" value={stats.usedSlots} note="Xe trong bãi" trend="+8%" icon="booking" />
        <StatCard title="Chỗ còn trống" value={stats.availableSlots} note="Sẵn sàng nhận xe" trend={`${Math.round((stats.availableSlots / Math.max(stats.totalSlots, 1)) * 100)}% trống`} icon="dashboard" />
        <StatCard title="Doanh thu hôm nay" value={formatCurrency(stats.todayRevenue)} note="Đã thanh toán" trend="+12.4%" icon="revenue" />
        <StatCard title="Lượt xe hôm nay" value={stats.todayBookings} note="Xe vào bãi trong ngày" trend={`${todayBookings.length} booking`} icon="booking" />
      </div>

      <div className="owner-two-col">
        <SectionCard
          title="Doanh thu bãi đỗ"
          subtitle={`Theo dõi nhanh doanh thu theo kỳ và khoảng thời gian: ${getRangeSummaryLabel(activeRange, dateFrom, dateTo)}.`}
          actions={
            <div className="owner-range-controls">
              <select className="owner-input owner-select owner-control" value={range} onChange={(event) => setRange(event.target.value)}>
                {CHART_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {range === "custom" ? (
                <div className="owner-date-range">
                  <label className="owner-date-field">
                    <span>Từ</span>
                    <input className="owner-input owner-control owner-control--date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  </label>
                  <label className="owner-date-field">
                    <span>Đến</span>
                    <input className="owner-input owner-control owner-control--date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                  </label>
                </div>
              ) : null}
            </div>
          }
        >
          <LineChart data={chartData} />
        </SectionCard>

        <SectionCard title="Quản lý nhanh" subtitle="Các thao tác owner dùng thường xuyên trong ngày.">
          <div className="owner-quick-actions">
            <Link to="/owner/parking" className="owner-quick-action">
              <strong>Quản lý chỗ đỗ</strong>
              <span>Thêm hoặc sửa vị trí đỗ xe.</span>
            </Link>
            <Link to="/owner/bookings" className="owner-quick-action">
              <strong>Xem booking</strong>
              <span>Kiểm tra booking hôm nay.</span>
            </Link>
            <Link to="/scan" className="owner-quick-action">
              <strong>Quét QR</strong>
              <span>Hỗ trợ xe vào hoặc ra bãi.</span>
            </Link>
          </div>
        </SectionCard>
      </div>

      <div className="owner-two-col owner-two-col--secondary">
        <SectionCard title="Xe đang trong bãi" subtitle="Danh sách xe cần theo dõi thời điểm hiện tại.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Biển số</th>
                  <th>Khách hàng</th>
                  <th>Chỗ đỗ</th>
                  <th>Giờ vào</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesInLot.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.plate}</td>
                    <td>
                      <strong>{booking.user}</strong>
                      <span>{booking.code}</span>
                    </td>
                    <td>{booking.slotCode}</td>
                    <td>{formatDateTime(booking.startTime)}</td>
                    <td><StatusBadge status={booking.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Booking hôm nay" subtitle="Các booking phát sinh trong ngày tại bãi này.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Biển số</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {todayBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.code}</td>
                    <td>{booking.plate}</td>
                    <td>{formatDateTime(booking.startTime)}</td>
                    <td>{formatDateTime(booking.endTime)}</td>
                    <td><StatusBadge status={booking.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
