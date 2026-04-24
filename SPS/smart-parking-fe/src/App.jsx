import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Booking from "./pages/Booking";
import BookingHistory from "./pages/BookingHistory";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSettings from "./pages/admin/AdminSettings";
import BookingManagement from "./pages/admin/BookingManagement";
import OwnerManagement from "./pages/admin/OwnerManagement";
import ParkingManagement from "./pages/admin/ParkingManagement";
import RevenuePage from "./pages/admin/RevenuePage";
import UserManagement from "./pages/admin/UserManagement";
import OwnerBookings from "./pages/owner/OwnerBookings";
import OwnerCustomers from "./pages/owner/OwnerCustomers";
import OwnerOverview from "./pages/owner/OwnerOverview";
import OwnerParking from "./pages/owner/OwnerParking";
import OwnerRevenue from "./pages/owner/OwnerRevenue";
import OwnerReviewReplyPage from "./pages/owner/OwnerReviewReplyPage";
import OwnerReviews from "./pages/owner/OwnerReviews";
import OwnerSettings from "./pages/owner/OwnerSettings";
import Payment from "./pages/Payment";
import PaymentSuccess from "./pages/PaymentSuccess";
import Profile from "./pages/Profile";
import Scan from "./pages/Scan";
import AdminLayout from "./admin/AdminLayout";
import EmployeeLayout from "./employee/EmployeeLayout";
import OwnerLayout from "./owner/OwnerLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeHistory from "./pages/employee/EmployeeHistory";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeQrScanner from "./pages/employee/EmployeeQrScanner";
import EmployeeRevenue from "./pages/employee/EmployeeRevenue";
import EmployeeVehicles from "./pages/employee/EmployeeVehicles";
import API, { clearAuth, getAuth, saveAuth } from "./services/api";
import "./styles/layout.css";

