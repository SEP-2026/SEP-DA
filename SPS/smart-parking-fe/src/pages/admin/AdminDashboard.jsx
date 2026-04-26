import { BarChart, LineChart, SectionCard, StatCard, StatusBadge, formatCurrency, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminDashboard() {
  const { adminData, stats } = useAdminContext();

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid owner-stats-grid--wide">
        <StatCard title="Tổng người dùng" value={stats.totalUsers} note="Người dùng toàn hệ thống" trend={`${adminData.users.filter((u) => u.status === "active").length} đang hoạt động`} icon="users" />
        <StatCard title="Tổng chủ bãi" value={stats.totalOwners} note="Tài khoản đối tác" trend={`${adminData.owners.filter((o) => o.status === "active").length} hoạt động`} icon="owners" />
        <StatCard title="Tổng bãi đỗ" value={stats.totalParkingLots} note="Bãi đang được quản lý" trend={`${adminData.parkingLots.filter((p) => p.status === "pending").length} chờ duyệt`} icon="parking" />
        <StatCard title="Tổng đặt chỗ" value={stats.totalBookings} note="Đặt chỗ toàn hệ thống" trend={`${adminData.bookings.filter((b) => b.status === "in_progress").length} đang diễn ra`} icon="booking" />
        <StatCard title="Doanh thu hệ thống" value={formatCurrency(stats.totalRevenue)} note="Doanh thu gộp" trend={formatCurrency(stats.totalCommission)} icon="revenue" />
      </div>

      <div className="owner-two-col">
        <SectionCard title="Doanh thu hệ thống" subtitle="Biến động doanh thu theo thời gian.">
          <LineChart data={adminData.systemRevenue.revenue} />
        </SectionCard>
        <SectionCard title="Số lượng đặt chỗ" subtitle="Khối lượng giao dịch theo ngày.">
          <BarChart data={adminData.systemRevenue.bookings} formatValue={(value) => `${value}`} />
        </SectionCard>
      </div>

      <div className="owner-two-col owner-two-col--secondary">
        <SectionCard title="Hoa hồng của admin" subtitle="Phần hoa hồng admin thu từ mỗi giao dịch.">
          <LineChart data={adminData.systemRevenue.commission} />
        </SectionCard>
        <SectionCard title="Nhật ký hoạt động gần đây" subtitle="Các hành động hệ thống và vận hành mới nhất.">
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
