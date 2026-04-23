import { useEffect, useMemo, useState } from "react";

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainSeconds = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainSeconds}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export default function CountdownTimer({ expectedCheckout, pricePerHour = 0 }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expectedMs = useMemo(() => new Date(expectedCheckout).getTime(), [expectedCheckout]);
  if (!expectedMs || Number.isNaN(expectedMs)) {
    return null;
  }

  const diffSeconds = Math.floor((expectedMs - now) / 1000);
  const isOverstay = diffSeconds < 0;
  const overstaySeconds = Math.abs(diffSeconds);
  const overstayHoursBilled = isOverstay ? Math.ceil(overstaySeconds / 3600) : 0;
  const estimatedFee = overstayHoursBilled * Number(pricePerHour || 0);

  return (
    <div className={`countdown-widget ${isOverstay ? "is-overstay" : ""}`}>
      {isOverstay ? (
        <>
          <p>+{formatClock(overstaySeconds)} đã quá giờ</p>
          <small>Phí dự kiến thêm: ~{formatMoney(estimatedFee)}đ ({overstayHoursBilled} giờ)</small>
        </>
      ) : (
        <p>Còn lại {formatClock(diffSeconds)}</p>
      )}
    </div>
  );
}
