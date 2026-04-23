export default function ScanZone({
  scanValue,
  setScanValue,
  onSubmitQr,
  manualBookingId,
  setManualBookingId,
  onResolveManual,
  gateId,
  setGateId,
  uiState,
  qrPreviewError,
  inputRef,
}) {
  return (
    <section className="scan-panel scan-panel--primary">
      <div className={`scan-frame scan-frame--${uiState}`}>
        <div className="scan-frame-corners" />
        <div className="scan-line" />
        <div className="scan-frame-content">
          <strong>Vùng scan cổng</strong>
          <span>
            Quét QR để tải thông tin booking. Sau đó nhân viên bấm nút để chọn vào bãi hoặc ra bãi.
          </span>
          <span className="scan-live-indicator">
            {uiState === "scanning" ? "Đang quét..." : uiState === "processing" || uiState === "action_submitting" ? "Đang xử lý..." : "Sẵn sàng nhận dữ liệu"}
          </span>
        </div>
      </div>

      <div className="scan-form-grid">
        <label className="scan-field">
          <span>Mã cổng / gate_id</span>
          <input
            className="scan-input"
            value={gateId}
            onChange={(event) => setGateId(event.target.value)}
            placeholder="Ví dụ: GATE-A1"
          />
        </label>

        <label className="scan-field">
          <span>Booking ID thủ công</span>
          <div className="scan-inline">
            <input
              className="scan-input"
              value={manualBookingId}
              onChange={(event) => setManualBookingId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onResolveManual();
                }
              }}
              placeholder="Nhập mã booking"
            />
            <button type="button" className="scan-secondary-btn" onClick={onResolveManual} disabled={!manualBookingId.trim()}>
              Xem booking
            </button>
          </div>
        </label>
      </div>

      <label className="scan-field">
        <span>Nội dung QR / máy scan</span>
        <textarea
          ref={inputRef}
          className="scan-input scan-textarea"
          rows={5}
          value={scanValue}
          onChange={(event) => setScanValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmitQr();
            }
          }}
          placeholder='Ví dụ: {"booking_id":12} hoặc payload QR đầy đủ'
        />
      </label>

      <div className="scan-actions scan-actions--single">
        <button type="button" className="scan-primary-btn" onClick={onSubmitQr} disabled={!scanValue.trim()}>
          Quét QR
        </button>
      </div>

      {qrPreviewError ? <p className="scan-inline-error">{qrPreviewError}</p> : null}
    </section>
  );
}
