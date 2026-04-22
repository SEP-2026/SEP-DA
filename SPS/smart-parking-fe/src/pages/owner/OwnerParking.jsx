import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";
import { parseVietnamDate } from "../../utils/dateTime";

const EMPTY_FORM = { parkingId: null, code: "", zone: "", level: "", status: "available" };

function buildLotSummary(slots) {
  return {
    total: slots.length,
    available: slots.filter((slot) => slot.status === "available").length,
    occupied: slots.filter((slot) => slot.status === "reserved" || slot.status === "in_use").length,
    maintenance: slots.filter((slot) => slot.status === "maintenance").length,
  };
}

export default function OwnerParking() {
  const { ownerData, actions, isSyncing } = useOwnerContext();
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedLots, setExpandedLots] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const zones = useMemo(() => [...new Set(ownerData.slots.map((slot) => slot.zone))], [ownerData.slots]);
  const filteredSlots = useMemo(() => ownerData.slots.filter((slot) => {
    if (zoneFilter !== "all" && slot.zone !== zoneFilter) {
      return false;
    }
    if (statusFilter !== "all" && slot.status !== statusFilter) {
      return false;
    }
    return true;
  }), [ownerData.slots, statusFilter, zoneFilter]);

  const lots = useMemo(() => {
    const lotMap = new Map();

    ownerData.parkingLots?.forEach((lot) => {
      lotMap.set(lot.id, {
        id: lot.id,
        name: lot.name,
        address: lot.address,
        district: lot.district,
        slots: [],
      });
    });

    filteredSlots.forEach((slot) => {
      const key = slot.parkingLotId || `unknown-${slot.parkingLotName}`;
      if (!lotMap.has(key)) {
        lotMap.set(key, {
          id: slot.parkingLotId || null,
          name: slot.parkingLotName || "Chưa có bãi",
          address: "",
          district: "",
          slots: [],
        });
      }
      lotMap.get(key).slots.push(slot);
    });

    return Array.from(lotMap.values())
      .filter((lot) => lot.slots.length > 0 || !zoneFilter || statusFilter === "all")
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }, [filteredSlots, ownerData.parkingLots, statusFilter, zoneFilter]);

  const openCreate = (lot) => {
    setEditingSlot(null);
    setForm({
      parkingId: lot.id,
      code: "",
      zone: "",
      level: "",
      status: "available",
    });
    setIsModalOpen(true);
  };

  const openEdit = (slot) => {
    setEditingSlot(slot);
    setForm({
      parkingId: slot.parkingLotId || null,
      code: slot.code,
      zone: slot.zone || "",
      level: slot.level || "",
      status: slot.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSlot(null);
    setForm(EMPTY_FORM);
  };

  const toggleLot = (lotId) => {
    setExpandedLots((prev) => ({
      ...prev,
      [lotId]: !prev[lotId],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.code.trim() || !form.zone.trim() || !form.level.trim()) {
      return;
    }
    if (editingSlot) {
      actions.updateSlot(editingSlot.id, {
        code: form.code.trim(),
        zone: form.zone.trim(),
        level: form.level.trim(),
        status: form.status,
      });
    } else if (form.parkingId) {
      actions.addSlot({
        parkingId: form.parkingId,
        code: form.code.trim(),
        zone: form.zone.trim(),
        level: form.level.trim(),
        status: form.status,
      });
    }
    closeModal();
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách chỗ đỗ"
        subtitle="Quản lý trạng thái từng chỗ theo từng bãi bằng dữ liệu thật từ CSDL cho toàn bộ bãi owner đang phụ trách."
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
          </div>
        }
      >
        {isSyncing ? <p className="owner-empty">Đang đồng bộ chỗ đỗ từ CSDL...</p> : null}
        {!isSyncing && lots.length === 0 ? <p className="owner-empty">Không có bãi nào khớp bộ lọc hiện tại.</p> : null}

        <div className="owner-lot-list">
          {lots.map((lot) => {
            const isExpanded = Boolean(expandedLots[lot.id ?? lot.name]);
            const summary = buildLotSummary(lot.slots);

            return (
              <article key={lot.id ?? lot.name} className="owner-lot-card">
                <div className="owner-lot-summary">
                  <div className="owner-lot-summary-main">
                    <div>
                      <h3>{lot.name}</h3>
                      <p>{lot.address || "Chưa có địa chỉ"}{lot.district ? ` • ${lot.district}` : ""}</p>
                    </div>
                    <div className="owner-lot-summary-badges">
                      <span className="owner-summary-pill owner-summary-pill--success">Trống: {summary.available}</span>
                      <span className="owner-summary-pill owner-summary-pill--danger">Giữ/Đã có xe: {summary.occupied}</span>
                      <span className="owner-summary-pill owner-summary-pill--neutral">Tổng: {summary.total}</span>
                      {summary.maintenance > 0 ? <span className="owner-summary-pill owner-summary-pill--warning">Bảo trì: {summary.maintenance}</span> : null}
                    </div>
                  </div>
                  <div className="owner-lot-summary-actions">
                    {lot.id ? <button type="button" className="btn-primary owner-btn owner-btn--small" onClick={() => openCreate(lot)}>Thêm chỗ đỗ</button> : null}
                    <button type="button" className={`owner-lot-toggle${isExpanded ? " is-open" : ""}`} onClick={() => toggleLot(lot.id ?? lot.name)}>+</button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="owner-lot-detail">
                    <div className="owner-table-shell">
                      <table className="owner-table">
                        <thead>
                          <tr>
                            <th>Mã chỗ</th>
                            <th>Khu vực</th>
                            <th>Tầng</th>
                            <th>Trạng thái</th>
                            <th>Cập nhật</th>
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lot.slots.map((slot) => (
                            <tr key={slot.id}>
                              <td>{slot.code}</td>
                              <td>{slot.zone}</td>
                              <td>{slot.level}</td>
                              <td><StatusBadge status={slot.status} /></td>
                              <td>{parseVietnamDate(slot.updatedAt)?.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) || "--"}</td>
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
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </SectionCard>

      {isModalOpen ? createPortal(
        <div className="owner-modal-backdrop" onClick={closeModal}>
          <div className="owner-modal" onClick={(event) => event.stopPropagation()}>
            <div className="owner-modal-head">
              <div>
                <h2>{editingSlot ? "Cập nhật chỗ đỗ" : "Thêm chỗ đỗ mới"}</h2>
                <p>Quản lý trực tiếp mã chỗ và trạng thái vận hành từ CSDL.</p>
              </div>
              <button type="button" className="owner-modal-close" onClick={closeModal}>×</button>
            </div>
            <form className="owner-form-grid" onSubmit={handleSubmit}>
              <label>
                Mã chỗ đỗ
                <input className="owner-input" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="VD: A11" />
              </label>
              <label>
                Khu vực
                <input className="owner-input" value={form.zone} onChange={(event) => setForm((prev) => ({ ...prev, zone: event.target.value }))} placeholder="VD: Khu A" />
              </label>
              <label>
                Tầng
                <input className="owner-input" value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))} placeholder="VD: Tầng 1" />
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
              <div className="owner-modal-actions">
                <button type="button" className="btn-secondary owner-btn" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn-primary owner-btn">{editingSlot ? "Lưu thay đổi" : "Tạo chỗ đỗ"}</button>
              </div>
            </form>
          </div>
        </div>
      , document.body) : null}
    </div>
  );
}
