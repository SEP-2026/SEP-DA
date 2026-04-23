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
      setError("Vui lòng quét QR hoặc nhập booking id / payload QR.");
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
    <section className="employee-card">
      <h2>QR Scanner</h2>
      <p>Reuse logic QR từ cổng owner/admin. Bạn có thể nhập QR JSON hoặc booking id trực tiếp để test nhanh.</p>

      <div className="employee-action-row">
        <button type="button" className={`employee-btn${mode === "check-in" ? "" : " employee-btn--ghost"}`} onClick={() => setMode("check-in")}>
          Mode check-in
        </button>
        <button type="button" className={`employee-btn${mode === "check-out" ? "" : " employee-btn--ghost"}`} onClick={() => setMode("check-out")}>
          Mode check-out
        </button>
      </div>

      <div className="employee-form-grid">
        <div className="employee-action-box">
          <p>QR data / booking id</p>
          <textarea rows={8} value={qrData} onChange={(event) => setQrData(event.target.value)} placeholder='Ví dụ: {"booking_id": 12} hoặc chỉ nhập 12' />
        </div>
        <div className="employee-action-box">
          <p>Thiết lập thanh toán khi check-out</p>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={mode !== "check-out"}>
            <option value="cash">Cash</option>
            <option value="qr">QR</option>
            <option value="vnpay">VNPay</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
          <p className="employee-note">Khi check-in, hệ thống bỏ qua phương thức thanh toán và dùng flow cổng sẵn có.</p>
        </div>
      </div>

      <div className="employee-action-row">
        <button type="button" className="employee-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Đang xử lý..." : mode === "check-in" ? "Thực hiện check-in" : "Thực hiện check-out"}
        </button>
      </div>

      {error ? <p className="employee-login-error">{error}</p> : null}
      {result ? (
        <div className="employee-card">
          <h3>{result.message}</h3>
          <div className="employee-status-row">
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
