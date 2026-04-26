import { BarChart, LineChart, SectionCard, StatCard } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminAnalytics() {
  const { adminData } = useAdminContext();
  const summary = adminData.analyticsSummary || {};

  return (
    <div className="owner-page-grid">
      <div className="owner-stats-grid">
        <StatCard
          title="Tăng trưởng người dùng"
          value={`${summary.userGrowthPercent ?? 0}%`}
          note="So với kỳ trước"
          trend={summary.userGrowthPercent >= 0 ? "Tích cực" : "Giảm"}
          icon="users"
        />
        <StatCard
          title="Tỷ lệ lấp đầy TB"
          value={`${summary.averageOccupancy ?? 0}%`}
          note="Toàn hệ thống"
          trend={`${summary.activeParkingLots ?? 0} bãi hoạt động`}
          icon="analytics"
        />
        <StatCard
          title="Bãi tốt nhất"
          value={summary.topParking || "Chưa có"}
          note="Hiệu suất cao nhất"
          trend={`${summary.topParkingOccupancy ?? 0}% lấp đầy`}
          icon="parking"
        />
      </div>
      <div className="owner-two-col">
        <SectionCard title="Tăng trưởng người dùng" subtitle="Số người dùng có booking theo tháng.">
          <LineChart data={adminData.systemRevenue.userGrowth} formatValue={(value) => `${value}`} />
        </SectionCard>
        <SectionCard title="Tỷ lệ lấp đầy theo bãi" subtitle="Tỷ lệ lấp đầy từng bãi.">
          <BarChart data={adminData.systemRevenue.occupancy} formatValue={(value) => `${value}%`} />
        </SectionCard>
      </div>
    </div>
  );
}
