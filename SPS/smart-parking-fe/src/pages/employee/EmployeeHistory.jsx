import { useEffect, useState } from "react";

import { getEmployeeHistory } from "../../employee/employeeService";

const ACTION_LABEL = {
  employee_created: "Tạo tài khoản nhân viên",
  parking_status_updated: "Cập nhật trạng thái bãi",
  check_in: "Check-in xe",
  check_out: "Check-out xe",
};

function decodeMojibake(value) {
  if (!value || typeof value !== "string") {
    return value || "";
  }
  if (!/[ÃÂ]/.test(value)) {
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

  useEffect(() => {
    getEmployeeHistory().then(setData).catch(() => setData({ history: [], total_count: 0 }));
  }, []);

  return (
    <section className="employee-card employee-section-shell">
      <div className="employee-section-headline">
        <h2>Lịch sử hoạt động</h2>
        <span className="employee-chip">Tổng bản ghi: {data.total_count}</span>
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
