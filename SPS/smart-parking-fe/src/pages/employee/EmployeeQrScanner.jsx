import { useState } from "react";

import { employeeCheckIn, employeeCheckOut } from "../../employee/employeeService";
import { useEmployeeContext } from "../../employee/useEmployeeContext";

export default function EmployeeQrScanner() {
  const { refreshEmployee } = useEmployeeContext();
  const [mode, setMode] = useState("check-in");
  const [qrData, setQrData] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!qrData.trim()) {
      setError("Vui lòng quét mã QR hoặc nhập mã booking/payload QR.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        qr_data: qrData.trim(),
        payment_method: paymentMethod,
      };
      const res = mode === "check-in" ? await employeeCheckIn(payload) : await employeeCheckOut(payload);
      setResult(res);
      await refreshEmployee();
    } catch (err) {
      setError(err?.response?.data?.detail || "Không thể xử lý thao tác QR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="employee-card employee-section-shell">
      <div className="employee-section-headline">
        <h2>Quét mã QR tại cổng</h2>
        <span className="employee-chip">Đồng bộ với luồng cổng owner/admin</span>
      </div>

      <div className="employee-action-row">
        <button
          type="button"
          className={`employee-btn${mode === "check-in" ? "" : " employee-btn--ghost"}`}
          onClick={() => setMode("check-in")}
        >
          Chế độ check-in
        </button>
        <button
          type="button"
          className={`employee-btn${mode === "check-out" ? "" : " employee-btn--ghost"}`}
          onClick={() => setMode("check-out")}
        >
          Chế độ check-out
        </button>
      </div>

      <div className="employee-form-grid">
        <div className="employee-action-box employee-action-box--strong">
          <p>Dữ liệu QR / mã booking</p>
          <textarea
            rows={8}
            value={qrData}
            onChange={(event) => setQrData(event.target.value)}
            placeholder='Ví dụ: {"booking_id": 12} hoặc chỉ nhập 12'
          />
        </div>

        <div className="employee-action-box">
          <p>Phương thức thanh toán khi check-out</p>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={mode !== "check-out"}>
            <option value="cash">Tiền mặt</option>
            <option value="qr">Chuyển khoản QR</option>
            <option value="vnpay">VNPay</option>
            <option value="bank_transfer">Chuyển khoản ngân hàng</option>
          </select>

          <div className="employee-tip-list">
            <p className="employee-note">Khi check-in, hệ thống bỏ qua phương thức thanh toán.</p>
            <p className="employee-note">Khi check-out, nên xác nhận đúng biển số trước khi thao tác.</p>
          </div>
        </div>
      </div>

      <div className="employee-action-row">
        <button type="button" className="employee-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Đang xử lý..." : mode === "check-in" ? "Thực hiện check-in" : "Thực hiện check-out"}
        </button>
      </div>

      {error ? <p className="employee-login-error">{error}</p> : null}

      {result ? (
        <div className="employee-card employee-result-card">
          <h3>{result.message}</h3>
          <div className="employee-status-row employee-status-row--chips">
            <span className="employee-chip">Booking: BK-{result.booking?.booking_id}</span>
            <span className="employee-chip">Trạng thái: {result.booking?.booking_status_label || result.booking?.booking_status}</span>
            <span className="employee-chip">Biển số: {result.booking?.vehicle?.license_plate || "--"}</span>
            <span className="employee-chip">Tổng thu: {Number(result.payment_preview?.total_charge || 0).toLocaleString("vi-VN")}đ</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
