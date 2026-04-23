import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { OwnerIcon } from "../owner/OwnerIcons";
import { getEmployeeParkingLot, getEmployeeProfile, getEmployeeRevenue } from "./employeeService";
import "./employee.css";

const NAV_ITEMS = [
  { to: "/employee", label: "Dashboard", icon: "dashboard" },
  { to: "/employee/scanner", label: "QR Scanner", icon: "scan" },
  { to: "/employee/vehicles", label: "Xe trong bãi", icon: "parking" },
  { to: "/employee/revenue", label: "Doanh thu", icon: "revenue" },
  { to: "/employee/history", label: "Lịch sử", icon: "reviews" },
  { to: "/employee/profile", label: "Hồ sơ bãi", icon: "settings" },
];

export default function EmployeeLayout({ auth, onLogout }) {
  const [parkingLot, setParkingLot] = useState(null);
  const [profile, setProfile] = useState(null);
  const [revenue, setRevenue] = useState({ revenueToday: 0, revenueMonth: 0 });
  const [loading, setLoading] = useState(true);

  const refreshEmployee = async () => {
    setLoading(true);
    try {
      const [parkingLotRes, profileRes, revenueRes] = await Promise.all([
        getEmployeeParkingLot(),
        getEmployeeProfile(),
        getEmployeeRevenue(),
      ]);
      setParkingLot(parkingLotRes);
      setProfile(profileRes);
      setRevenue(revenueRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEmployee();
  }, []);

  const displayName = auth?.user?.username || "employee";

  return (
    <div className="employee-shell">
      <aside className="employee-sidebar">
        <div className="employee-brand">
          <div className="employee-brand-mark">EP</div>
          <div>
            <strong>Smart Parking</strong>
            <span>Employee Console</span>
          </div>
        </div>

        <div>
          <p className="employee-sidebar-title">Điều hướng vận hành</p>
          <nav className="employee-menu">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/employee"} className={({ isActive }) => `employee-menu-link${isActive ? " active" : ""}`}>
                <OwnerIcon name={item.icon} className="owner-menu-icon" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <p className="employee-sidebar-title">Lối tắt</p>
          <NavLink to="/" className="employee-shortcut">Trang bãi xe</NavLink>
        </div>

        <button type="button" className="employee-logout" onClick={onLogout}>
          <OwnerIcon name="logout" className="owner-menu-icon" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="employee-main">
        <header className="employee-topbar">
          <div>
            <p className="employee-kicker">Employee Workspace</p>
            <h1>{parkingLot?.parking_name || "Bảng điều khiển nhân viên"}</h1>
            <span>{parkingLot?.address || "Theo dõi quét cổng, trạng thái bãi và doanh thu theo ca."}</span>
          </div>

          <div className="employee-avatar">
            <div className="employee-avatar-mark">{displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{displayName}</strong>
              <span>{loading ? "Đang đồng bộ..." : `Hôm nay ${Number(revenue.revenueToday || 0).toLocaleString("vi-VN")}đ`}</span>
            </div>
          </div>
        </header>

        <main className="employee-content">
          <Outlet context={{ auth, parkingLot, profile, revenue, refreshEmployee, loading }} />
        </main>
      </div>
    </div>
  );
}
