import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";

import Booking from "./pages/Booking";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Payment from "./pages/Payment";
import PaymentSuccess from "./pages/PaymentSuccess";
import Scan from "./pages/Scan";
import API, { clearAuth, getAuth } from "./services/api";
import "./styles/layout.css";

function App() {
  const [auth, setAuth] = useState(() => getAuth());
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAuth()?.token));

  const role = auth?.user?.role || "";

  const links = useMemo(() => {
    if (!auth) {
      return [];
    }

    const roleLinks = {
      user: [{ to: "/booking", label: "Đặt chỗ" }],
      owner: [
        { to: "/booking", label: "Đặt chỗ" },
        { to: "/scan", label: "Quét QR vào/ra" },
      ],
      admin: [
        { to: "/booking", label: "Đặt chỗ" },
        { to: "/scan", label: "Quét QR vào/ra" },
      ],
    };

    return [{ to: "/", label: "Trang bãi xe" }, ...(roleLinks[role] || [])];
  }, [auth, role]);

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
        const me = await API.get("/auth/me");
        setAuth((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            user: {
              ...prev.user,
              ...me.data,
            },
          };
        });
      } catch {
        clearAuth();
        setAuth(null);
      } finally {
        setCheckingSession(false);
      }
    };

    verifySession();
  }, [auth?.token]);

  if (checkingSession) {
    return null;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        {auth ? (
          <nav className="app-nav">
            <div className="app-nav-links">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) => `app-link${isActive ? " active" : ""}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <div className="app-nav-user">
              <span>{auth.user.email} ({role})</span>
              <button type="button" className="app-logout-btn" onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          </nav>
        ) : null}

        <Routes>
          <Route
            path="/login"
            element={auth ? <Navigate to="/" replace /> : <Login onLogin={setAuth} />}
          />
          <Route
            path="/"
            element={auth ? <Home /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/booking"
            element={auth ? <Booking /> : <Navigate to="/login" replace />}
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
          <Route path="*" element={<Navigate to={auth ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
