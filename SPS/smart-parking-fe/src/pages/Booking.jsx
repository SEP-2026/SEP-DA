import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API, { getAuth } from "../services/api";
import "./Booking.css";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAP_SCRIPT_ID = "google-maps-script";

const formatDatetimeLocal = (date) => {
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60000);
  return localDate.toISOString().slice(0, 16);
};

const formatDateLocal = (date) => {
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60000);
  return localDate.toISOString().slice(0, 10);
};

const formatDisplayDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const addMonths = (date, months) => {
  const result = new Date(date);
  const currentDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(currentDay, maxDay));
  return result;
};

const buildBookingWindow = (form) => {
  const bookingMode = form.bookingMode || "hourly";

  if (bookingMode === "hourly") {
    const checkinDate = new Date(form.checkinTime);
    const checkoutDate = new Date(form.checkoutTime);
    if (Number.isNaN(checkinDate.getTime()) || Number.isNaN(checkoutDate.getTime())) {
      return { ok: false, error: "Thời gian booking không hợp lệ" };
    }
    if (checkoutDate <= checkinDate) {
      return { ok: false, error: "Thời gian ra phải sau thời gian vào" };
    }
    return {
      ok: true,
      bookingMode,
      checkinDate,
      checkoutDate,
      monthCount: null,
    };
  }

  if (bookingMode === "daily") {
    const startDate = parseDateValue(form.startDate);
    const endDate = parseDateValue(form.endDate);
    if (!startDate || !endDate) {
      return { ok: false, error: "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc" };
    }
    if (endDate < startDate) {
      return { ok: false, error: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu" };
    }
    const checkoutDate = new Date(endDate);
    checkoutDate.setDate(checkoutDate.getDate() + 1);
    return {
      ok: true,
      bookingMode,
      checkinDate: startDate,
      checkoutDate,
      monthCount: null,
    };
  }

  if (bookingMode === "monthly") {
    const startDate = parseDateValue(form.startDate);
    const monthCount = Number(form.monthCount);
    if (!startDate) {
      return { ok: false, error: "Vui lòng chọn ngày bắt đầu cho gói tháng" };
    }
    if (!Number.isInteger(monthCount) || monthCount < 1) {
      return { ok: false, error: "Số tháng phải là số nguyên lớn hơn hoặc bằng 1" };
    }
    return {
      ok: true,
      bookingMode,
      checkinDate: startDate,
      checkoutDate: addMonths(startDate, monthCount),
      monthCount,
    };
  }

  return { ok: false, error: "Kiểu đặt chỗ không hợp lệ" };
};

const computeEstimatedCharge = (lot, window) => {
  if (!lot || !window.ok) {
    return {
      amount: 0,
      resolvedMode: "hourly",
      billedUnits: 0,
      billedUnit: "hour",
      autoConvertedToDaily: false,
    };
  }

  const pricePerHour = Number(lot.price_per_hour || 0);
  const pricePerDay = Number(lot.price_per_day || 0);
  const pricePerMonth = Number(lot.price_per_month || 0);
  const durationHours = (window.checkoutDate.getTime() - window.checkinDate.getTime()) / (1000 * 60 * 60);

  if (window.bookingMode === "monthly") {
    const billedUnits = Number(window.monthCount || 1);
    return {
      amount: Math.round(billedUnits * pricePerMonth),
      resolvedMode: "monthly",
      billedUnits,
      billedUnit: "tháng",
      autoConvertedToDaily: false,
    };
  }

  if (window.bookingMode === "daily") {
    const billedUnits = Math.max(1, Math.ceil(durationHours / 24));
    return {
      amount: Math.round(billedUnits * pricePerDay),
      resolvedMode: "daily",
      billedUnits,
      billedUnit: "ngày",
      autoConvertedToDaily: false,
    };
  }

  if (durationHours > 12) {
    const billedUnits = 1;
    return {
      amount: Math.round(billedUnits * pricePerDay),
      resolvedMode: "daily",
      billedUnits,
      billedUnit: "ngày",
      autoConvertedToDaily: true,
    };
  }

  const billedUnits = Math.max(1, Math.ceil(durationHours));
  return {
    amount: Math.round(billedUnits * pricePerHour),
    resolvedMode: "hourly",
    billedUnits,
    billedUnit: "giờ",
    autoConvertedToDaily: false,
  };
};

const BOOKING_MODE_OPTIONS = [
  {
    value: "hourly",
    label: "Theo giờ",
    description: "Chọn giờ vào và giờ ra",
  },
  {
    value: "daily",
    label: "Theo ngày",
    description: "Chọn ngày bắt đầu và ngày kết thúc",
  },
  {
    value: "monthly",
    label: "Theo tháng",
    description: "Chọn ngày bắt đầu và số tháng",
  },
];

const buildDefaultBookingForm = (ownerName = "") => {
  const now = Date.now();
  const startDate = new Date(now + 24 * 60 * 60 * 1000);
  const endDate = new Date(now + 2 * 24 * 60 * 60 * 1000);
  return {
    ownerName,
    licensePlate: "",
    vehicleType: "vf4",
    seats: "4 chỗ",
    brand: "",
    bookingMode: "hourly",
    checkinTime: formatDatetimeLocal(new Date(now + 60 * 60 * 1000)),
    checkoutTime: formatDatetimeLocal(new Date(now + 2 * 60 * 60 * 1000)),
    startDate: formatDateLocal(startDate),
    endDate: formatDateLocal(endDate),
    monthCount: 1,
  };
};

const loadGoogleMapsScript = () => {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Thiếu VITE_GOOGLE_MAPS_API_KEY"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google.maps));
      existingScript.addEventListener("error", () => reject(new Error("Không tải được Google Maps")));
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Không tải được Google Maps"));
    document.head.appendChild(script);
  });
};

