import { BarChart, LineChart, SectionCard, StatCard, StatusBadge, formatCurrency, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminDashboard() {
  const { adminData, stats } = useAdminContext();

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid owner-stats-grid--wide">
        <StatCard title="Tổng user" value={stats.totalUsers} note="User toàn hệ thống" trend="+12 tháng này" icon="users" />
        <StatCard title="Tổng owner" value={stats.totalOwners} note="Tài khoản đối tác" trend="+1 owner mới" icon="owners" />
        <StatCard title="Tổng bãi đỗ" value={stats.totalParkingLots} note="Bãi đang quản lý" trend="1 bãi chờ duyệt" icon="parking" />
        <StatCard title="Tổng booking" value={stats.totalBookings} note="Booking toàn hệ thống" trend="153 hôm nay" icon="booking" />
        <StatCard title="Doanh thu hệ thống" value={formatCurrency(stats.totalRevenue)} note="Gross revenue" trend={formatCurrency(stats.totalCommission)} icon="revenue" />
      </div>

      <div className="owner-two-col">
        <SectionCard title="Doanh thu hệ thống" subtitle="Biến động gross revenue theo thời gian.">
          <LineChart data={adminData.systemRevenue.revenue} />
        </SectionCard>
        <SectionCard title="Số lượng booking" subtitle="Khối lượng giao dịch theo ngày.">
          <BarChart data={adminData.systemRevenue.bookings} />
        </SectionCard>
      </div>

      <div className="owner-two-col owner-two-col--secondary">
        <SectionCard title="Commission của admin" subtitle="Phần lợi nhuận admin thu từ từng giao dịch.">
          <LineChart data={adminData.systemRevenue.commission} />
        </SectionCard>
        <SectionCard title="Activity Log gần đây" subtitle="Các hành động hệ thống và vận hành mới nhất.">
          <div className="owner-activity-list">
            {adminData.logs.map((log) => (
              <article key={log.id} className="owner-activity-item">
                <div>
                  <StatusBadge status={log.type} />
                  <h3>{log.action}</h3>
                </div>
                <span>{formatDateTime(log.time)}</span>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
