import { useMemo, useState } from "react";

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

  const activityLogs = useMemo(() => (adminData.logs || []).slice(0, 20), [adminData.logs]);
  const loginHistory = useMemo(() => (adminData.loginHistory || []).slice(0, 20), [adminData.loginHistory]);

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
        subtitle="Công cụ admin để tạo lại phân công, tự động phân công và kiểm tra owner_parking."
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
                  <td colSpan={3} className="owner-empty-cell">Chưa có dữ liệu kiểm tra phân công.</td>
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
        <SectionCard title="Nhật ký quản trị" subtitle="Theo dõi đầy đủ người thực hiện, hành động, thời gian và đối tượng.">
          {activityLogs.length === 0 ? (
            <p className="owner-empty">Chưa có dữ liệu nhật ký.</p>
          ) : (
            <div className="admin-log-list">
              {activityLogs.map((log) => (
                <article key={log.id} className="admin-log-item">
                  <div className="admin-log-main">
                    <div className="admin-log-head">
                      <strong>{log.actor || "Hệ thống"}</strong>
                      <StatusBadge status={log.type || "system"} />
                    </div>
                    <p className="admin-log-action">{log.action}</p>
                    <div className="admin-log-meta">
                      <span><b>Đối tượng:</b> {log.target || "--"}</span>
                      <span><b>Thời gian:</b> {formatDateTime(log.time)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Lịch sử đăng nhập" subtitle="Lịch sử đăng nhập và sự kiện bảo mật gần đây.">
          {loginHistory.length === 0 ? (
            <p className="owner-empty">Chưa có dữ liệu đăng nhập.</p>
          ) : (
            <div className="admin-login-list">
              {loginHistory.map((item) => (
                <article key={item.id} className="admin-login-item">
                  <div className="admin-login-main">
                    <strong>{item.email || "--"}</strong>
                    <span>{formatDateTime(item.time)}</span>
                  </div>
                  <div className="admin-login-meta">
                    <span><b>IP:</b> {item.ip || "--"}</span>
                    <span><b>Thiết bị:</b> {item.device || "--"}</span>
                    <StatusBadge status={item.status || "blocked"} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