export default function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();
  const [address, setAddress] = useState("");
  const [sortBy, setSortBy] = useState("nearest");
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [searching, setSearching] = useState(false);
  const [mapError, setMapError] = useState("");
  const [error, setError] = useState("");
  const [selectedLot, setSelectedLot] = useState(location.state?.selectedLot || null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingForm, setBookingForm] = useState(() => buildDefaultBookingForm(auth?.user?.name || ""));
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const bookingSectionRef = useRef(null);
  const bookingWindow = useMemo(() => buildBookingWindow(bookingForm), [bookingForm]);
  const estimatedCharge = useMemo(
    () => computeEstimatedCharge(selectedLot, bookingWindow),
    [selectedLot, bookingWindow],
  );
  const bookingRangePreview = useMemo(() => {
    if (!bookingWindow.ok) {
      return null;
    }

    return {
      start: formatDisplayDate(bookingWindow.checkinDate),
      end: formatDisplayDate(bookingWindow.checkoutDate),
    };
  }, [bookingWindow]);

  const normalizeError = (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first === "string") {
        return first;
      }
      if (first?.msg) {
        return first.msg;
      }
    }
    return err?.response?.data?.error || "Đặt chỗ thất bại";
  };

  const applySearchResult = (payload) => {
    setNearby(payload.nearest || []);
    setSearchMeta(payload.center || null);
  };

  useEffect(() => {
    setSelectedLot(location.state?.selectedLot || null);
  }, [location.state]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedLot?.id) {
        setAvailableSlots([]);
        setSelectedSlotId("");
        setBookingResult(null);
        return;
      }

      try {
        setError("");
        setSelectedSlotId("");
        const res = await API.get("/slots", {
          params: { parking_id: selectedLot.id },
        });
        const filteredSlots = (res.data || []).filter((slot) => slot.status === "available");
        setAvailableSlots(filteredSlots);
        setSelectedSlotId(String(filteredSlots[0]?.id || ""));
        setBookingResult(null);
      } catch (err) {
        setAvailableSlots([]);
        setSelectedSlotId("");
        setError(normalizeError(err));
      }
    };

    loadSlots();
  }, [selectedLot]);

  useEffect(() => {
    if (selectedLot?.id) {
      bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedLot]);

  useEffect(() => {
    if (!selectedLot) {
      setBookingResult(null);
      setBookingForm(buildDefaultBookingForm(auth?.user?.name || ""));
    }
  }, [auth?.user?.name, selectedLot]);

  const handleSearchNearby = async () => {
    if (!address.trim()) {
      setError("Vui lòng nhập địa điểm cần tìm bãi xe");
      return;
    }

    try {
      setError("");
      setSearching(true);
      const res = await API.get("/search-parking", {
        params: {
          address: address.trim(),
          limit: 5,
          sort_by: sortBy,
          covered_only: coveredOnly,
        },
      });
      applySearchResult(res.data);
    } catch (err) {
      setNearby([]);
      setSearchMeta(null);
      setError(normalizeError(err));
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ lấy vị trí hiện tại");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setError("");
          setSearching(true);
          const res = await API.get("/search-parking-by-coords", {
            params: {
              lat: coords.latitude,
              lng: coords.longitude,
              limit: 5,
              sort_by: sortBy,
              covered_only: coveredOnly,
            },
          });
          applySearchResult(res.data);
        } catch (err) {
          setNearby([]);
          setSearchMeta(null);
          setError(normalizeError(err));
        } finally {
          setSearching(false);
        }
      },
      () => {
        setError("Không thể lấy vị trí hiện tại. Vui lòng cấp quyền vị trí.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSelectLot = (lot) => {
    navigate("/booking", { state: { selectedLot: lot } });
  };

  const handleBookingModeChange = (mode) => {
    const now = new Date();
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const afterTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    setBookingForm((prev) => {
      const checkinDate = new Date(prev.checkinTime);
      const checkoutDate = new Date(prev.checkoutTime);
      const safeCheckinTime = Number.isNaN(checkinDate.getTime())
        ? formatDatetimeLocal(new Date(now.getTime() + 60 * 60 * 1000))
        : prev.checkinTime;
      const safeCheckoutTime = Number.isNaN(checkoutDate.getTime()) || checkoutDate <= checkinDate
        ? formatDatetimeLocal(afterTwoHours)
        : prev.checkoutTime;

      const startDate = prev.startDate || formatDateLocal(nextDay);
      const endDate = prev.endDate || formatDateLocal(new Date(nextDay.getTime() + 24 * 60 * 60 * 1000));

      return {
        ...prev,
        bookingMode: mode,
        checkinTime: safeCheckinTime,
        checkoutTime: safeCheckoutTime,
        startDate,
        endDate,
        monthCount: Number(prev.monthCount) > 0 ? prev.monthCount : 1,
      };
    });
  };

  const handleCreateBooking = async () => {
    if (!selectedLot) {
      setError("Vui lòng chọn bãi xe trước");
      return;
    }

    if (!selectedSlotId) {
      setError("Vui lòng chọn slot trống");
      return;
    }

    if (!bookingForm.ownerName.trim() || !bookingForm.licensePlate.trim()) {
      setError("Vui lòng nhập tên chủ xe và biển số xe");
      return;
    }

    if (!bookingWindow.ok) {
      setError(bookingWindow.error || "Thời gian booking không hợp lệ");
      return;
    }

    try {
      setError("");
      setBookingLoading(true);
      const res = await API.post("/booking/create", {
        parking_id: selectedLot.id,
        slot_id: Number(selectedSlotId),
        license_plate: bookingForm.licensePlate.trim(),
        owner_name: bookingForm.ownerName.trim(),
        vehicle_type: `${bookingForm.vehicleType.trim()} - ${bookingForm.seats.trim()}`.trim() || null,
        brand: bookingForm.brand.trim() || null,
        booking_mode: bookingWindow.bookingMode,
        month_count: bookingWindow.bookingMode === "monthly" ? bookingWindow.monthCount : null,
        checkin_time: bookingWindow.checkinDate.toISOString(),
        checkout_time: bookingWindow.checkoutDate.toISOString(),
      });
      setBookingResult(res.data);
    } catch (err) {
      setBookingResult(null);
      setError(normalizeError(err));
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    const renderMap = async () => {
      if (!mapRef.current || !searchMeta || nearby.length === 0) {
        return;
      }

      try {
        setMapError("");
        await loadGoogleMapsScript();

        const center = {
          lat: Number(searchMeta.lat),
          lng: Number(searchMeta.lng),
        };

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            zoom: 14,
            center,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }

        const map = mapInstanceRef.current;
        map.setCenter(center);

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(center);

        const userMarker = new window.google.maps.Marker({
          position: center,
          map,
          title: "Vị trí tìm kiếm",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#1976d2",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
          },
        });
        markersRef.current.push(userMarker);

        nearby.forEach((lot) => {
          const position = {
            lat: Number(lot.latitude),
            lng: Number(lot.longitude),
          };
          bounds.extend(position);

          const marker = new window.google.maps.Marker({
            position,
            map,
            title: lot.name,
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="min-width:180px">
                <strong>${lot.name}</strong><br/>
                <span>${lot.address}</span><br/>
                <span>Khoảng cách: ${lot.distance} km</span><br/>
                <span>Giá: ${Number(lot.price_per_hour).toLocaleString("vi-VN")}đ/giờ</span>
              </div>
            `,
          });

          marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
          markersRef.current.push(marker);
        });

        map.fitBounds(bounds);
      } catch {
        setMapError("Không tải được Google Maps. Hãy kiểm tra VITE_GOOGLE_MAPS_API_KEY.");
      }
    };

    renderMap();
  }, [nearby, searchMeta]);

  return (
    <section className="page-wrap">
      <div className="page-card booking-shell">
        <div className="booking-header">
          <h1 className="page-title">Tìm bãi xe gần bạn</h1>
          <p className="page-subtitle">Smart Parking Platform</p>
        </div>

        <section className="booking-search-section">
          <h2 className="booking-subtitle">Tìm bãi xe gần bạn</h2>
          <div className="booking-tools booking-tools--search">
            <input
              className="booking-input"
              placeholder="Ví dụ: Nguyễn Văn Săng, Tân Phú"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button className="btn-primary" onClick={handleSearchNearby} disabled={searching}>
              {searching ? "Đang tìm..." : "Tìm bãi xe gần bạn"}
            </button>
            <button className="btn-secondary" onClick={handleUseCurrentLocation} disabled={searching}>
              📍 Dùng vị trí hiện tại
            </button>
          </div>

          <div className="filter-row">
            <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="nearest">Gần nhất</option>
              <option value="cheapest">Giá rẻ nhất</option>
            </select>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={coveredOnly}
                onChange={(e) => setCoveredOnly(e.target.checked)}
              />
              Có mái che
            </label>
          </div>

          {searchMeta && (
            <p className="search-meta">
              Tọa độ tìm kiếm: {searchMeta.lat}, {searchMeta.lng}
            </p>
          )}

          {nearby.length > 0 && (
            <>
              <div className="nearby-map" ref={mapRef} />
              {mapError && <p className="booking-error">{mapError}</p>}

              <div className="nearby-list">
                {nearby.map((lot) => (
                  <article className="nearby-item" key={lot.id}>
                    <h3>{lot.name}</h3>
                    <p>📍 {lot.address}</p>
                    <p>📏 {lot.distance} km</p>
                    <p>🏠 {lot.has_roof ? "Có mái che" : "Không mái che"}</p>
                    <p>💰 {Number(lot.price_per_hour).toLocaleString("vi-VN")}đ/giờ</p>
                    <p>💵 {Number(lot.price_per_day).toLocaleString("vi-VN")}đ/ngày - {Number(lot.price_per_month).toLocaleString("vi-VN")}đ/tháng</p>
                    <div className="lot-actions">
                      <button className="btn-secondary" onClick={() => handleSelectLot(lot)}>
                        Chọn bãi xe này
                      </button>
                      <button className="btn-primary" onClick={() => handleSelectLot(lot)}>
                        Đặt ngay
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {selectedLot && (
          <section className="booking-search-section booking-form-section" ref={bookingSectionRef}>
            <div className="booking-form-headline">
              <h2>ĐẶT BÃI XE ĐÃ CHỌN</h2>
            </div>

            <div className="selected-lot-card selected-lot-card--modern">
              <h3>Thông tin bãi đỗ xe</h3>
              <p><strong>Bãi xe:</strong> {selectedLot.name}</p>
              <p><strong>Địa chỉ:</strong> {selectedLot.address}</p>
              <div className="selected-lot-meta">
                <span>📍 Khoảng cách: {selectedLot.distance} km</span>
                <span>✅ Slot trống: {availableSlots.length}</span>
              </div>
            </div>

            <div className="booking-form-sheet">
              <h3>Chi tiết đặt chỗ</h3>

              <div className="booking-form-grid booking-form-grid--two">
                <div className="field-wrap">
                  <label>Người đặt (Booking Name)</label>
                  <input
                    className="booking-input"
                    placeholder="Nhập tên người đặt"
                    value={bookingForm.ownerName}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, ownerName: e.target.value }))}
                  />
                </div>
                <div className="field-wrap">
                  <label>Biển số (License Plate)</label>
                  <input
                    className="booking-input"
                    placeholder="Nhập biển số xe"
                    value={bookingForm.licensePlate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, licensePlate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="booking-form-grid booking-form-grid--three">
                <div className="field-wrap">
                  <label>Thương hiệu (Brand)</label>
                  <input
                    className="booking-input"
                    placeholder="Ví dụ: Vinfast"
                    value={bookingForm.brand}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, brand: e.target.value }))}
                  />
                </div>
                <div className="field-wrap">
                  <label>Dòng xe (Model)</label>
                  <input
                    className="booking-input"
                    placeholder="Ví dụ: vf4"
                    value={bookingForm.vehicleType}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
                  />
                </div>
                <div className="field-wrap">
                  <label>Số chỗ (Seats)</label>
                  <input
                    className="booking-input"
                    placeholder="Ví dụ: 4 chỗ"
                    value={bookingForm.seats}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, seats: e.target.value }))}
                  />
                </div>
              </div>

              <div className="booking-form-grid booking-form-grid--three">
                <div className="field-wrap">
                  <label>Vị trí mong muốn (Preferred Slot)</label>
                  <select
                    className="booking-input booking-slot-select"
                    value={selectedSlotId}
                    onChange={(e) => setSelectedSlotId(e.target.value)}
                  >
                    <option value="">Chọn slot trống</option>
                    {availableSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.code} {slot.slot_number ? `- ${slot.slot_number}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-wrap">
                  <label>Hình thức đặt chỗ (Booking Mode)</label>
                  <div className="booking-mode-switch" role="radiogroup" aria-label="Chọn hình thức đặt chỗ">
                    {BOOKING_MODE_OPTIONS.map((modeOption) => (
                      <button
                        key={modeOption.value}
                        type="button"
                        className={`booking-mode-pill ${bookingForm.bookingMode === modeOption.value ? "is-active" : ""}`}
                        role="radio"
                        aria-checked={bookingForm.bookingMode === modeOption.value}
                        onClick={() => handleBookingModeChange(modeOption.value)}
                      >
                        <span>{modeOption.label}</span>
                        <small>{modeOption.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field-wrap booking-price-note">
                  <label>Đơn giá</label>
                  <p>
                    {Number(selectedLot.price_per_hour).toLocaleString("vi-VN")}đ/giờ | {" "}
                    {Number(selectedLot.price_per_day).toLocaleString("vi-VN")}đ/ngày | {" "}
                    {Number(selectedLot.price_per_month).toLocaleString("vi-VN")}đ/tháng
                  </p>
                </div>
              </div>

              {bookingForm.bookingMode === "hourly" && (
                <div className="booking-form-grid booking-form-grid--two">
                  <div className="field-wrap">
                    <label>Thời gian vào (Check-in Time)</label>
                    <input
                      className="booking-input"
                      type="datetime-local"
                      value={bookingForm.checkinTime}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, checkinTime: e.target.value }))}
                    />
                  </div>
                  <div className="field-wrap">
                    <label>Thời gian ra (Check-out Time)</label>
                    <input
                      className="booking-input"
                      type="datetime-local"
                      value={bookingForm.checkoutTime}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, checkoutTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {bookingForm.bookingMode === "daily" && (
                <div className="booking-form-grid booking-form-grid--two">
                  <div className="field-wrap">
                    <label>Đặt từ ngày</label>
                    <input
                      className="booking-input"
                      type="date"
                      value={bookingForm.startDate}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="field-wrap">
                    <label>Đặt đến ngày</label>
                    <input
                      className="booking-input"
                      type="date"
                      value={bookingForm.endDate}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {bookingForm.bookingMode === "monthly" && (
                <div className="booking-form-grid booking-form-grid--two">
                  <div className="field-wrap">
                    <label>Bắt đầu từ ngày</label>
                    <input
                      className="booking-input"
                      type="date"
                      value={bookingForm.startDate}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="field-wrap">
                    <label>Số tháng đặt chỗ</label>
                    <input
                      className="booking-input"
                      type="number"
                      min={1}
                      max={24}
                      value={bookingForm.monthCount}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, monthCount: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="booking-estimate-box">
                {!bookingWindow.ok && <p className="booking-error">{bookingWindow.error}</p>}
                {bookingWindow.ok && (
                  <>
                    <p>
                      Từ {bookingRangePreview.start} đến {bookingRangePreview.end}
                    </p>
                    <p>
                      Dự kiến tính phí: {estimatedCharge.billedUnits} {estimatedCharge.billedUnit} ({estimatedCharge.resolvedMode})
                    </p>
                    {estimatedCharge.autoConvertedToDaily && (
                      <p className="booking-estimate-note">
                        Booking theo giờ nhưng lớn hơn 12 giờ nên hệ thống tự động tính theo ngày.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="lot-actions center-actions">
              <button className="btn-primary btn-primary-wide" onClick={handleCreateBooking} disabled={bookingLoading}>
                {bookingLoading
                  ? "Đang tạo booking..."
                  : `XÁC NHẬN BOOKING (${estimatedCharge.amount.toLocaleString("vi-VN")} đ)`}
              </button>
            </div>

            {bookingResult && (
              <div className="booking-result">
                <p>{bookingResult.message}</p>
                <p><strong>Booking ID:</strong> {bookingResult.booking_id}</p>
                <p><strong>Slot:</strong> {bookingResult.slot?.code}</p>
                <p><strong>Xe:</strong> {bookingResult.vehicle?.license_plate}</p>
                <p><strong>Kiểu tính phí:</strong> {bookingResult.billing?.resolved_mode}</p>
                <p><strong>Tổng tiền:</strong> {Number(bookingResult.total_amount || 0).toLocaleString("vi-VN")}đ</p>
                <div className="qr-box">
                  <img src={`http://localhost:8000/${bookingResult.qr_code}`} alt="Mã QR đặt chỗ" />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
