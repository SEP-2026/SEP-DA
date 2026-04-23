import { useEffect, useState } from "react";

import { updateEmployeeParkingStatus } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";

export default function EmployeeProfile() {
  const { profile, refreshEmployee } = useEmployeeContext();
  const [statusValue, setStatusValue] = useState(profile?.parking_lot?.status || "open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatusValue(profile?.parking_lot?.status || "open");
  }, [profile?.parking_lot?.status]);

  const handleUpdateStatus = async () => {
    setSaving(true);
    try {
      await updateEmployeeParkingStatus({ status: statusValue });
      await refreshEmployee();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="employee-grid">
      <article className="employee-card">
        <h2>Employee Profile</h2>
        <p>Username: {profile?.employee?.username || "--"}</p>
        <p>Owner ID: {profile?.employee?.owner_id || "--"}</p>
        <p>Parking ID: {profile?.employee?.parking_id || "--"}</p>
        <p>Trạng thái tài khoản: {profile?.employee?.status || "--"}</p>
        <p className="employee-note">Employee chỉ có quyền xem, không được sửa thông tin cá nhân.</p>
      </article>

      <article className="employee-card">
        <h2>Hồ sơ bãi</h2>
        <p>Tên bãi: {profile?.parking_lot?.parking_name || "--"}</p>
        <p>Địa chỉ: {profile?.parking_lot?.address || "--"}</p>
        <p>Tổng chỗ: {profile?.parking_lot?.totalSlots || 0}</p>
        <p>Đang sử dụng: {profile?.parking_lot?.occupiedSlots || 0}</p>
        <p>Chỗ trống: {profile?.parking_lot?.emptySlots || 0}</p>

        <div className="employee-action-row">
          <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="full">full</option>
          </select>
          <button type="button" className="employee-btn" onClick={handleUpdateStatus} disabled={saving}>
            {saving ? "Đang lưu..." : "Cập nhật trạng thái bãi"}
          </button>
        </div>
      </article>
    </section>
  );
}
