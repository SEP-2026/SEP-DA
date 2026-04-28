import { useMemo, useState } from "react";
import { BarChart, LineChart, SectionCard, StatCard, StatusBadge, formatCurrency, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function RevenuePage() {
  const { adminData, stats } = useAdminContext();
  const [series, setSeries] = useState("revenue");
  const [period, setPeriod] = useState("day");
  const [query, setQuery] = useState("");

  const lineSeriesMap = useMemo(
    () => ({
      day: {
        revenue: adminData.systemRevenue.revenue,
        commission: adminData.systemRevenue.commission,
        bookings: adminData.systemRevenue.bookings,
      },
      month: {
        revenue: adminData.systemRevenue.revenueMonthly || [],
        commission: adminData.systemRevenue.commissionMonthly || [],
        bookings: adminData.systemRevenue.bookingsMonthly || [],
      },
    }),
    [adminData.systemRevenue],
  );

  const filteredTransactions = useMemo(
    () => adminData.transactions.filter((tx) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      const haystack = `${tx.id} ${tx.bookingId} ${tx.parkingLot} ${tx.user}`.toLowerCase();
      return haystack.includes(q);
    }),
    [adminData.transactions, query],
  );

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid">
        <StatCard title="Doanh thu hệ thống" value={formatCurrency(stats.totalRevenue)} note="Doanh thu gộp" trend="Toàn hệ thống" icon="revenue" />
        <StatCard title="Hoa hồng admin" value={formatCurrency(stats.totalCommission)} note={`${adminData.commissionRate}% mỗi giao dịch`} trend="Lợi nhuận admin" icon="dashboard" />
        <StatCard title="Payout cho owner" value={formatCurrency(adminData.transactions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.ownerPayout, 0))} note="Doanh thu chia cho owner" trend="Sau commission" icon="owners" />
      </div>

      <div className="owner-two-col">
        <SectionCard
          title="Biểu đồ doanh thu"
          subtitle="Xem lợi nhuận theo ngày hoặc theo tháng."
          actions={(
            <div className="owner-toolbar">
              <select className="owner-input owner-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="day">Theo ngày</option>
                <option value="month">Theo tháng</option>
              </select>
              <select className="owner-input owner-select" value={series} onChange={(e) => setSeries(e.target.value)}>
                <option value="revenue">Doanh thu</option>
                <option value="commission">Hoa hồng</option>
              </select>
            </div>
          )}
        >
          <LineChart data={lineSeriesMap[period]?.[series] || []} />
        </SectionCard>

        <SectionCard title="Khối lượng đặt chỗ" subtitle="Khối lượng đơn theo kỳ đã chọn.">
          <BarChart data={lineSeriesMap[period]?.bookings || []} formatValue={(value) => `${value}`} />
        </SectionCard>
      </div>

      <SectionCard
        title="Lịch sử giao dịch"
        subtitle="Theo dõi gross, commission và payout theo từng đơn."
        actions={<input className="owner-input" placeholder="Tìm theo mã đơn, bãi hoặc user..." value={query} onChange={(e) => setQuery(e.target.value)} />}
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Mã đặt chỗ</th>
                <th>Bãi đỗ</th>
                <th>Thời gian</th>
                <th>Tổng</th>
                <th>Hoa hồng</th>
                <th>Chi trả</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.id}</td>
                  <td>{tx.bookingId}</td>
                  <td>{tx.parkingLot}</td>
                  <td>{formatDateTime(tx.time)}</td>
                  <td>{formatCurrency(tx.gross)}</td>
                  <td>{formatCurrency(tx.commission)}</td>
                  <td>{formatCurrency(tx.ownerPayout)}</td>
                  <td><StatusBadge status={tx.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
