import { formatDateTimeVN } from "../../utils/dateTime";

export function formatDateTime(value) {
  return formatDateTimeVN(value, "Chưa có");
}

export function formatCurrency(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("vi-VN")}đ`;
}

export function formatInputType(value) {
  const mapping = {
    manual_id: "Booking ID thủ công",
    qr_booking: "QR booking",
    qr_json: "QR JSON",
  };
  return mapping[value] || value || "--";
}

const VIETQR_BANK_ID = "VCB";
const VIETQR_ACCOUNT_NO = "1021209511";
const VIETQR_ACCOUNT_NAME = "SMART PARKING";

export function buildDynamicVietQrUrl(amount, bookingId) {
  if (!VIETQR_BANK_ID || !VIETQR_ACCOUNT_NO) {
    return null;
  }

  const amountValue = Math.max(0, Math.round(Number(amount || 0)));
  if (amountValue <= 0) {
    return null;
  }

  const addInfo = encodeURIComponent(`GATE ${bookingId}`);
  const accountName = encodeURIComponent(VIETQR_ACCOUNT_NAME || "SMART PARKING");

  return `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?amount=${amountValue}&addInfo=${addInfo}&accountName=${accountName}`;
}
