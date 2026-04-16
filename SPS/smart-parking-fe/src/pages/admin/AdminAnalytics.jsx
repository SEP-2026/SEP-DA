import { BarChart, LineChart, SectionCard, StatCard } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminAnalytics() {
  const { adminData } = useAdminContext();
  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid">
        <StatCard title="Tăng trưởng user" value="32%" note="So với quý trước" trend="Tích cực" icon="users" />
        <StatCard title="Tỷ lệ lấp đầy TB" value="77%" note="Toàn hệ thống" trend="4 bãi hoạt động" icon="analytics" />
        <StatCard title="Bãi tốt nhất" value="Tân Phú" note="Hiệu suất cao nhất" trend="86% fill rate" icon="parking" />
      </div>
      <div className="owner-two-col">
        <SectionCard title="User Growth" subtitle="Tăng trưởng user theo tháng.">
          <LineChart data={adminData.systemRevenue.userGrowth} formatValue={(value) => `${value}`} />
        </SectionCard>
        <SectionCard title="Occupancy by Lot" subtitle="Tỷ lệ lấp đầy từng bãi.">
          <BarChart data={adminData.systemRevenue.occupancy} />
        </SectionCard>
      </div>
    </div>
  );
}
