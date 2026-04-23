import { useEffect, useState } from "react";
import API, { saveAuth } from "../services/api";
import { isStrongPassword, PASSWORD_POLICY_TEXT } from "../services/passwordPolicy";
import "./Login.css";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPlate, setRegisterPlate] = useState("");
  const [registerColor, setRegisterColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("sessionExpired") === "1") {
      setError("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
    }
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const authPayload = {
        token: res.data.token,
        user: res.data.user,
      };
      saveAuth(authPayload);
      onLogin(authPayload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!registerName.trim()) {
      setError("Vui lòng nhập họ tên");
      return;
    }

    if (!isStrongPassword(registerPassword)) {
      setError(PASSWORD_POLICY_TEXT);
      return;
    }

    setLoading(true);
    try {
      await API.post("/auth/register", {
        name: registerName.trim(),
        email: registerEmail.trim().toLowerCase(),
        password: registerPassword,
        phone: registerPhone.trim() || null,
        vehicle_plate: registerPlate.trim() || null,
        vehicle_color: registerColor.trim() || null,
      });

      setSuccess("Tạo tài khoản user thành công. Bạn có thể đăng nhập ngay.");
      setMode("login");
      setEmail(registerEmail.trim().toLowerCase());
      setPassword("");
      setRegisterPassword("");
      setRegisterColor("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-wrap login-wrap">
      <div className="login-bg-shape" />
      <div className="login-map-overlay" />
      <div className="page-card login-card fancy-panel">
        <div className="parking-mark" aria-hidden="true">🚗</div>
        <p className="login-kicker">Smart Parking Platform</p>
        <h1 className="page-title login-title">Bãi đỗ xe thông minh</h1>

        <div className="segment-wrap" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`segment-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`segment-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
              setSuccess("");
            }}
          >
            Tạo tài khoản
          </button>
        </div>

        {mode === "login" ? (
          <form className="login-form" onSubmit={handleLogin}>
            <label className="login-label" htmlFor="email">Email hoac username employee</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">✉</span>
              <input
                id="email"
                className="login-input"
                type="text"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@domain.com hoac employee_demo"
                required
              />
            </div>

            <label className="login-label" htmlFor="password">Mật khẩu</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">🔒</span>
              <input
                id="password"
                className="login-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
              <span className="input-icon right" aria-hidden="true">◌</span>
            </div>

            <button
              type="button"
              className="forgot-link"
              onClick={() => setError("Tính năng quên mật khẩu sẽ được cập nhật sau")}
            >
              Quên mật khẩu?
            </button>

            {error ? <p className="login-error">{error}</p> : null}
            {success ? <p className="login-success">{success}</p> : null}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleRegister}>
            <p className="register-heading">Đăng ký tài khoản user</p>
            <label className="login-label" htmlFor="register-name">Họ và tên</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">👤</span>
              <input
                id="register-name"
                className="login-input"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="Nguyen Van A"
                required
              />
            </div>

            <label className="login-label" htmlFor="register-email">Email</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">✉</span>
              <input
                id="register-email"
                className="login-input"
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="email@domain.com"
                required
              />
            </div>

            <label className="login-label" htmlFor="register-password">Mật khẩu</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">🔒</span>
              <input
                id="register-password"
                className="login-input"
                type="password"
                minLength={8}
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="Ví dụ: Longtu26@"
                required
              />
            </div>
            <p className="register-note">{PASSWORD_POLICY_TEXT}</p>

            <label className="login-label" htmlFor="register-phone">Số điện thoại (tùy chọn)</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">☎</span>
              <input
                id="register-phone"
                className="login-input"
                value={registerPhone}
                onChange={(event) => setRegisterPhone(event.target.value)}
                placeholder="09xxxxxxxx"
              />
            </div>

            <label className="login-label" htmlFor="register-plate">Biển số xe (tùy chọn)</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">🚙</span>
              <input
                id="register-plate"
                className="login-input"
                value={registerPlate}
                onChange={(event) => setRegisterPlate(event.target.value)}
                placeholder="30A-12345"
              />
            </div>

            <label className="login-label" htmlFor="register-color">Màu xe (tùy chọn)</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">🎨</span>
              <input
                id="register-color"
                className="login-input"
                value={registerColor}
                onChange={(event) => setRegisterColor(event.target.value)}
                placeholder="Đen, trắng, đỏ..."
              />
            </div>

            {error ? <p className="login-error">{error}</p> : null}
            {success ? <p className="login-success">{success}</p> : null}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản user"}
            </button>

            <p className="register-note">Hệ thống chỉ cho phép tự đăng ký role user tại màn hình này.</p>
          </form>
        )}
      </div>
    </section>
  );
}
