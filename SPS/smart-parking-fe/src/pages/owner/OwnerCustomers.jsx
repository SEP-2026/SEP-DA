import { useMemo, useState } from "react";
import { formatCurrency, formatDateTime, SectionCard, StatusBadge } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

export default function OwnerCustomers() {
  const { ownerData } = useOwnerContext();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Extract unique customers from bookings
  const customersMap = useMemo(() => {
    const map = new Map();
    ownerData.bookings.forEach((booking) => {
      if (!map.has(booking.user)) {
        map.set(booking.user, {
          id: booking.id,
          name: booking.user,
          phone: booking.phone,
          bookings: [],
          totalSpent: 0,
          vehicles: [],
        });
      }
      const customer = map.get(booking.user);
      customer.bookings.push(booking);
      customer.totalSpent += booking.price;

      // Add unique vehicles
      if (!customer.vehicles.find((v) => v.plate === booking.plate)) {
        customer.vehicles.push({
          plate: booking.plate,
          type: booking.type || "Không xác định",
          firstUsed: booking.startTime,
        });
      }
    });

    // Calculate payment status from transactions
    map.forEach((customer) => {
      customer.transactions = ownerData.transactions.filter((tx) =>
        customer.bookings.some((b) => b.code === tx.bookingCode)
      );
      customer.paidAmount = customer.transactions
        .filter((tx) => tx.status === "paid")
        .reduce((sum, tx) => sum + tx.amount, 0);
      customer.pendingAmount = customer.transactions
        .filter((tx) => tx.status === "pending")
        .reduce((sum, tx) => sum + tx.amount, 0);
    });

    return map;
  }, [ownerData.bookings, ownerData.transactions]);

  const filteredCustomers = useMemo(() => {
    const list = Array.from(customersMap.values());
    if (!searchKeyword.trim()) {
      return list;
    }
    const keyword = searchKeyword.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(keyword) ||
        c.phone.includes(keyword)
    );
  }, [customersMap, searchKeyword]);

  const customerDetails = selectedCustomer
    ? customersMap.get(selectedCustomer)
    : null;

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Danh sách khách hàng"
        subtitle="Quản lý thông tin khách, lịch sử booking và thanh toán."
        actions={
          <input
            className="owner-input owner-control"
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        }
      >
        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Lần booking</th>
                <th>Tổng tiền</th>
                <th>Đã thanh toán</th>
                <th>Chưa thanh toán</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.bookings.length}</td>
                    <td>{formatCurrency(customer.totalSpent)}</td>
                    <td className="table-cell-green">{formatCurrency(customer.paidAmount)}</td>
                    <td className="table-cell-orange">{formatCurrency(customer.pendingAmount)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-primary owner-btn owner-btn--small"
                        onClick={() => setSelectedCustomer(customer.name)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                    Không tìm thấy khách hàng
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {customerDetails ? (
        <div className="owner-modal-backdrop" onClick={() => setSelectedCustomer(null)}>
          <div
            className="owner-modal owner-modal--detail owner-modal--large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="owner-modal-head">
              <div>
                <h2>{customerDetails.name}</h2>
                <p>Chi tiết thông tin khách hàng và lịch sử giao dịch.</p>
              </div>
              <button
                type="button"
                className="owner-modal-close"
                onClick={() => setSelectedCustomer(null)}
              >
                ×
              </button>
            </div>

            <div className="owner-detail-grid">
              <div><span>Tên khách</span><strong>{customerDetails.name}</strong></div>
              <div><span>Số điện thoại</span><strong>{customerDetails.phone}</strong></div>
              <div><span>Tổng lần booking</span><strong>{customerDetails.bookings.length}</strong></div>
              <div><span>Tổng tiền booking</span><strong>{formatCurrency(customerDetails.totalSpent)}</strong></div>
              <div><span>Đã thanh toán</span><strong className="text-green">{formatCurrency(customerDetails.paidAmount)}</strong></div>
              <div><span>Chưa thanh toán</span><strong className="text-orange">{formatCurrency(customerDetails.pendingAmount)}</strong></div>
            </div>

            {/* Thông tin xe */}
            <div className="owner-section">
              <h3>Thông tin xe của khách</h3>
              {customerDetails.vehicles.length > 0 ? (
                <div className="owner-vehicle-grid">
                  {customerDetails.vehicles.map((vehicle) => (
                    <div key={vehicle.plate} className="owner-vehicle-card">
                      <strong>Biển số: {vehicle.plate}</strong>
                      <p>Loại xe: {vehicle.type}</p>
                      <p className="text-sm">Lần đầu: {formatDateTime(vehicle.firstUsed)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Không có thông tin xe</p>
              )}
            </div>

            {/* Lịch sử booking */}
            <div className="owner-section">
              <h3>Lịch sử đặt chỗ</h3>
              <div className="owner-table-shell">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Biển số</th>
                      <th>Vào</th>
                      <th>Ra</th>
                      <th>Giá tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetails.bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.code}</td>
                        <td>{booking.plate}</td>
                        <td>{formatDateTime(booking.startTime)}</td>
                        <td>{formatDateTime(booking.endTime)}</td>
                        <td>{formatCurrency(booking.price)}</td>
                        <td>
                          <StatusBadge status={booking.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lịch sử thanh toán */}
            <div className="owner-section">
              <h3>Lịch sử thanh toán</h3>
              {customerDetails.transactions.length > 0 ? (
                <div className="owner-table-shell">
                  <table className="owner-table">
                    <thead>
                      <tr>
                        <th>Mã giao dịch</th>
                        <th>Mã đơn</th>
                        <th>Phương thức</th>
                        <th>Số tiền</th>
                        <th>Thời gian</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDetails.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{tx.id}</td>
                          <td>{tx.bookingCode}</td>
                          <td>{tx.method}</td>
                          <td>{formatCurrency(tx.amount)}</td>
                          <td>{formatDateTime(tx.time)}</td>
                          <td>
                            <StatusBadge status={tx.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Chưa có giao dịch nào</p>
              )}
            </div>

            {/* Hỗ trợ khách hàng */}
            <div className="owner-support-section">
              <h3>Hỗ trợ khách hàng</h3>
              <div className="owner-support-box">
                <p>
                  <strong>Quên điện thoại / Pin hết:</strong> Liên hệ khách qua số {customerDetails.phone} hoặc xác minh qua biển số xe để hỗ trợ vào/ra bãi.
                </p>
                <p>
                  <strong>Tranh chấp thanh toán:</strong> Kiểm tra lịch sử booking và giao dịch trên để xác minh số tiền.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .table-cell-green {
          color: #27ae60;
          font-weight: 600;
        }
        .table-cell-orange {
          color: #e74c3c;
          font-weight: 600;
        }
        .text-green {
          color: #27ae60;
        }
        .text-orange {
          color: #e74c3c;
        }
        .text-sm {
          font-size: 0.85rem;
          color: #7f8c8d;
        }
        .owner-section {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #ecf0f1;
        }
        .owner-section h3 {
          margin-bottom: 15px;
          font-size: 1.1rem;
          color: #2c3e50;
        }
        .owner-vehicle-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .owner-vehicle-card {
          padding: 12px;
          border: 1px solid #ecf0f1;
          border-radius: 6px;
          background: #f8f9fa;
        }
        .owner-vehicle-card strong {
          display: block;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        .owner-vehicle-card p {
          margin: 4px 0;
          font-size: 0.9rem;
          color: #555;
        }
        .owner-support-section {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #ecf0f1;
        }
        .owner-support-section h3 {
          margin-bottom: 15px;
          font-size: 1.1rem;
          color: #2c3e50;
        }
        .owner-support-box {
          background: #f0f3f5;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #3498db;
        }
        .owner-support-box p {
          margin: 10px 0;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .owner-modal--large {
          max-height: 90vh;
          overflow-y: auto;
          width: 90%;
          max-width: 900px;
        }
      `}</style>
    </div>
  );
}
