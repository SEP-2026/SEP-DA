import { useState } from "react";
import { SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useAdminContext } from "../../admin/useAdminContext";

const EMPTY_LOT = { name: "", address: "", owner: "", slotCount: 0, status: "pending", occupancy: 0 };

export default function ParkingManagement() {
  const { adminData, actions } = useAdminContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_LOT);

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách bãi đỗ"
        subtitle="Thêm, sửa, duyệt bãi mới hoặc khóa bãi nếu có vi phạm."
        actions={<button type="button" className="btn-primary owner-btn" onClick={() => setIsModalOpen(true)}>Thêm bãi đỗ</button>}
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Tên bãi</th>
                <th>Địa chỉ</th>
                <th>Owner</th>
                <th>Số slot</th>
                <th>Trạng thái</th>
                <th>Công suất</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {adminData.parkingLots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.name}</td>
                  <td>{lot.address}</td>
                  <td>{lot.owner}</td>
                  <td>{lot.slotCount}</td>
                  <td><StatusBadge status={lot.status} /></td>
                  <td>{lot.occupancy}%</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.updateParkingLot(lot.id, { status: "active" })}>Duyệt</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => actions.updateParkingLot(lot.id, { status: "locked" })}>Khóa bãi</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.deleteParkingLot(lot.id)}>Xóa</button>
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
              <div><h2>Thêm bãi đỗ</h2><p>Tạo bản ghi bãi mới trong toàn hệ thống.</p></div>
              <button type="button" className="owner-modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form className="owner-form-grid" onSubmit={async (e) => { e.preventDefault(); await actions.addParkingLot({ ...form, slotCount: Number(form.slotCount) || 0, occupancy: Number(form.occupancy) || 0 }); setIsModalOpen(false); setForm(EMPTY_LOT); }}>
              <label>Tên bãi<input className="owner-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Owner<input className="owner-input" value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} /></label>
              <label className="owner-form-span">Địa chỉ<input className="owner-input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></label>
              <label>Số slot<input className="owner-input" value={form.slotCount} onChange={(e) => setForm((p) => ({ ...p, slotCount: e.target.value }))} /></label>
              <label>Trạng thái<select className="owner-input owner-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}><option value="pending">Pending</option><option value="active">Active</option></select></label>
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">Lưu bãi đỗ</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
