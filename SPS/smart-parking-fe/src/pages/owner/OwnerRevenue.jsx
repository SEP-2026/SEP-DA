import { useMemo, useState } from "react";
import { buildRevenueSeries, filterTransactionsByDate, getRangeSummaryLabel } from "../../owner/ownerAnalytics";
import { formatCurrency, formatDateTime, LineChart, SectionCard, StatCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

const CHART_RANGE_OPTIONS = [
  { value: "day", label: "Theo ngày" },
  { value: "week", label: "Theo tuần" },
  { value: "month", label: "Theo tháng" },
  { value: "quarter", label: "3 tháng gần nhất" },
  { value: "custom", label: "Khác" },
];

export default function OwnerRevenue() {
  const { ownerData } = useOwnerContext();
  const [range, setRange] = useState("day");
  const [dateFrom, setDateFrom] = useState("2026-04-09");
  const [dateTo, setDateTo] = useState("2026-04-15");
  const activeRange = range === "custom" ? "day" : range;

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(ownerData.transactions, dateFrom, dateTo),
    [ownerData.transactions, dateFrom, dateTo],
  );
  const paidTransactions = filteredTransactions.filter((item) => item.status === "paid");
  const totalPaid = paidTransactions.reduce((sum, item) => sum + item.amount, 0);
  const currentSeries = useMemo(
    () => buildRevenueSeries(ownerData.transactions, dateFrom, dateTo, activeRange),
    [ownerData.transactions, dateFrom, dateTo, activeRange],
  );
  const currentRevenue = currentSeries[currentSeries.length - 1]?.amount || 0;
  const pendingAmount = filteredTransactions
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid">
        <StatCard title={activeRange === "day" ? "Doanh thu hôm nay" : activeRange === "week" ? "Doanh thu tuần này" : "Doanh thu kỳ chọn"} value={formatCurrency(currentRevenue)} note="Doanh thu kỳ đang xem" trend={CHART_RANGE_OPTIONS.find((item) => item.value === range)?.label || "Theo ngày"} icon="revenue" />
        <StatCard title="Đã thu" value={formatCurrency(totalPaid)} note="Giao dịch hoàn tất" trend={`${paidTransactions.length} giao dịch`} icon="dashboard" />
        <StatCard title="Chờ thanh toán" value={formatCurrency(pendingAmount)} note="Cần kiểm tra thêm" trend={`${filteredTransactions.filter((item) => item.status === "pending").length} giao dịch`} icon="booking" />
      </div>

      <div className="owner-page-grid">
        <SectionCard
          title="Biểu đồ doanh thu"
          subtitle={`Chọn kỳ xem và khoảng thời gian cần theo dõi: ${getRangeSummaryLabel(activeRange, dateFrom, dateTo)}.`}
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
          <LineChart data={currentSeries.length > 0 ? currentSeries : [{ label: "Không có dữ liệu", amount: 0 }]} />
        </SectionCard>
      </div>

      <SectionCard title="Giao dịch gần đây" subtitle="Các giao dịch cần theo dõi tại bãi đỗ này.">
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Mã giao dịch</th>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Thời gian</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.id}</td>
                  <td>{transaction.bookingCode}</td>
                  <td>{transaction.payer}</td>
                  <td>{formatDateTime(transaction.time)}</td>
                  <td>{transaction.method}</td>
                  <td>{formatCurrency(transaction.amount)}</td>
                  <td><StatusBadge status={transaction.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
