import { useEffect, useMemo, useState } from "react";

import API from "../services/api";
import { formatDateTimeVN } from "../utils/dateTime";
import "./PaymentHistory.css";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const formatMoney = (value) => currency.format(Number(value || 0));

const STATUS_LABELS = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
  booked: "Đã đặt",
  checked_in: "Đang gửi xe",
  checked_out: "Đã check-out",
};

const translateStatus = (status) => {
  if (!status) return "N/A";
  const key = String(status).toLowerCase();
  return STATUS_LABELS[key] || status;
};

export default function PaymentHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/payment/history");
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Không tải được lịch sử thanh toán");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const totalPaid = rows.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
    const totalBooking = rows.reduce((sum, item) => sum + Number(item.booking_amount || 0), 0);
    const totalDeposit = rows.reduce((sum, item) => sum + Number(item.deposit_amount || 0), 0);
    return { totalPaid, totalBooking, totalDeposit };
  }, [rows]);

  return (
    <section className="page-wrap payment-history-wrap">
      <div className="page-card payment-history-shell">
        <header className="payment-history-head">
          <h1 className="page-title">Lịch sử thanh toán</h1>
          <p className="payment-history-subtitle">Hiển thị tiền đã thanh toán, tiền booking và tiền cọc 30% khi không check-in đúng hạn.</p>
        </header>

        <div className="payment-history-summary">
          <div className="payment-summary-card">
            <span>Đã thanh toán</span>
            <strong>{formatMoney(summary.totalPaid)}</strong>
          </div>
          <div className="payment-summary-card">
            <span>Tổng tiền booking</span>
            <strong>{formatMoney(summary.totalBooking)}</strong>
          </div>
          <div className="payment-summary-card">
            <span>Tổng tiền cọc no-show</span>
            <strong>{formatMoney(summary.totalDeposit)}</strong>
          </div>
        </div>

        {loading ? <p className="payment-history-note">Đang tải dữ liệu...</p> : null}
        {error ? <p className="payment-history-error">{error}</p> : null}

        {!loading && !error ? (
          <div className="payment-history-table-wrap">
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Trạng thái</th>
                  <th>Tiền booking</th>
                  <th>Đã thanh toán</th>
                  <th>Tiền cọc 30%</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="payment-history-empty">Chưa có dữ liệu thanh toán.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.booking_id}>
                      <td>#{row.booking_id}</td>
                      <td>
                        {row.booking_status === "cancelled" && row.cancel_reason === "no_show"
                          ? "Quá hạn check-in"
                          : translateStatus(row.payment_status || row.booking_status)}
                      </td>
                      <td>{formatMoney(row.booking_amount)}</td>
                      <td>{formatMoney(row.paid_amount)}</td>
                      <td>{formatMoney(row.deposit_amount)}</td>
                      <td>{formatDateTimeVN(row.booking_created_at, "N/A")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}