import { useState } from "react";
import { BarChart, LineChart, SectionCard, StatCard, formatCurrency, formatDateTime, StatusBadge } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function RevenuePage() {
  const { adminData, stats } = useAdminContext();
  const [series, setSeries] = useState("revenue");
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
          subtitle="So sánh doanh thu hệ thống và hoa hồng admin."
          actions={
            <select className="owner-input owner-select" value={series} onChange={(e) => setSeries(e.target.value)}>
              <option value="revenue">Doanh thu</option>
              <option value="commission">Hoa hồng</option>
            </select>
          }
        >
          <LineChart data={adminData.systemRevenue[series]} />
        </SectionCard>
        <SectionCard title="Khối lượng đặt chỗ" subtitle="Khối lượng đặt chỗ hỗ trợ phân tích doanh thu.">
          <BarChart data={adminData.systemRevenue.bookings} formatValue={(value) => `${value}`} />
        </SectionCard>
      </div>
      <SectionCard title="Lịch sử giao dịch" subtitle="Theo dõi gross, commission và payout.">
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead><tr><th>Mã GD</th><th>Mã đặt chỗ</th><th>Bãi đỗ</th><th>Thời gian</th><th>Tổng</th><th>Hoa hồng</th><th>Chi trả</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {adminData.transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.id}</td><td>{tx.bookingId}</td><td>{tx.parkingLot}</td><td>{formatDateTime(tx.time)}</td>
                  <td>{formatCurrency(tx.gross)}</td><td>{formatCurrency(tx.commission)}</td><td>{formatCurrency(tx.ownerPayout)}</td><td><StatusBadge status={tx.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
