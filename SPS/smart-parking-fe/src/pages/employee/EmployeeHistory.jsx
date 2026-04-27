import { useEffect, useState } from "react";

import { getEmployeeHistory } from "../../employee/employeeService";

const ACTION_LABEL = {
  employee_created: "Tạo tài khoản nhân viên",
  parking_status_updated: "Cập nhật trạng thái bãi",
  check_in: "Check-in xe",
  check_out: "Check-out xe",
  resolve_booking: "Xem thông tin booking",
};

function decodeMojibake(value) {
  if (!value || typeof value !== "string") {
    return value || "";
  }
  if (!/[ÃƒÃ‚]/.test(value)) {
    return value;
  }
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

export default function EmployeeHistory() {
  const [data, setData] = useState({ history: [], total_count: 0 });
  const [actionFilter, setActionFilter] = useState("");
  const [limit, setLimit] = useState(100);

  const refreshHistory = async () => {
    const res = await getEmployeeHistory({
      limit,
      action: actionFilter || undefined,
    });
    setData(res);
  };

  useEffect(() => {
    refreshHistory().catch(() => setData({ history: [], total_count: 0 }));
    const timerId = window.setInterval(() => {
      refreshHistory().catch(() => null);
    }, 15000);
    return () => window.clearInterval(timerId);
  }, [actionFilter, limit]);

  return (
    <section className="employee-card employee-section-shell">
      <div className="employee-section-headline">
        <h2>Lịch sử hoạt động</h2>
        <div className="employee-action-row">
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">Tất cả hành động</option>
            <option value="check_in">Check-in</option>
            <option value="check_out">Check-out</option>
            <option value="resolve_booking">Xem booking</option>
            <option value="parking_status_updated">Cập nhật trạng thái bãi</option>
          </select>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value) || 100)}>
            <option value={50}>50 bản ghi</option>
            <option value={100}>100 bản ghi</option>
            <option value={200}>200 bản ghi</option>
          </select>
          <span className="employee-chip">Tổng bản ghi: {data.total_count}</span>
        </div>
      </div>

      <div className="employee-history-list">
        {data.history.length === 0 ? <p className="employee-note">Chưa có hoạt động nào được ghi nhận.</p> : null}

        {data.history.map((item) => (
          <article key={item.id} className="employee-history-item employee-history-item--timeline">
            <div>
              <strong>{ACTION_LABEL[item.action] || decodeMojibake(item.action)}</strong>
              <p>{decodeMojibake(item.detail) || "Không có mô tả"}</p>
            </div>
            <div className="employee-history-meta">
              <p>{new Date(item.created_at).toLocaleString("vi-VN")}</p>
              <span className="employee-status-pill">{Number(item.amount || 0).toLocaleString("vi-VN")}đ</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
