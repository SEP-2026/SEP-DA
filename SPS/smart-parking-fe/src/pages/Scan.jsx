import { useEffect, useMemo, useRef, useState } from "react";

import ActionButtons from "../features/gate/ActionButtons";
import BookingInfoPanel from "../features/gate/BookingInfoPanel";
import PaymentPanel from "../features/gate/PaymentPanel";
import ScanZone from "../features/gate/ScanZone";
import StatusBanner from "../features/gate/StatusBanner";
import { checkInGate, checkOutGate, getGateBooking, resolveGateScan } from "../features/gate/gateService";
import { formatCurrency } from "../features/gate/gateFormatters";
import { inferQrPreview, parseManualBookingId } from "../features/gate/scanParser";
import { getBannerTone } from "../features/gate/statusLabel";
import "./Scan.css";

function buildBannerFromError(error, fallbackTitle) {
  return {
    title: fallbackTitle,
    message: error?.response?.data?.detail || "Không thể kết nối tới hệ thống cổng.",
  };
}

export default function Scan() {
  const scanInputRef = useRef(null);
  const [gateId, setGateId] = useState("GATE-A1");
  const [scanValue, setScanValue] = useState("");
  const [manualBookingId, setManualBookingId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [uiState, setUiState] = useState("idle");
  const [banner, setBanner] = useState({
    title: "Sẵn sàng xử lý",
    message: "Quét QR để tự động xử lý hoặc nhập mã booking để xem thông tin rồi thao tác thủ công.",
  });
  const [booking, setBooking] = useState(null);

  const qrPreview = useMemo(() => inferQrPreview(scanValue), [scanValue]);
  const manualPreview = useMemo(() => parseManualBookingId(manualBookingId), [manualBookingId]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const applyBookingPayload = (payload, nextBanner, nextUiState = "booking_loaded") => {
    setBooking(payload?.booking || payload || null);
    setBanner(nextBanner);
    setUiState(nextUiState);
  };

  const handleResolveManual = async () => {
    if (!gateId.trim()) {
      setUiState("error");
      setBanner({ title: "Thiếu mã cổng", message: "Vui lòng nhập mã cổng trước khi xem thông tin booking." });
      return;
    }
    if (!manualPreview.bookingId) {
      setUiState("error");
      setBanner({ title: "Mã booking không hợp lệ", message: manualPreview.error || "Vui lòng nhập mã booking hợp lệ." });
      return;
    }

    setBanner({ title: "Đang tải dữ liệu...", message: "Hệ thống đang lấy thông tin booking từ máy chủ." });
    setUiState("processing");

    try {
      const response = await getGateBooking(manualPreview.bookingId);
      applyBookingPayload(
        response,
        {
          title: "Đã tải thông tin booking",
          message: "Bạn có thể kiểm tra thông tin và chọn thao tác cho xe vào hoặc ra bãi.",
        },
      );
    } catch (error) {
      setBooking(null);
      setUiState("error");
      setBanner(buildBannerFromError(error, "Không tìm thấy booking"));
    }
  };

  const handleSubmitQr = async () => {
    if (!gateId.trim()) {
      setUiState("error");
      setBanner({ title: "Thiếu mã cổng", message: "Vui lòng nhập mã cổng trước khi quét." });
      return;
    }
    if (!scanValue.trim()) {
      setUiState("error");
      setBanner({ title: "Chưa có dữ liệu quét", message: "Hãy quét QR hoặc nhập payload QR trước khi xử lý." });
      return;
    }

    setBanner({ title: "Đang quét...", message: "Đã nhận dữ liệu từ scanner, đang lấy thông tin booking." });
    setUiState("scanning");

    try {
      setUiState("processing");
      const response = await resolveGateScan({
        raw_scan_text: scanValue,
        source_type: "qr_scan",
        gate_id: gateId.trim(),
      });

      const resolvedBooking = response?.booking;
      applyBookingPayload(
        { booking: resolvedBooking },
        {
          title: response?.cooldown?.active ? "Đang trong cooldown" : "Đã resolve QR",
          message:
            response?.cooldown?.message
            || "QR hợp lệ. Vui lòng bấm nút để chọn cho xe vào bãi hoặc ra bãi.",
        },
      );
    } catch (error) {
      setBooking(null);
      setUiState("error");
      setBanner(buildBannerFromError(error, "Không đọc được QR"));
    }
  };

  const handleCheckIn = async () => {
    if (!booking?.booking_id) {
      setUiState("error");
      setBanner({ title: "Chưa có booking", message: "Hãy xem thông tin booking trước khi thao tác cho xe vào bãi." });
      return;
    }

    setUiState("action_submitting");
    setBanner({ title: "Đang xử lý...", message: "Đang thực hiện check-in tại cổng." });

    try {
      const response = await checkInGate({
        booking_id: booking.booking_id,
        gate_id: gateId.trim(),
        source_type: "manual_id",
      });
      applyBookingPayload(
        response,
        {
          title: "Đã check-in",
          message: "Xe đã được cho vào bãi và trạng thái booking đã được cập nhật ngay.",
        },
        "success",
      );
    } catch (error) {
      setUiState("error");
      setBanner(buildBannerFromError(error, "Không thể cho xe vào bãi"));
    }
  };

  const handleCheckOut = async () => {
    if (!booking?.booking_id) {
      setUiState("error");
      setBanner({ title: "Chưa có booking", message: "Hãy xem thông tin booking trước khi thao tác cho xe ra bãi." });
      return;
    }

    setUiState("action_submitting");
    setBanner({ title: "Đang xử lý...", message: "Đang thực hiện check-out và tính phí thực tế." });

    try {
      const response = await checkOutGate({
        booking_id: booking.booking_id,
        gate_id: gateId.trim(),
        source_type: "manual_id",
        payment_method: paymentMethod,
      });
      applyBookingPayload(
        response,
        {
          title: "Đã check-out",
          message:
            paymentMethod === "vnpay"
              ? `Xe đã ra bãi. QR VNPay đã được tạo cho số tiền ${formatCurrency(response?.booking?.pricing_preview?.remaining_due)}.`
              : `Xe đã ra bãi. Đã thu ${formatCurrency(response?.booking?.pricing_preview?.total_charge)} bằng tiền mặt.`,
        },
        "success",
      );
    } catch (error) {
      setUiState("error");
      setBanner(buildBannerFromError(error, "Không thể cho xe ra bãi"));
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
              Quét QR để nhận diện booking, sau đó nhân viên chủ động chọn thao tác cho xe vào hoặc ra bãi.
            </p>
          </div>

          <div className="scan-hero-badge">
            <strong>Trạng thái cổng</strong>
            <span>{uiState === "idle" ? "Sẵn sàng" : uiState}</span>
            <span>{booking?.cooldown?.active ? "Đang chờ cooldown" : "Có thể quét tiếp"}</span>
          </div>
        </div>

        <div className="scan-grid">
          <ScanZone
            scanValue={scanValue}
            setScanValue={setScanValue}
            onSubmitQr={handleSubmitQr}
            manualBookingId={manualBookingId}
            setManualBookingId={setManualBookingId}
            onResolveManual={handleResolveManual}
            gateId={gateId}
            setGateId={setGateId}
            uiState={uiState}
            qrPreviewError={qrPreview.error}
            inputRef={scanInputRef}
          />

          <section className="scan-panel">
            <BookingInfoPanel booking={booking || { input_type: qrPreview.payload ? "qr_json" : null }} />
            <ActionButtons booking={booking} uiState={uiState} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} />
            <PaymentPanel booking={booking} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
            <StatusBanner
              tone={getBannerTone(uiState, booking)}
              title={banner.title}
              message={banner.message}
              extra={booking?.cooldown?.active ? booking.cooldown.message : booking?.cancel_reason}
            />
          </section>
        </div>
      </div>
    </section>
  );
}
