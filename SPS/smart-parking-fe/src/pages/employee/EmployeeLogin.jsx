import { useEffect, useState } from "react";

import { employeeLogin } from "../../employee/employeeService";
import { saveAuth } from "../../services/api";
import "../../employee/employee.css";

export default function EmployeeLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("sessionExpired") === "1") {
      setError("Phiên đăng nhập employee đã hết hạn. Vui lòng đăng nhập lại.");
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await employeeLogin({
        username: username.trim().toLowerCase(),
        password,
      });
      const authPayload = {
        token: res.token,
        user: res.user,
        authType: "employee",
      };
      saveAuth(authPayload);
      onLogin(authPayload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Đăng nhập employee thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="employee-login">
      <div className="employee-login-card">
        <p className="employee-kicker">Smart Parking Platform</p>
        <h1>Employee Login</h1>
        <p>Đăng nhập bằng tài khoản do owner cấp. Employee chỉ có quyền vận hành bãi được phân công.</p>

        <form onSubmit={handleSubmit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username employee" required />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" required />
          {error ? <p className="employee-login-error">{error}</p> : null}
          <button className="employee-btn" type="submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập employee"}
          </button>
        </form>
      </div>
    </section>
  );
}
