import { useState } from "react";
import { SectionCard, StatusBadge, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminSettings() {
  const { adminData, actions } = useAdminContext();
  const [form, setForm] = useState(adminData.settings);
  const [saved, setSaved] = useState(false);

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Cài đặt hệ thống"
        subtitle="Cấu hình tỷ lệ hoa hồng, thời gian bảo trì và ngưỡng cảnh báo."
      >
        <form
          className="owner-settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await actions.updateSettings(form);
            setSaved(true);
          }}
        >
          <label>
            Tỷ lệ hoa hồng (%)
            <input
              className="owner-input"
              value={form.commissionRate}
              onChange={(e) => {
                setSaved(false);
                setForm((p) => ({ ...p, commissionRate: e.target.value }));
              }}
            />
          </label>
          <label>
            Email hỗ trợ
            <input
              className="owner-input"
              value={form.supportEmail}
              onChange={(e) => {
                setSaved(false);
                setForm((p) => ({ ...p, supportEmail: e.target.value }));
              }}
            />
          </label>
          <label>
            Khung bảo trì
            <input
              className="owner-input"
              value={form.maintenanceWindow}
              onChange={(e) => {
                setSaved(false);
                setForm((p) => ({ ...p, maintenanceWindow: e.target.value }));
              }}
            />
          </label>
          <label>
            Ngưỡng cảnh báo (%)
            <input
              className="owner-input"
              value={form.alertThreshold}
              onChange={(e) => {
                setSaved(false);
                setForm((p) => ({ ...p, alertThreshold: e.target.value }));
              }}
            />
          </label>
          <div className="owner-settings-actions owner-form-span">
            {saved ? <p className="owner-save-note">Đã lưu cấu hình hệ thống.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Lưu cấu hình</button>
          </div>
        </form>
      </SectionCard>

      <div className="owner-two-col">
        <SectionCard title="Nhật ký quản trị" subtitle="Nhật ký hành động quản trị mới nhất.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Thời gian</th>
                  <th>Loại</th>
                </tr>
              </thead>
              <tbody>
                {adminData.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.actor}</td>
                    <td>{log.action}</td>
                    <td>{formatDateTime(log.time)}</td>
                    <td><StatusBadge status={log.type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Lịch sử đăng nhập" subtitle="Lịch sử đăng nhập và sự kiện bảo mật.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>IP</th>
                  <th>Thiết bị</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {adminData.loginHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.email}</td>
                    <td>{item.ip}</td>
                    <td>{item.device}</td>
                    <td>{formatDateTime(item.time)}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
