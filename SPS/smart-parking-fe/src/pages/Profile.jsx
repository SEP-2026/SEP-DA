import { useEffect, useMemo, useState } from "react";
import API, { getAuth, saveAuth } from "../services/api";
import { isStrongPassword, PASSWORD_POLICY_TEXT } from "../services/passwordPolicy";
import "./Profile.css";

const normalizeError = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") {
      return first;
    }
    if (first?.msg) {
      return first.msg;
    }
  }
  return fallback;
};

export default function Profile({ onAuthUpdated }) {
  const auth = getAuth();
  const [activeSection, setActiveSection] = useState("personal");

  const [loading, setLoading] = useState(true);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [personalNotice, setPersonalNotice] = useState("");
  const [vehicleNotice, setVehicleNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  const [personalForm, setPersonalForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [vehicleForm, setVehicleForm] = useState({
    licensePlate: "",
    brand: "",
    vehicleModel: "",
    seatCount: "",
    vehicleColor: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const greetingName = useMemo(() => personalForm.name || auth?.user?.name || "User", [personalForm.name, auth?.user?.name]);
  const sectionTitle = useMemo(() => {
    if (activeSection === "vehicle") {
      return "Thông tin xe";
    }
    if (activeSection === "password") {
      return "Đổi mật khẩu";
    }
    return "Thông tin cá nhân";
  }, [activeSection]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [meRes, vehicleRes] = await Promise.all([
          API.get("/auth/me"),
          API.get("/vehicle/my"),
        ]);

        const me = meRes.data || {};
        const vehicle = vehicleRes.data?.vehicle || {};

        setPersonalForm({
          name: me.name || "",
          email: me.email || "",
          phone: me.phone || "",
        });

        setVehicleForm({
          licensePlate: vehicle.license_plate || me.vehicle_plate || "",
          brand: vehicle.brand || "",
          vehicleModel: vehicle.vehicle_model || "",
          seatCount: vehicle.seat_count ? String(vehicle.seat_count) : "",
          vehicleColor: vehicle.vehicle_color || me.vehicle_color || "",
        });

        if (auth?.token) {
          const nextAuth = {
            ...auth,
            user: {
              ...auth.user,
              ...me,
            },
          };
          saveAuth(nextAuth);
          if (onAuthUpdated) {
            onAuthUpdated(nextAuth);
          }
        }
      } catch (err) {
        setPersonalNotice(normalizeError(err, "Không tải được hồ sơ người dùng"));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSavePersonal = async (event) => {
    event.preventDefault();
    setPersonalNotice("");

    if (!personalForm.name.trim()) {
      setPersonalNotice("Tên không được để trống");
      return;
    }

    if (!personalForm.email.trim()) {
      setPersonalNotice("Email không được để trống");
      return;
    }

    try {
      setPersonalLoading(true);
      const res = await API.put("/auth/me", {
        name: personalForm.name.trim(),
        email: personalForm.email.trim().toLowerCase(),
        phone: personalForm.phone.trim() || null,
      });

      const updatedUser = res.data?.user || {};
      const currentAuth = getAuth();
      if (currentAuth?.token) {
        const nextAuth = {
          ...currentAuth,
          user: {
            ...currentAuth.user,
            ...updatedUser,
          },
        };
        saveAuth(nextAuth);
        if (onAuthUpdated) {
          onAuthUpdated(nextAuth);
        }
      }

      setPersonalForm((prev) => ({
        ...prev,
        name: updatedUser.name || prev.name,
        email: updatedUser.email || prev.email,
        phone: updatedUser.phone || "",
      }));
      setPersonalNotice("Cập nhật hồ sơ thành công");
    } catch (err) {
      setPersonalNotice(normalizeError(err, "Cập nhật hồ sơ thất bại"));
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSaveVehicle = async (event) => {
    event.preventDefault();
    setVehicleNotice("");

    if (!vehicleForm.licensePlate.trim()) {
      setVehicleNotice("Biển số xe không được để trống");
      return;
    }

    const seatCountNumber = vehicleForm.seatCount ? Number(vehicleForm.seatCount) : null;
    if (seatCountNumber !== null && (!Number.isInteger(seatCountNumber) || seatCountNumber <= 0)) {
      setVehicleNotice("Số chỗ phải là số nguyên dương");
      return;
    }

    try {
      setVehicleLoading(true);
      const saveRes = await API.post("/vehicle/my/save", {
        license_plate: vehicleForm.licensePlate.trim(),
        brand: vehicleForm.brand.trim() || null,
        vehicle_model: vehicleForm.vehicleModel.trim() || null,
        seat_count: seatCountNumber,
        vehicle_color: vehicleForm.vehicleColor.trim() || null,
      });

      const vehicle = saveRes.data?.vehicle || {};
      setVehicleForm({
        licensePlate: vehicle.license_plate || "",
        brand: vehicle.brand || "",
        vehicleModel: vehicle.vehicle_model || "",
        seatCount: vehicle.seat_count ? String(vehicle.seat_count) : "",
        vehicleColor: vehicle.vehicle_color || "",
      });

      const currentAuth = getAuth();
      if (currentAuth?.token) {
        const nextAuth = {
          ...currentAuth,
          user: {
            ...currentAuth.user,
            vehicle_plate: vehicle.license_plate || currentAuth.user?.vehicle_plate || null,
            vehicle_color: vehicle.vehicle_color || currentAuth.user?.vehicle_color || null,
          },
        };
        saveAuth(nextAuth);
        if (onAuthUpdated) {
          onAuthUpdated(nextAuth);
        }
      }

      setVehicleNotice("Cập nhật thông tin xe thành công");
    } catch (err) {
      setVehicleNotice(normalizeError(err, "Cập nhật thông tin xe thất bại"));
    } finally {
      setVehicleLoading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordNotice("");

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordNotice("Vui lòng nhập đủ thông tin mật khẩu");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice("Mật khẩu mới và xác nhận mật khẩu không khớp");
      return;
    }

    if (!isStrongPassword(passwordForm.newPassword)) {
      setPasswordNotice(PASSWORD_POLICY_TEXT);
      return;
    }

    try {
      setPasswordLoading(true);
      await API.post("/auth/change-password", {
        old_password: passwordForm.oldPassword,
        new_password: passwordForm.newPassword,
      });

      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordNotice("Đổi mật khẩu thành công");
    } catch (err) {
      setPasswordNotice(normalizeError(err, "Đổi mật khẩu thất bại"));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="page-wrap">
        <div className="page-card profile-shell profile-frame">
          <p>Đang tải hồ sơ...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-wrap">
      <div className="page-card profile-shell profile-frame">
        <header className="profile-header">
          <span className="profile-spark profile-spark-left" aria-hidden="true">✦</span>
          <span className="profile-spark profile-spark-right" aria-hidden="true">✦</span>
          <h1 className="page-title">Hồ sơ tài khoản</h1>
          <p className="page-subtitle profile-subtitle">👤 Xin chào, <strong>{greetingName}</strong></p>
          <div className="profile-divider" aria-hidden="true">────◆────</div>
        </header>

        <div className="profile-layout">
          <aside className="profile-menu">
            <button
              type="button"
              className={`profile-menu-item ${activeSection === "personal" ? "is-active" : ""}`}
              onClick={() => setActiveSection("personal")}
            >
              <span aria-hidden="true">🪪</span>
              Thông tin cá nhân
            </button>
            <button
              type="button"
              className={`profile-menu-item ${activeSection === "vehicle" ? "is-active" : ""}`}
              onClick={() => setActiveSection("vehicle")}
            >
              <span aria-hidden="true">🚗</span>
              Thông tin xe
            </button>
            <button
              type="button"
              className={`profile-menu-item ${activeSection === "password" ? "is-active" : ""}`}
              onClick={() => setActiveSection("password")}
            >
              <span aria-hidden="true">🛡</span>
              Đổi mật khẩu
            </button>
          </aside>

          <section className="profile-content">
            <h2 className="profile-content-title">{sectionTitle}</h2>

            {activeSection === "personal" && (
              <form className="profile-card" onSubmit={handleSavePersonal}>
                <label>Họ và tên</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">👤</span>
                  <input
                    className="booking-input profile-input"
                    value={personalForm.name}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <label>Email</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">✉</span>
                  <input
                    className="booking-input profile-input"
                    type="email"
                    value={personalForm.email}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <label>Số điện thoại</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">📞</span>
                  <input
                    className="booking-input profile-input"
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <button className="profile-action-btn" type="submit" disabled={personalLoading}>
                  {personalLoading ? "Đang lưu..." : "→ Lưu hồ sơ"}
                </button>
                {personalNotice ? <p className="profile-notice">{personalNotice}</p> : null}
              </form>
            )}

            {activeSection === "vehicle" && (
              <form className="profile-card" onSubmit={handleSaveVehicle}>
                <label>Biển số xe</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🪪</span>
                  <input
                    className="booking-input profile-input"
                    value={vehicleForm.licensePlate}
                    onChange={(e) => setVehicleForm((prev) => ({ ...prev, licensePlate: e.target.value }))}
                  />
                </div>

                <label>Thương hiệu</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🚘</span>
                  <input
                    className="booking-input profile-input"
                    value={vehicleForm.brand}
                    onChange={(e) => setVehicleForm((prev) => ({ ...prev, brand: e.target.value }))}
                  />
                </div>

                <label>Dòng xe</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🚙</span>
                  <input
                    className="booking-input profile-input"
                    value={vehicleForm.vehicleModel}
                    onChange={(e) => setVehicleForm((prev) => ({ ...prev, vehicleModel: e.target.value }))}
                  />
                </div>

                <label>Số chỗ</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🪑</span>
                  <input
                    className="booking-input profile-input"
                    type="number"
                    min={1}
                    value={vehicleForm.seatCount}
                    onChange={(e) => setVehicleForm((prev) => ({ ...prev, seatCount: e.target.value }))}
                  />
                </div>

                <label>Màu xe</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🎨</span>
                  <input
                    className="booking-input profile-input"
                    value={vehicleForm.vehicleColor}
                    onChange={(e) => setVehicleForm((prev) => ({ ...prev, vehicleColor: e.target.value }))}
                  />
                </div>

                <button className="profile-action-btn" type="submit" disabled={vehicleLoading}>
                  {vehicleLoading ? "Đang lưu..." : "→ Lưu thông tin xe"}
                </button>
                {vehicleNotice ? <p className="profile-notice">{vehicleNotice}</p> : null}
              </form>
            )}

            {activeSection === "password" && (
              <form className="profile-card" onSubmit={handleChangePassword}>
                <label>Mật khẩu cũ</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🔒</span>
                  <input
                    className="booking-input profile-input"
                    type="password"
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                  />
                  <span className="profile-input-icon-right" aria-hidden="true">◌</span>
                </div>

                <label>Mật khẩu mới</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🔒</span>
                  <input
                    className="booking-input profile-input"
                    type="password"
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                  <span className="profile-input-icon-right" aria-hidden="true">◌</span>
                </div>

                <label>Xác nhận mật khẩu mới</label>
                <div className="profile-input-shell">
                  <span className="profile-input-icon" aria-hidden="true">🔒</span>
                  <input
                    className="booking-input profile-input"
                    type="password"
                    minLength={8}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  <span className="profile-input-icon-right" aria-hidden="true">◌</span>
                </div>

                <p className="profile-notice">{PASSWORD_POLICY_TEXT}</p>

                <button className="profile-action-btn" type="submit" disabled={passwordLoading}>
                  {passwordLoading ? "Đang đổi mật khẩu..." : "→ Cập nhật mật khẩu"}
                </button>
                {passwordNotice ? <p className="profile-notice">{passwordNotice}</p> : null}
              </form>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
