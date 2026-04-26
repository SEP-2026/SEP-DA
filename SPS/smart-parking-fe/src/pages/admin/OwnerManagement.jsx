import { useMemo, useState } from "react";
import { SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

const EMPTY_OWNER = {
  name: "",
  email: "",
  parkingLot: "",
  status: "active",
};

export default function OwnerManagement() {
  const { adminData, actions } = useAdminContext();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_OWNER);
  const [search, setSearch] = useState("");
  const [editingOwner, setEditingOwner] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", status: "active", parkingLot: "" });

  const flattenedOwners = useMemo(
    () => (adminData.owners || []).flatMap((owner) => {
      if (owner.parkingLots && owner.parkingLots.length > 0) {
        return owner.parkingLots.map((p) => ({ ...owner, parkingLot: p.name, parkingId: p.id }));
      }
      return [{ ...owner, parkingLot: owner.parkingLot || "Chưa gán trong CSDL", parkingId: null }];
    }),
    [adminData.owners],
  );

  const filteredOwners = useMemo(
    () => flattenedOwners.filter((o) => {
      if (!search || !search.trim()) return true;
      const q = search.trim().toLowerCase();
      const hay = `${o.name || ""} ${o.email || ""} ${o.parkingLot || ""}`.toLowerCase();
      return hay.includes(q);
    }),
    [flattenedOwners, search],
  );

  const openEditModal = (owner) => {
    setEditingOwner(owner);
    setEditForm({
      name: owner.name || "",
      email: owner.email || "",
      phone: owner.phone || "",
      status: owner.status || "active",
      parkingLot: owner.parkingLot && owner.parkingLot !== "Chưa gán trong CSDL" ? owner.parkingLot : "",
    });
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách chủ bãi"
        subtitle="Quản lý tài khoản chủ bãi, chỉnh sửa thông tin và phân công bãi."
        actions={<button type="button" className="btn-primary owner-btn" onClick={() => setIsCreateModalOpen(true)}>Tạo tài khoản chủ bãi</button>}
      >
        <div className="owner-table-actions" style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <input
            className="owner-search-input"
            placeholder="Tìm theo tên, email hoặc bãi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px", width: "520px", borderRadius: "6px", border: "1px solid #dcdcdc" }}
          />
        </div>

        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Chủ bãi</th>
                <th>Email</th>
                <th>Bãi quản lý</th>
                <th>Trạng thái</th>
                <th>Hiệu suất</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredOwners.map((owner) => (
                <tr key={`${owner.id}-${owner.parkingId ?? "none"}`}>
                  <td>{owner.name}</td>
                  <td>{owner.email}</td>
                  <td>{owner.parkingLot}</td>
                  <td><StatusBadge status={owner.status} /></td>
                  <td>{owner.performance}</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => openEditModal(owner)}>
                        Sửa
                      </button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.toggleOwnerStatus(owner.id, owner.status === "active" ? "suspended" : "active")}>
                        {owner.status === "active" ? "Khóa" : "Mở khóa"}
                      </button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.resetOwnerPassword(owner.id)}>Đặt lại mật khẩu</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.deleteOwner(owner.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {isCreateModalOpen ? (
        <div className="owner-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <div><h2>Tạo chủ bãi mới</h2><p>Cấp tài khoản mới cho đối tác quản lý bãi.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setIsCreateModalOpen(false)}>×</button>
            </div>
            <form
              className="owner-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!createForm.name.trim() || !createForm.email.trim()) {
                  window.alert("Vui lòng nhập tên và email.");
                  return;
                }
                await actions.addOwner({
                  name: createForm.name,
                  email: createForm.email,
                  parkingLot: createForm.parkingLot || undefined,
                  status: createForm.status || "active",
                });
                setIsCreateModalOpen(false);
                setCreateForm(EMPTY_OWNER);
              }}
            >
              <label>Tên chủ bãi<input className="owner-input" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Email<input className="owner-input" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label>Trạng thái
                <select className="owner-input owner-select" value={createForm.status} onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Hoạt động</option>
                  <option value="suspended">Tạm khóa</option>
                </select>
              </label>
              <label className="owner-form-span">Bãi quản lý<input className="owner-input" value={createForm.parkingLot} onChange={(e) => setCreateForm((p) => ({ ...p, parkingLot: e.target.value }))} /></label>
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={() => setIsCreateModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">Tạo tài khoản</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingOwner ? (
        <div className="owner-modal-backdrop" onClick={() => setEditingOwner(null)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <div><h2>Sửa thông tin chủ bãi</h2><p>Cập nhật dữ liệu owner và bãi quản lý.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setEditingOwner(null)}>×</button>
            </div>
            <form
              className="owner-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                await actions.updateOwner(editingOwner.id, {
                  name: editForm.name,
                  email: editForm.email,
                  phone: editForm.phone,
                  status: editForm.status,
                  parkingLot: editForm.parkingLot,
                });
                setEditingOwner(null);
              }}
            >
              <label>Tên chủ bãi<input className="owner-input" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Email<input className="owner-input" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label>Số điện thoại<input className="owner-input" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></label>
              <label>Trạng thái
                <select className="owner-input owner-select" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Hoạt động</option>
                  <option value="suspended">Tạm khóa</option>
                </select>
              </label>
              <label className="owner-form-span">Bãi quản lý (để trống để bỏ gán)<input className="owner-input" value={editForm.parkingLot} onChange={(e) => setEditForm((p) => ({ ...p, parkingLot: e.target.value }))} /></label>
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={() => setEditingOwner(null)}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
