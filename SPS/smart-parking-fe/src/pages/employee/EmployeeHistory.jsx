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
    <section className="employee-card">
      <h2>Lịch sử hoạt động</h2>
      <p>Tổng bản ghi: {data.total_count}</p>
      <div className="employee-history-list">
        {data.history.map((item) => (
          <article key={item.id} className="employee-history-item">
            <div>
              <strong>{ACTION_LABEL[item.action] || decodeMojibake(item.action)}</strong>
              <p>{decodeMojibake(item.detail) || "Không có mô tả"}</p>
            </div>
            <div>
              <p>{new Date(item.created_at).toLocaleString("vi-VN")}</p>
              <p>{Number(item.amount || 0).toLocaleString("vi-VN")}đ</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
