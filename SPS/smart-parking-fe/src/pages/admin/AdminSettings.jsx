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
      setOpsMessage(typeof result?.message === "string" ? result.message : "Thao tac thanh cong");
      return result;
    } catch (error) {
      setOpsError(error?.response?.data?.detail || "Khong the thuc hien thao tac");
      return null;
    } finally {
      setOpsLoading(false);
    }
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Cai dat he thong"
        subtitle="Cau hinh ty le hoa hong, thoi gian bao tri va nguong canh bao."
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
            Ty le hoa hong (%)
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
            Email ho tro
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
            Khung bao tri
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
            Nguong canh bao (%)
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
            {saved ? <p className="owner-save-note">Da luu cau hinh he thong.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Luu cau hinh</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Van hanh phan cong owner"
        subtitle="Cong cu admin de rebuild, auto-assign va kiem tra owner_parking."
      >
        <div className="owner-row-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={() => runAdminOp(() => actions.rebuildOwnerAssignments())}
          >
            Rebuild Assignments
          </button>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={() => runAdminOp(() => actions.autoAssignOwners())}
          >
            Auto Assign Owners
          </button>
          <button
            type="button"
            className="btn-secondary owner-btn"
            disabled={opsLoading}
            onClick={async () => {
              const rows = await runAdminOp(() => actions.getOwnerAssignmentsDebug());
              if (Array.isArray(rows)) {
                setAssignmentRows(rows);
                setOpsMessage(`Tai ${rows.length} dong assignment`);
              }
            }}
          >
            Load Assignment Debug
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
                  <td colSpan={3} className="owner-empty-cell">Chua co du lieu debug assignment.</td>
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
        <SectionCard title="Nhat ky quan tri" subtitle="Nhat ky hanh dong quan tri moi nhat.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Nguoi thuc hien</th>
                  <th>Hanh dong</th>
                  <th>Thoi gian</th>
                  <th>Loai</th>
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

        <SectionCard title="Lich su dang nhap" subtitle="Lich su dang nhap va su kien bao mat.">
          <div className="owner-table-shell">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>IP</th>
                  <th>Thiet bi</th>
                  <th>Thoi gian</th>
                  <th>Trang thai</th>
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
