import { useMemo, useState } from "react";
import { SectionCard, StatusBadge, formatDateTime } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

export default function UserManagement() {
  const { adminData, actions } = useAdminContext();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const filtered = useMemo(() => adminData.users.filter((item) => {
    const matchesQuery = `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [adminData.users, query, statusFilter]);

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách user"
        subtitle="Tìm kiếm, lọc, phân trang logic nhẹ và khóa hoặc mở khóa tài khoản."
        actions={
          <div className="owner-toolbar">
            <input className="owner-input" placeholder="Tìm tên hoặc email" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="owner-input owner-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        }
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th>Số booking</th>
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
                  <td>{user.bookingCount}</td>
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
              <div><h2>{selectedUser.name}</h2><p>Thông tin user trên toàn hệ thống.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="owner-detail-grid">
              <div><span>Email</span><strong>{selectedUser.email}</strong></div>
              <div><span>Số điện thoại</span><strong>{selectedUser.phone}</strong></div>
              <div><span>Trạng thái</span><strong><StatusBadge status={selectedUser.status} /></strong></div>
              <div><span>Số lần booking</span><strong>{selectedUser.bookingCount}</strong></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
