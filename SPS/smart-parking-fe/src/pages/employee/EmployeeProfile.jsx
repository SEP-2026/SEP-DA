import { useEffect, useMemo, useState } from "react";

import { employeeChangePassword, updateEmployeeParkingStatus } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";
import { PASSWORD_POLICY_TEXT } from "../../services/passwordPolicy";

const STATUS_LABEL = {
  open: "Mở bãi",
  closed: "Đóng bãi",
  full: "Đầy chỗ",
};

export default function EmployeeProfile() {
  const { profile, slotsOverview, refreshEmployee } = useEmployeeContext();
  const [statusValue, setStatusValue] = useState(profile?.parking_lot?.status || "open");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    setStatusValue(profile?.parking_lot?.status || "open");
  }, [profile?.parking_lot?.status]);

  const isPasswordSuccess = useMemo(
    () => /thành công|thanh cong/i.test(passwordMessage),
    [passwordMessage],
  );

  const handleUpdateStatus = async () => {
    setSaving(true);
    try {
      await updateEmployeeParkingStatus({ status: statusValue });
      await refreshEmployee();
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setPasswordMessage("Vui lòng nhập đầy đủ thông tin đổi mật khẩu.");
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage("");
    try {
      const res = await employeeChangePassword(passwordForm);
      setPasswordMessage(res?.message || "Đổi mật khẩu thành công.");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      setPasswordMessage(error?.response?.data?.detail || "Không đổi được mật khẩu.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <section className="employee-grid employee-grid--profile">
      <article className="employee-card employee-section-shell">
        <div className="employee-section-headline">
          <h2>Hồ sơ tài khoản nhân viên</h2>
          <span className="employee-chip">Quyền hạn: vận hành bãi</span>
        </div>

        <div className="employee-profile-grid">
          <p><strong>Tên đăng nhập:</strong> {profile?.employee?.username || "--"}</p>
          <p><strong>Mã owner quản lý:</strong> {profile?.employee?.owner_id || "--"}</p>
          <p><strong>Mã bãi được gán:</strong> {profile?.employee?.parking_id || "--"}</p>
          <p><strong>Trạng thái tài khoản:</strong> {profile?.employee?.status || "--"}</p>
        </div>

        <div className="employee-profile-kv">
          <p>Tài khoản nhân viên có thể đổi mật khẩu đăng nhập, nhưng không thay đổi quyền vận hành bãi.</p>
        </div>

        <div className="employee-password-panel">
          <h3>Đổi mật khẩu đăng nhập</h3>
          <div className="employee-password-grid">
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={passwordForm.old_password}
              onChange={(event) => {
                setPasswordMessage("");
                setPasswordForm((prev) => ({ ...prev, old_password: event.target.value }));
              }}
            />
            <input
              type="password"
              placeholder="Mật khẩu mới"
              value={passwordForm.new_password}
              onChange={(event) => {
                setPasswordMessage("");
                setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }));
              }}
            />
            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={passwordForm.confirm_password}
              onChange={(event) => {
                setPasswordMessage("");
                setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }));
              }}
            />
          </div>
          <div className="employee-password-actions">
            <button type="button" className="employee-btn" onClick={handleChangePassword} disabled={passwordSaving}>
              {passwordSaving ? "Đang cập nhật..." : "Đổi mật khẩu"}
            </button>
            <p className="employee-note">{PASSWORD_POLICY_TEXT}</p>
          </div>
          {passwordMessage ? (
            <p className={`employee-password-message ${isPasswordSuccess ? "is-success" : "is-error"}`}>
              {passwordMessage}
            </p>
          ) : null}
        </div>
      </article>

      <article className="employee-card employee-section-shell">
        <div className="employee-section-headline">
          <h2>Thông tin bãi phụ trách</h2>
          <span className="employee-chip">{STATUS_LABEL[profile?.parking_lot?.status] || "Mở bãi"}</span>
        </div>

        <div className="employee-profile-grid">
          <p><strong>Tên bãi:</strong> {profile?.parking_lot?.parking_name || "--"}</p>
          <p><strong>Địa chỉ:</strong> {profile?.parking_lot?.address || "--"}</p>
          <p><strong>Tổng chỗ:</strong> {slotsOverview?.total_slots || profile?.parking_lot?.totalSlots || 0}</p>
          <p><strong>Đang sử dụng:</strong> {(slotsOverview?.in_use_slots || 0) + (slotsOverview?.reserved_slots || 0)}</p>
          <p><strong>Chỗ trống:</strong> {slotsOverview?.available_slots || profile?.parking_lot?.emptySlots || 0}</p>
        </div>

        <div className="employee-action-row employee-status-control">
          <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
            <option value="open">{STATUS_LABEL.open}</option>
            <option value="closed">{STATUS_LABEL.closed}</option>
            <option value="full">{STATUS_LABEL.full}</option>
          </select>
          <button type="button" className="employee-btn" onClick={handleUpdateStatus} disabled={saving}>
            {saving ? "Đang lưu..." : "Cập nhật trạng thái bãi"}
          </button>
        </div>
      </article>
    </section>
  );
}
