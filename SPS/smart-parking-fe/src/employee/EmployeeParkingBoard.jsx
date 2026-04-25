import "../pages/Home.css";

function formatStatusLabel(status) {
  const mapping = {
    available: "Trống",
    reserved: "Giữ chỗ",
    in_use: "Đã có xe",
    occupied: "Đã có xe",
    maintenance: "Bảo trì",
  };
  return mapping[status] || status || "Không rõ";
}

export default function EmployeeParkingBoard({ slotsOverview, title = "Sơ đồ bãi xe" }) {
  const slots = Array.isArray(slotsOverview?.slots) ? slotsOverview.slots : [];
  const total = Number(slotsOverview?.total_slots || 0);
  const available = Number(slotsOverview?.available_slots || 0);
  const occupied = Number(slotsOverview?.in_use_slots || 0) + Number(slotsOverview?.reserved_slots || 0);

  return (
    <section className="parking-lot-card employee-parking-board">
      <div className="parking-lot-head employee-parking-board-head">
        <div>
          <h2 className="parking-lot-name">{slotsOverview?.parking_name || title}</h2>
          <p className="parking-lot-address">{title}</p>
        </div>
        <div className="parking-lot-stats">
          <span className="stat-chip stat-available">Trống: {available}</span>
          <span className="stat-chip stat-occupied">Giữ/Đã có xe: {occupied}</span>
          <span className="stat-chip stat-total">Tổng: {total}</span>
        </div>
      </div>

      <div className="parking-grid">
        {slots.map((slot) => {
          const isAvailable = slot.status === "available";
          return (
            <article key={slot.id} className="slot-card">
              <div className="slot-lane" />
              <div className={`slot-car ${isAvailable ? "slot-available" : "slot-occupied"}`}>
                <img
                  src={isAvailable ? "/car-top-view2.png" : "/car-top-view.png"}
                  alt={isAvailable ? "Vị trí trống" : "Vị trí đã có xe"}
                  className="car-image"
                />
              </div>
              <div className="slot-badge">{slot.code} - {formatStatusLabel(slot.status)}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
