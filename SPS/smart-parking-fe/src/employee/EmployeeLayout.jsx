import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { OwnerIcon } from "../owner/OwnerIcons";
import { getEmployeeParkingLot, getEmployeeProfile, getEmployeeRevenue, getEmployeeSlotsOverview } from "./employeeService";
import "./employee.css";

const NAV_ITEMS = [
  { to: "/employee", label: "Bảng điều khiển", icon: "dashboard" },
  { to: "/employee/scanner", label: "Quét mã QR", icon: "scan" },
  { to: "/employee/vehicles", label: "Xe trong bãi", icon: "parking" },
  { to: "/employee/revenue", label: "Doanh thu", icon: "revenue" },
  { to: "/employee/history", label: "Lịch sử", icon: "reviews" },
  { to: "/employee/profile", label: "Hồ sơ bãi", icon: "settings" },
];

const ROUTE_HINT = {
  "/employee": "Tổng quan luồng xe và trạng thái bãi theo thời gian thực.",
  "/employee/scanner": "Xử lý check-in/check-out bằng mã QR tại cổng.",
  "/employee/vehicles": "Danh sách xe đang ở trong bãi và vị trí đỗ.",
  "/employee/revenue": "Theo dõi doanh thu theo ngày và theo tháng.",
  "/employee/history": "Nhật ký thao tác gần nhất của nhân viên.",
  "/employee/profile": "Thông tin bãi đỗ đang được phân công vận hành.",
};

export default function EmployeeLayout({ auth, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [parkingLot, setParkingLot] = useState(null);
  const [profile, setProfile] = useState(null);
  const [revenue, setRevenue] = useState({ revenueToday: 0, revenueMonth: 0 });
  const [slotsOverview, setSlotsOverview] = useState({
    total_slots: 0,
    available_slots: 0,
    reserved_slots: 0,
    in_use_slots: 0,
    maintenance_slots: 0,
    slots: [],
  });
  const [loading, setLoading] = useState(true);

  const refreshEmployee = async () => {
    setLoading(true);
    try {
      const [parkingLotRes, profileRes, revenueRes, slotsOverviewRes] = await Promise.all([
        getEmployeeParkingLot(),
        getEmployeeProfile(),
        getEmployeeRevenue(),
        getEmployeeSlotsOverview(),
      ]);
      setParkingLot(parkingLotRes);
      setProfile(profileRes);
      setRevenue(revenueRes);
      setSlotsOverview(slotsOverviewRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEmployee();

    const intervalId = window.setInterval(() => {
      refreshEmployee();
    }, 10000);

    const handleFocus = () => refreshEmployee();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshEmployee();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const displayName = auth?.user?.username || "nhân viên";
  const routeHint = ROUTE_HINT[location.pathname] || "Không gian vận hành dành cho tài khoản nhân viên.";
  const notificationsCount = Math.max(0, Number(parkingLot?.occupiedSlots || 0));

  return (
    <div className={`employee-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <aside className="employee-sidebar">
        <div className="employee-brand">
          <div className="employee-brand-mark">EP</div>
          <div>
            <strong>Smart Parking</strong>
            <span>Trung tâm vận hành nhân viên</span>
          </div>
        </div>

        <div className="employee-sidebar-panel">
          <p className="employee-sidebar-title">Điều hướng vận hành</p>
          <nav className="employee-menu">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/employee"}
                className={({ isActive }) => `employee-menu-link${isActive ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <OwnerIcon name={item.icon} className="owner-menu-icon" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="employee-sidebar-panel employee-sidebar-panel--compact">
          <p className="employee-sidebar-title">Lối tắt</p>
          <Link to="/" className="employee-shortcut">Trang bãi xe</Link>
          <Link to="/scan" className="employee-shortcut">Quét cổng owner/admin</Link>
        </div>

        <button type="button" className="employee-logout" onClick={onLogout}>
          <OwnerIcon name="logout" className="owner-menu-icon" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="employee-main">
        <header className="employee-topbar">
          <div className="employee-topbar-main">
            <button type="button" className="employee-menu-toggle" onClick={() => setSidebarOpen((value) => !value)}>
              <OwnerIcon name="menu" className="owner-menu-icon" />
            </button>
            <div>
              <p className="employee-kicker">Không gian nhân viên</p>
              <h1>{parkingLot?.parking_name || "Bảng điều khiển nhân viên"}</h1>
              <span>{parkingLot?.address || routeHint}</span>
            </div>
          </div>

          <div className="employee-topbar-tools">
            <div className="employee-notify-pill">
              <OwnerIcon name="bell" className="owner-menu-icon" />
              <span>{notificationsCount}</span>
            </div>
            <div className="employee-role-pill">Vận hành bãi</div>
            <div className="employee-avatar">
              <div className="employee-avatar-mark">{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{displayName}</strong>
                <span>{loading ? "Đang đồng bộ..." : `Hôm nay ${Number(revenue.revenueToday || 0).toLocaleString("vi-VN")}đ`}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="employee-content">
          <Outlet context={{ auth, parkingLot, profile, revenue, slotsOverview, refreshEmployee, loading }} />
        </main>
      </div>
    </div>
  );
}
