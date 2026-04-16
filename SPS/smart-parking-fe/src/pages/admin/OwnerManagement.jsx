import { useState } from "react";
import { SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

const EMPTY_OWNER = { name: "", email: "", parkingLot: "", status: "active", performance: "Chưa có dữ liệu", passwordHint: "Mật khẩu tạm đã cấp" };

export default function OwnerManagement() {
  const { adminData, actions } = useAdminContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_OWNER);

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách owner"
        subtitle="Quản lý tài khoản chủ bãi, reset mật khẩu và theo dõi hiệu suất bãi."
        actions={<button type="button" className="btn-primary owner-btn" onClick={() => setIsModalOpen(true)}>Tạo tài khoản owner</button>}
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Email</th>
                <th>Bãi quản lý</th>
                <th>Trạng thái</th>
                <th>Hiệu suất</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {adminData.owners.map((owner) => (
                <tr key={owner.id}>
                  <td>{owner.name}</td>
                  <td>{owner.email}</td>
                  <td>{owner.parkingLot}</td>
                  <td><StatusBadge status={owner.status} /></td>
                  <td>{owner.performance}</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.toggleOwnerStatus(owner.id, owner.status === "active" ? "suspended" : "active")}>
                        {owner.status === "active" ? "Khóa" : "Mở khóa"}
                      </button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.resetOwnerPassword(owner.id)}>Reset mật khẩu</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.deleteOwner(owner.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {isModalOpen ? (
        <div className="owner-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <div><h2>Tạo owner mới</h2><p>Cấp tài khoản mới cho đối tác quản lý bãi.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form className="owner-form-grid" onSubmit={async (e) => { e.preventDefault(); await actions.addOwner(form); setIsModalOpen(false); setForm(EMPTY_OWNER); }}>
              <label>Tên owner<input className="owner-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Email<input className="owner-input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label className="owner-form-span">Bãi quản lý<input className="owner-input" value={form.parkingLot} onChange={(e) => setForm((p) => ({ ...p, parkingLot: e.target.value }))} /></label>
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">Tạo tài khoản</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
