import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import API from "../services/api";
import { OwnerIcon } from "./OwnerIcons";
import { OWNER_NAV_ITEMS, OWNER_ROUTE_META, createOwnerSeedData } from "./ownerData";
import "./owner.css";

function normalizeBackendStatus(status, index) {
  if (status === "available") {
    return "available";
  }
  if (status === "occupied") {
    return index % 2 === 0 ? "reserved" : "in_use";
  }
  return "maintenance";
}

export default function OwnerLayout({ auth, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerData, setOwnerData] = useState(() => createOwnerSeedData());
  const [syncNote, setSyncNote] = useState("Đang tải dữ liệu bãi");

  const refreshOwnerData = useCallback(async () => {
    try {
      const res = await API.get("/owner/bootstrap");
      if (res.data?.parkingLot) {
        setOwnerData((prev) => ({
          ...prev,
          slots: Array.isArray(res.data.slots) ? res.data.slots : prev.slots,
          bookings: Array.isArray(res.data.bookings) ? res.data.bookings : prev.bookings,
          transactions: Array.isArray(res.data.transactions) ? res.data.transactions : prev.transactions,
          activities: Array.isArray(res.data.activities) ? res.data.activities : prev.activities,
          reviews: Array.isArray(res.data.reviews) ? res.data.reviews : prev.reviews,
          settings: res.data.settings ? { ...prev.settings, ...res.data.settings } : prev.settings,
        }));
        setSyncNote(`Đồng bộ bãi: ${res.data.parkingLot.name}`);
        return;
      }
      setOwnerData((prev) => ({
        ...prev,
        slots: [],
        bookings: [],
        transactions: [],
        activities: [],
        reviews: [],
        settings: {
          ...prev.settings,
          parkingName: "Chưa được gán bãi",
          slotCapacity: "0",
        },
      }));
      setSyncNote("Owner chưa được gán bãi trong CSDL");
    } catch {
      try {
        const res = await API.get("/slots");
        if (!Array.isArray(res.data) || res.data.length === 0) {
          setSyncNote("Đang dùng dữ liệu mẫu");
          return;
        }

        setOwnerData((prev) => ({
          ...prev,
          slots: res.data.map((slot, index) => ({
            id: slot.id || `slot-api-${index + 1}`,
            code: slot.code || slot.slot_number || `S-${index + 1}`,
            zone: ["Khu A", "Khu B", "Khu C"][index % 3],
            level: index < 6 ? "Tầng 1" : "Tầng 2",
            status: normalizeBackendStatus(slot.status, index),
            type: ["Sedan", "SUV", "EV"][index % 3],
            updatedAt: new Date().toISOString(),
            })),
        }));
        setSyncNote("Đồng bộ chỗ đỗ từ API");
      } catch {
        setSyncNote("Đang dùng dữ liệu mẫu");
      }
    }
  }, []);

  useEffect(() => {
    refreshOwnerData();
  }, [refreshOwnerData]);

  const stats = useMemo(() => {
    const todayRevenue = ownerData.transactions
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + item.amount, 0);
    const todayBookings = ownerData.bookings.filter((item) => item.startTime.startsWith("2026-04-15")).length;

    return {
      totalSlots: ownerData.slots.length,
      availableSlots: ownerData.slots.filter((item) => item.status === "available").length,
      usedSlots: ownerData.slots.filter((item) => item.status === "in_use").length,
      todayBookings,
      todayRevenue,
    };
  }, [ownerData]);

  const meta = OWNER_ROUTE_META[location.pathname] || OWNER_ROUTE_META["/owner"];
  const notificationsCount = ownerData.activities.length;
  const ownerDisplayName = auth?.user?.full_name || auth?.user?.name || auth?.user?.email || "Owner";

  const actions = {
    async addSlot(payload) {
      try {
        await API.post("/owner/slots", payload);
        await refreshOwnerData();
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể thêm chỗ đỗ");
        return false;
      }
    },
    async updateSlot(id, payload) {
      try {
        await API.patch(`/owner/slots/${id}`, payload);
        await refreshOwnerData();
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể cập nhật chỗ đỗ");
        return false;
      }
    },
    async deleteSlot(id) {
      try {
        await API.delete(`/owner/slots/${id}`);
        await refreshOwnerData();
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể xóa chỗ đỗ");
        return false;
      }
    },
    async updateBookingStatus(id, status) {
      try {
        await API.patch(`/owner/bookings/${id}/status`, { status });
        await refreshOwnerData();
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể cập nhật booking");
        return false;
      }
    },
    async updateSettings(payload) {
      try {
        await API.patch("/owner/settings", {
          parkingName: payload.parkingName,
          pricePerHour: payload.pricePerHour,
          pricePerDay: payload.pricePerDay,
          pricePerMonth: payload.pricePerMonth,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
        });
        await refreshOwnerData();
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể lưu cài đặt bãi");
        return false;
      }
    },
    async updateAccount(payload) {
      try {
        const res = await API.patch("/owner/account", payload);
        setOwnerData((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            contactEmail: res.data.user.email,
          },
        }));
        setSyncNote("Đã cập nhật tài khoản owner");
        return true;
      } catch (error) {
        window.alert(error?.response?.data?.detail || "Không thể cập nhật tài khoản");
        return false;
      }
    },
  };

  return (
    <div className={`owner-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <aside className="owner-sidebar">
        <div className="owner-brand">
          <div className="owner-brand-mark">SP</div>
          <div>
            <strong>Smart Parking</strong>
            <span>Owner Console</span>
          </div>
        </div>

        <div className="owner-sidebar-panel">
          <p className="owner-sidebar-title">Điều hướng vận hành</p>
          <nav className="owner-menu">
            {OWNER_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/owner"}
                className={({ isActive }) => `owner-menu-link${isActive ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <OwnerIcon name={item.icon} className="owner-menu-icon" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="owner-sidebar-panel owner-sidebar-panel--compact">
          <p className="owner-sidebar-title">Lối tắt</p>
          <Link to="/" className="owner-shortcut">Trang bãi xe</Link>
          <Link to="/booking" className="owner-shortcut">Đặt chỗ</Link>
          <Link to="/scan" className="owner-shortcut">Quét QR</Link>
        </div>

        <button type="button" className="owner-logout" onClick={onLogout}>
          <OwnerIcon name="logout" className="owner-menu-icon" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="owner-main">
        <header className="owner-topbar">
          <div className="owner-topbar-main">
            <button type="button" className="owner-menu-toggle" onClick={() => setSidebarOpen((value) => !value)}>
              <OwnerIcon name="menu" className="owner-menu-icon" />
            </button>
            <div>
              <p className="owner-kicker">Owner Workspace</p>
              <h1>{meta.title}</h1>
              <span>{meta.description}</span>
            </div>
          </div>

          <div className="owner-topbar-tools">
            <div className="owner-notify-pill">
              <OwnerIcon name="bell" className="owner-menu-icon" />
              <span>{notificationsCount}</span>
            </div>
            <div className="owner-role-pill">Tài khoản vận hành</div>
            <div className="owner-avatar" title={syncNote}>
              <div className="owner-avatar-mark">{ownerDisplayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{ownerDisplayName}</strong>
                <span>{syncNote}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="owner-content">
          <Outlet context={{ auth, ownerData, stats, actions }} />
        </main>
      </div>
    </div>
  );
}
