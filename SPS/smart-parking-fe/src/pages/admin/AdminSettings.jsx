import { useState } from "react";

import { SectionCard, StatusBadge, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function AdminSettings() {
  const { adminData, actions } = useAdminContext();
  const [form, setForm] = useState(adminData.settings);
  const [saved, setSaved] = useState(false);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsMessage, setOpsMessage] = useState("");
  const [opsError, setOpsError] = useState("");
  const [assignmentRows, setAssignmentRows] = useState([]);

  const runAdminOp = async (runner) => {
    setOpsLoading(true);
    setOpsMessage("");
    setOpsError("");
    try {
      const result = await runner();
      setOpsMessage(typeof result?.message === "string" ? result.message : "Thao tác thành công");
      return result;
    } catch (error) {
      setOpsError(error?.response?.data?.detail || "Không thể thực hiện thao tác");
      return null;
    } finally {
      setOpsLoading(false);
    }
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Cài đặt hệ thống"
        subtitle="Cấu hình tỷ lệ hoa hồng, thời gian bảo trì và ngưỡng cảnh báo."
      >
        <form
          className="owner-settings-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await actions.updateSettings(form);
            setSaved(true);
          }}
        >
          <label>
            Tỷ lệ hoa hồng (%)
            <input
              className="owner-input"
              value={form.commissionRate}
              onChange={(event) => {
                setSaved(false);
                setForm((prev) => ({ ...prev, commissionRate: event.target.value }));
              }}
            />
          </label>
          <label>
            Email hỗ trợ
            <input
              className="owner-input"
              value={form.supportEmail}
              onChange={(event) => {
                setSaved(false);
                setForm((prev) => ({ ...prev, supportEmail: event.target.value }));
              }}
            />
          </label>
          <label>
            Khung bảo trì
            <input
              className="owner-input"
              value={form.maintenanceWindow}
              onChange={(event) => {
                setSaved(false);
                setForm((prev) => ({ ...prev, maintenanceWindow: event.target.value }));
              }}
            />
          </label>
          <label>
            Ngưỡng cảnh báo (%)
            <input
              className="owner-input"
              value={form.alertThreshold}
              onChange={(event) => {
                setSaved(false);
                setForm((prev) => ({ ...prev, alertThreshold: event.target.value }));
              }}
            />
          </label>
          <div className="owner-settings-actions owner-form-span">
            {saved ? <p className="owner-save-note">Đã lưu cấu hình hệ thống.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Lưu cấu hình</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Vận hành phân công owner"
        subtitle="Công cụ admin để rebuild, auto-assign và kiểm tra owner_parking."
      >
        <div className="owner-row-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={() => runAdminOp(() => actions.rebuildOwnerAssignments())}
          >
            Tạo lại phân công
          </button>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={() => runAdminOp(() => actions.autoAssignOwners())}
          >
            Tự động phân công
          </button>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={async () => {
              const rows = await runAdminOp(() => actions.getOwnerAssignmentsDebug());
              if (Array.isArray(rows)) {
                setAssignmentRows(rows);
                setOpsMessage(`Tải ${rows.length} dòng assignment`);
              }
            }}
          >
            Tải dữ liệu kiểm tra
          </button>
        </div>
        {opsMessage ? <p className="owner-save-note">{opsMessage}</p> : null}
        {opsError ? <p className="owner-empty">{opsError}</p> : null}

        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Owner</th>
                <th>Parking</th>
              </tr>
            </thead>
            <tbody>
              {assignmentRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="owner-empty-cell">Chưa có dữ liệu debug assignment.</td>
                </tr>
              ) : (
                assignmentRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.owner_name} (#{row.owner_id})</td>
                    <td>{row.parking_name} (#{row.parking_id})</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                {(adminData.logs || []).map((log) => (
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
                {(adminData.loginHistory || []).map((item) => (
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
