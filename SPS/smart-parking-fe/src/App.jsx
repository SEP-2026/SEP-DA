import { useMemo, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";

import Booking from "./pages/Booking";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Scan from "./pages/Scan";
import API, { clearAuth, getAuth } from "./services/api";
import "./styles/layout.css";

function App() {
  const [auth, setAuth] = useState(() => getAuth());

  const role = auth?.user?.role || "";

  const links = useMemo(() => {
    if (!auth) {
      return [];
    }

    const roleLinks = {
      user: [{ to: "/booking", label: "Đặt chỗ + QR" }],
      owner: [
        { to: "/booking", label: "Đặt chỗ + QR" },
        { to: "/scan", label: "Quét QR vào/ra" },
      ],
      admin: [
        { to: "/booking", label: "Đặt chỗ + QR" },
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