function App() {
  const [auth, setAuth] = useState(() => getAuth());
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAuth()?.token));
  const role = auth?.user?.role || "";

  const handleLogout = async () => {
    try {
      if (auth?.token) {
        await API.post("/auth/logout");
      }
    } catch {
      // Ignore logout API failures and still clear local auth.
    } finally {
      clearAuth();
      setAuth(null);
    }
  };

  useEffect(() => {
    const verifySession = async () => {
      if (!auth?.token) {
        setCheckingSession(false);
        return;
      }

      try {
        const me = auth?.authType === "employee" || auth?.user?.role === "employee"
          ? await API.get("/api/employee/me")
          : await API.get("/auth/me");
        setAuth((prev) => {
          if (!prev) {
            return prev;
          }
          const nextAuth = {
            ...prev,
            user: {
              ...prev.user,
              ...me.data,
            },
          };
          saveAuth(nextAuth);
          return nextAuth;
        });
      } catch {
        clearAuth();
        setAuth(null);
      } finally {
        setCheckingSession(false);
      }
    };

    verifySession();
  }, [auth?.token, auth?.authType, auth?.user?.role]);

  if (checkingSession) {
    return null;
  }

  return (
    <BrowserRouter>
      <AppBody auth={auth} role={role} onLogin={setAuth} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

function AppBody({ auth, role, onLogin, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOwnerWorkspace = location.pathname.startsWith("/owner");
  const isAdminWorkspace = location.pathname.startsWith("/admin");
  const isEmployeeWorkspace = location.pathname.startsWith("/employee");
  const isOwnerScanPage = location.pathname.startsWith("/scan");
  const displayName = auth?.user?.full_name || auth?.user?.name || auth?.user?.username || auth?.user?.email || "";

  const navigateWithFallback = (to) => {
    navigate(to);

    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      const targetPath = to.startsWith("/") ? to : `/${to}`;
      if (window.location.pathname !== targetPath) {
        window.location.assign(targetPath);
      }
    }, 120);
  };

  const links = useMemo(() => {
    if (!auth) {
      return [];
    }

    const roleLinks = {
      user: [
        { to: "/booking", label: "Đặt chỗ" },
        { to: "/booking-history", label: "Lịch sử booking" },
        { to: "/profile", label: "Hồ sơ" },
      ],
      owner: [
        { to: "/profile", label: "Hồ sơ" },
        { to: "/scan", label: "Quét QR vào/ra" },
        { to: "/owner-review-replies", label: "Phản hồi đánh giá" },
        { to: "/owner/settings", label: "Tạo nhân viên" },
      ],
      employee: [
        { to: "/employee", label: "Dashboard Employee" },
      ],
      admin: [
        { to: "/admin", label: "Bảng Admin" },
        { to: "/booking", label: "Đặt chỗ" },
        { to: "/booking-history", label: "Lịch sử booking" },
        { to: "/profile", label: "Hồ sơ" },
        { to: "/scan", label: "Quét QR vào/ra" },
      ],
    };

    return [{ to: "/", label: "Trang bãi xe" }, ...(roleLinks[role] || [])];
  }, [auth, role]);

  const userInfo = [displayName, auth?.user?.email, auth?.user?.phone, auth?.user?.vehicle_plate]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className={`app-shell${isOwnerWorkspace || isOwnerScanPage ? " app-shell--owner" : ""}${isAdminWorkspace ? " app-shell--admin" : ""}${isEmployeeWorkspace ? " app-shell--employee" : ""}`}>
      {auth && !isOwnerWorkspace && !isAdminWorkspace && !isEmployeeWorkspace && !isOwnerScanPage ? (
        <nav className="app-nav">
          <div className="app-nav-links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) => `app-link${isActive ? " active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigateWithFallback(link.to);
                }}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="app-nav-user">
            <span>
              {userInfo}
            </span>
            <button type="button" className="app-logout-btn" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </nav>
      ) : null}

      <Routes>
        <Route
          path="/login"
          element={auth ? <Navigate to="/" replace /> : <Login onLogin={onLogin} />}
        />
        <Route
          path="/"
          element={auth ? (role === "admin" ? <Navigate to="/admin" replace /> : role === "employee" ? <Navigate to="/employee" replace /> : <Home role={role} />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/booking"
          element={auth ? <Booking /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/booking-history"
          element={auth ? <BookingHistory /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/profile"
          element={auth && role !== "employee" ? <Profile onAuthUpdated={onLogin} /> : <Navigate to={auth && role === "employee" ? "/employee/profile" : "/login"} replace />}
        />
        <Route
          path="/payment/:bookingId"
          element={auth ? <Payment /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/payment/success/:bookingId"
          element={auth ? <PaymentSuccess /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/scan"
          element={auth && (role === "owner" || role === "admin") ? <Scan /> : <Navigate to="/" replace />}
        />
        <Route
          path="/owner-review-replies"
          element={auth && role === "owner" ? <OwnerReviewReplyPage /> : <Navigate to={auth ? "/" : "/login"} replace />}
        />
        <Route
          path="/employee"
          element={auth && role === "employee" ? <EmployeeLayout auth={auth} onLogout={onLogout} /> : <Navigate to={auth ? "/" : "/login"} replace />}
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="scanner" element={<EmployeeQrScanner />} />
          <Route path="vehicles" element={<EmployeeVehicles />} />
          <Route path="revenue" element={<EmployeeRevenue />} />
          <Route path="history" element={<EmployeeHistory />} />
          <Route path="profile" element={<EmployeeProfile />} />
        </Route>
        <Route
          path="/owner"
          element={auth && role === "owner" ? <OwnerLayout auth={auth} onLogout={onLogout} /> : <Navigate to={auth && role === "admin" ? "/admin" : "/"} replace />}
        >
          <Route index element={<OwnerOverview />} />
          <Route path="parking" element={<OwnerParking />} />
          <Route path="bookings" element={<OwnerBookings />} />
          <Route path="customers" element={<OwnerCustomers />} />
          <Route path="revenue" element={<OwnerRevenue />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="settings" element={<OwnerSettings />} />
        </Route>
        <Route
          path="/admin"
          element={auth && role === "admin" ? <AdminLayout auth={auth} onLogout={onLogout} /> : <Navigate to="/" replace />}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="owners" element={<OwnerManagement />} />
          <Route path="parking-lots" element={<ParkingManagement />} />
          <Route path="bookings" element={<BookingManagement />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<Navigate to={auth ? "/" : "/login"} replace />} />
      </Routes>
    </div>
  );
}

export default App;
