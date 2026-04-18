import { useEffect, useState } from "react";
import API from "../services/api";
import "./Home.css";

export default function Home() {
  const [parkingLots, setParkingLots] = useState([]);

  useEffect(() => {
    API.get("/parking-lots/slots-overview").then((res) => {
      const normalizedLots = (res.data || []).map((lot) => ({
        ...lot,
        slots: [...(lot.slots || [])].sort((a, b) =>
          String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
        ),
      }));

      setParkingLots(normalizedLots);
    });
  }, []);

  return (
    <section className="page-wrap parking-home">
      <div className="page-card parking-board">
        <h1 className="parking-title">Danh sách bãi xe</h1>

        <div className="parking-legend">
          <div className="legend-item">
            <span className="legend-car legend-available">🚗</span>
            <span>Vị trí trống</span>
          </div>
          <div className="legend-item">
            <span className="legend-car legend-occupied">🚗</span>
            <span>Vị trí đã có xe</span>
          </div>
        </div>

        <div className="parking-lot-list">
          {parkingLots.map((lot) => (
            <section key={lot.parking_id} className="parking-lot-card">
              <header className="parking-lot-head">
                <div>
                  <h2 className="parking-lot-name">{lot.parking_name}</h2>
                  <p className="parking-lot-address">{lot.parking_address}</p>
                  {lot.district && <p className="parking-lot-district">{lot.district}</p>}
                </div>
                <div className="parking-lot-stats">
                  <span className="stat-chip stat-available">Trống: {lot.available_slots}</span>
                  <span className="stat-chip stat-occupied">Giữ/Đã có xe: {lot.occupied_or_reserved_slots}</span>
                  <span className="stat-chip stat-total">Tổng: {lot.total_slots}</span>
                </div>
              </header>

              <div className="parking-grid">
                {lot.slots.map((slot) => (
                  <article key={slot.id} className="slot-card">
                    <div className="slot-lane" />
                    <div
                      className={`slot-car ${slot.status === "available" ? "slot-available" : "slot-occupied"}`}
                    >
                      <img
                        src={slot.status === "available" ? "/car-top-view2.png" : "/car-top-view.png"}
                        alt={slot.status === "available" ? "Xe nhìn từ trên xuống - vị trí trống" : "Xe nhìn từ trên xuống - vị trí đã có xe"}
                        className="car-image"
                      />
                    </div>
                    <div className="slot-badge">{slot.code} - {slot.status === "available" ? "Trống" : "Giữ chỗ"}</div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
