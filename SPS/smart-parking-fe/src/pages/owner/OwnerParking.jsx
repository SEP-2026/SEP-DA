import { useMemo, useState } from "react";
import { SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

const EMPTY_FORM = { code: "", zone: "Khu A", level: "Tầng 1", status: "available", type: "Sedan" };

export default function OwnerParking() {
  const { ownerData, actions } = useOwnerContext();
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const zones = useMemo(() => [...new Set(ownerData.slots.map((slot) => slot.zone))], [ownerData.slots]);
  const filteredSlots = ownerData.slots.filter((slot) => {
    if (zoneFilter !== "all" && slot.zone !== zoneFilter) {
      return false;
    }
    if (statusFilter !== "all" && slot.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const openCreate = () => {
    setEditingSlot(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (slot) => {
    setEditingSlot(slot);
    setForm({
      code: slot.code,
      zone: slot.zone,
      level: slot.level,
      status: slot.status,
      type: slot.type,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSlot(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.code.trim()) {
      return;
    }
    if (editingSlot) {
      actions.updateSlot(editingSlot.id, { ...form, code: form.code.trim() });
    } else {
      actions.addSlot({ ...form, code: form.code.trim() });
    }
    closeModal();
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách chỗ đỗ"
        subtitle="Quản lý trạng thái, khu vực và phân bổ năng lực cho từng vị trí."
        actions={
          <div className="owner-toolbar">
            <select className="owner-input owner-select" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
              <option value="all">Tất cả khu vực</option>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            <select className="owner-input owner-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="available">Trống</option>
              <option value="reserved">Đã đặt</option>
              <option value="in_use">Đang sử dụng</option>
              <option value="maintenance">Bảo trì</option>
            </select>
            <button type="button" className="btn-primary owner-btn" onClick={openCreate}>Thêm chỗ đỗ</button>
          </div>
        }
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Mã chỗ</th>
                <th>Khu vực</th>
                <th>Tầng</th>
                <th>Loại xe</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlots.map((slot) => (
                <tr key={slot.id}>
                  <td>{slot.code}</td>
                  <td>{slot.zone}</td>
                  <td>{slot.level}</td>
                  <td>{slot.type}</td>
                  <td><StatusBadge status={slot.status} /></td>
                  <td>{new Date(slot.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    <div className="owner-row-actions">
                      <button type="button" className="btn-secondary owner-btn owner-btn--small" onClick={() => openEdit(slot)}>Sửa</button>
                      <button type="button" className="btn-secondary owner-btn owner-btn--small owner-btn--danger" onClick={() => actions.deleteSlot(slot.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="owner-slot-grid">
        {filteredSlots.map((slot) => (
          <article key={slot.id} className="owner-slot-card">
            <div className="owner-slot-card-head">
              <strong>{slot.code}</strong>
              <StatusBadge status={slot.status} />
            </div>
            <p>{slot.zone} • {slot.level}</p>
            <span>Dành cho {slot.type}</span>
          </article>
        ))}
      </div>

      {isModalOpen ? (
        <div className="owner-modal-backdrop" onClick={closeModal}>
          <div className="owner-modal" onClick={(event) => event.stopPropagation()}>
            <div className="owner-modal-head">
              <div>
                <h2>{editingSlot ? "Cập nhật chỗ đỗ" : "Thêm chỗ đỗ mới"}</h2>
                <p>Điền thông tin để quản lý trạng thái vận hành.</p>
              </div>
              <button type="button" className="owner-modal-close" onClick={closeModal}>×</button>
            </div>
            <form className="owner-form-grid" onSubmit={handleSubmit}>
              <label>
                Mã chỗ đỗ
                <input className="owner-input" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="VD: D-01" />
              </label>
              <label>
                Khu vực
                <select className="owner-input owner-select" value={form.zone} onChange={(event) => setForm((prev) => ({ ...prev, zone: event.target.value }))}>
                  {["Khu A", "Khu B", "Khu C", "Khu D"].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
              <label>
                Tầng
                <select className="owner-input owner-select" value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}>
                  {["Tầng 1", "Tầng 2", "Tầng 3"].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>
              <label>
                Trạng thái
                <select className="owner-input owner-select" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="available">Trống</option>
                  <option value="reserved">Đã đặt</option>
                  <option value="in_use">Đang sử dụng</option>
                  <option value="maintenance">Bảo trì</option>
                </select>
              </label>
              <label className="owner-form-span">
                Loại xe
                <input className="owner-input" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} placeholder="Sedan / SUV / EV" />
              </label>
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">{editingSlot ? "Lưu thay đổi" : "Tạo chỗ đỗ"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
