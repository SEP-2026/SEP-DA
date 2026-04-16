import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "./Scan.css";

function formatDateTime(value) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
}

function parseScanValue(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { bookingId: null, payload: null, error: "" };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      bookingId: Number(trimmed),
      payload: null,
      error: "",
    };
  }

  try {
    const payload = JSON.parse(trimmed);
    const bookingId = Number(payload?.booking_id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return {
        bookingId: null,
        payload: null,
        error: "QR hợp lệ nhưng không có booking_id khả dụng.",
      };
    }

    return {
      bookingId,
      payload,
      error: "",
    };
  } catch {
    return {
      bookingId: null,
      payload: null,
      error: "Không đọc được dữ liệu. Hãy quét QR để lấy nội dung JSON hoặc nhập Booking ID.",
    };
  }
}

export default function Scan() {
  const [scanValue, setScanValue] = useState("");
  const [submitting, setSubmitting] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);

  const parsedScan = useMemo(() => parseScanValue(scanValue), [scanValue]);

  useEffect(() => {
    const bookingId = parsedScan.bookingId;

    if (!bookingId) {
      setBookingDetail(null);
      setDetailError("");
      setLoadingDetail(false);
      return;
    }

    let active = true;
    setLoadingDetail(true);
    setDetailError("");

    API.get(`/booking/gate/${bookingId}`)
      .then((response) => {
        if (!active) {
          return;
        }
        setBookingDetail(response.data);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setBookingDetail(null);
        setDetailError(err?.response?.data?.detail || "Không tải được thông tin booking.");
      })
      .finally(() => {
        if (active) {
          setLoadingDetail(false);
        }
      });

    return () => {
      active = false;
    };
  }, [parsedScan.bookingId]);

  const runGateAction = async (action) => {
    if (!parsedScan.bookingId) {
      setFeedback({
        type: "error",
        title: "Thiếu mã booking",
        message: parsedScan.error || "Vui lòng quét QR hoặc nhập Booking ID trước khi thao tác.",
      });
      return;
    }

    setSubmitting(action);
    setFeedback(null);

    try {
      const endpoint = action === "checkin" ? "/check-in" : "/check-out";
      const response = await API.post(endpoint, null, {
        params: { booking_id: parsedScan.bookingId },
      });

      setFeedback({
        type: "success",
        title: action === "checkin" ? "Xe đã vào bãi" : "Xe đã ra bãi",
        message:
          action === "checkin"
            ? response.data.message || "Check-in thành công."
            : `${response.data.message || "Check-out thành công."}${
                response.data.total_paid ? ` Tổng thu: ${Number(response.data.total_paid).toLocaleString("vi-VN")}đ.` : ""
              }`,
        meta: response.data,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: action === "checkin" ? "Không thể cho xe vào" : "Không thể cho xe ra",
        message: err?.response?.data?.detail || "Thao tác thất bại.",
      });
    } finally {
      setSubmitting("");
    }
  };

  return (
    <section className="page-wrap">
      <div className="page-card scan-page">
        <div className="scan-hero">
          <div>
            <p className="scan-eyebrow">SCAN GATE</p>
            <h1 className="page-title scan-title">Cổng quét QR vào / ra bãi</h1>
            <p className="scan-subtitle">
              Dùng cho nhân viên cổng hoặc chủ bãi. Hệ thống nhận nội dung QR booking hoặc Booking ID để xử lý check-in, check-out.
            </p>
          </div>

          <div className="scan-hero-badge">
            <strong>Nhận diện</strong>
            <span>QR booking</span>
            <span>Booking ID</span>
          </div>
        </div>

        <div className="scan-grid">
          <section className="scan-panel scan-panel--primary">
            <div className="scan-frame">
              <div className="scan-frame-corners" />
              <div className="scan-frame-content">
                <strong>Vùng quét QR</strong>
                <span>
                  Dùng máy quét hoặc camera để đổ nội dung vào ô bên dưới. Nếu thiết bị chỉ trả về `booking_id`, hệ thống vẫn xử lý được.
                </span>
              </div>
            </div>

            <label className="scan-field">
              <span>Nội dung quét</span>
              <textarea
                className="scan-input scan-textarea"
                rows={5}
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                placeholder='Ví dụ: {"qr_type":"parking_access","booking_id":12,...} hoặc chỉ nhập 12'
              />
            </label>

            <div className="scan-actions">
              <button
                type="button"
                className="btn-checkin"
                onClick={() => runGateAction("checkin")}
                disabled={!parsedScan.bookingId || submitting !== ""}
              >
                {submitting === "checkin" ? "Đang xử lý..." : "Cho xe vào bãi"}
              </button>
              <button
                type="button"
                className="btn-checkout"
                onClick={() => runGateAction("checkout")}
                disabled={!parsedScan.bookingId || submitting !== ""}
              >
                {submitting === "checkout" ? "Đang xử lý..." : "Cho xe ra bãi"}
              </button>
            </div>

            <p className="scan-hint">
              Khi QR hợp lệ, hệ thống sẽ lấy `booking_id` từ payload. Nếu quét không ra JSON, bạn có thể nhập trực tiếp Booking ID để xử lý thủ công.
            </p>
          </section>

          <section className="scan-panel">
            <div className="scan-summary">
              <h2>Thông tin quét</h2>
              <div className="scan-summary-list">
                <div>
                  <span>Booking ID</span>
                  <strong>{bookingDetail?.booking_id || parsedScan.bookingId || "--"}</strong>
                </div>
                <div>
                  <span>Loại QR</span>
                  <strong>{parsedScan.payload?.qr_type || "--"}</strong>
                </div>
                <div>
                  <span>Bãi đỗ</span>
                  <strong>{bookingDetail?.parking?.name || parsedScan.payload?.parking_id || "--"}</strong>
                </div>
                <div>
                  <span>Vị trí</span>
                  <strong>{bookingDetail?.slot?.code || parsedScan.payload?.slot_id || "--"}</strong>
                </div>
                <div>
                  <span>Biển số</span>
                  <strong>{bookingDetail?.vehicle?.license_plate || parsedScan.payload?.license_plate || "--"}</strong>
                </div>
                <div>
                  <span>Khung giờ</span>
                  <strong>
                    {bookingDetail
                      ? `${formatDateTime(bookingDetail.checkin_time)} - ${formatDateTime(bookingDetail.checkout_time)}`
                      : parsedScan.payload
                        ? `${formatDateTime(parsedScan.payload.checkin_time)} - ${formatDateTime(parsedScan.payload.checkout_time)}`
                        : "--"}
                  </strong>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <strong>{bookingDetail?.booking_status || "--"}</strong>
                </div>
                <div>
                  <span>Chủ xe</span>
                  <strong>{bookingDetail?.vehicle?.owner_name || "--"}</strong>
                </div>
              </div>
            </div>

            {loadingDetail ? (
              <div className="scan-feedback scan-feedback--neutral">
                <strong>Đang tải dữ liệu booking</strong>
                <p>Hệ thống đang lấy thông tin thật từ backend để đối chiếu tại cổng.</p>
              </div>
            ) : null}

            {detailError ? (
              <div className="scan-feedback scan-feedback--error">
                <strong>Không lấy được thông tin booking</strong>
                <p>{detailError}</p>
              </div>
            ) : null}

            {parsedScan.error ? (
              <div className="scan-feedback scan-feedback--error">
                <strong>Dữ liệu chưa hợp lệ</strong>
                <p>{parsedScan.error}</p>
              </div>
            ) : null}

            {feedback ? (
              <div className={`scan-feedback scan-feedback--${feedback.type}`}>
                <strong>{feedback.title}</strong>
                <p>{feedback.message}</p>
                {feedback.meta?.overtime_fee ? (
                  <p>Phụ thu quá giờ: {Number(feedback.meta.overtime_fee).toLocaleString("vi-VN")}đ</p>
                ) : null}
              </div>
            ) : (
              <div className="scan-feedback scan-feedback--neutral">
                <strong>Sẵn sàng xử lý</strong>
                <p>Quét mã của khách tại cổng để kiểm tra và thao tác nhanh. Màn này dùng cho vận hành cổng, không phải form nhập booking thủ công đơn giản.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
