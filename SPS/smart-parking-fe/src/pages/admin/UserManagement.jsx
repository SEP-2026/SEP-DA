import { useMemo, useState } from "react";
import { SectionCard, StatusBadge, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function UserManagement() {
  const { adminData, actions } = useAdminContext();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  const filtered = useMemo(
    () => (adminData.users || []).filter((item) => {
      const matchesQuery = `${item.name || ""} ${item.email || ""}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      return matchesQuery && matchesStatus;
    }),
    [adminData.users, query, statusFilter],
  );

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách người dùng"
        subtitle="Theo dõi trạng thái tài khoản và phát hiện hành vi spam."
        actions={(
          <div className="owner-toolbar">
            <input className="owner-input" placeholder="Tìm tên hoặc email" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="owner-input owner-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="banned">Bị khóa</option>
            </select>
          </div>
        )}
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th>Điểm spam</th>
                <th>Booking 14 ngày</th>
                <th>Hủy 14 ngày</th>
                <th>Hoạt động cuối</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td><StatusBadge status={user.status} /></td>
                  <td>
                    <strong>{user.spamScore ?? 0}</strong>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{user.spamStatus || "normal"}</div>
                  </td>
                  <td>{user.bookings14d ?? 0}</td>
                  <td>{user.cancelled14d ?? 0}</td>
                  <td>{formatDateTime(user.lastActive)}</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.toggleUserStatus(user.id, user.status === "active" ? "banned" : "active")}>
                        {user.status === "active" ? "Khóa" : "Mở khóa"}
                      </button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => setSelectedUser(user)}>Chi tiết</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {selectedUser ? (
        <div className="owner-modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="owner-modal owner-modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <div><h2>{selectedUser.name}</h2><p>Thông tin người dùng toàn hệ thống.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="owner-detail-grid">
              <div><span>Email</span><strong>{selectedUser.email}</strong></div>
              <div><span>Số điện thoại</span><strong>{selectedUser.phone || "--"}</strong></div>
              <div><span>Trạng thái</span><strong><StatusBadge status={selectedUser.status} /></strong></div>
              <div><span>Điểm spam</span><strong>{selectedUser.spamScore ?? 0}</strong></div>
              <div><span>Booking 14 ngày</span><strong>{selectedUser.bookings14d ?? 0}</strong></div>
              <div><span>Tỷ lệ hủy 14 ngày</span><strong>{Math.round((selectedUser.cancelRatio14d || 0) * 100)}%</strong></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
