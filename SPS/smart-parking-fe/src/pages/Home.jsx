import { useEffect, useState } from "react";
import API from "../services/api";
import "./Home.css";

export default function Home() {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    API.get("/slots").then((res) => {
      const sortedSlots = [...res.data].sort((a, b) =>
        String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
      );
      setSlots(sortedSlots);
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

        <div className="parking-grid">
        {slots.map((slot) => (
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
              <div className="slot-badge">{slot.code}</div>
            </article>
        ))}
        </div>
      </div>
    </section>
  );
}
