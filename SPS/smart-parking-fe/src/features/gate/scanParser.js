export function parseManualBookingId(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { bookingId: null, error: "" };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { bookingId: null, error: "Booking ID phải là số nguyên dương." };
  }

  return { bookingId: Number(trimmed), error: "" };
}

export function inferQrPreview(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { bookingId: null, payload: null, error: "" };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      bookingId: Number(trimmed),
      payload: { booking_id: Number(trimmed) },
      error: "",
    };
  }

  try {
    const payload = JSON.parse(trimmed);
    const bookingId = Number(payload?.booking_id ?? payload?.b ?? payload?.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return {
        bookingId: null,
        payload: null,
        error: "QR hợp lệ nhưng không có booking_id khả dụng.",
      };
    }
    return { bookingId, payload, error: "" };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const payload = JSON.parse(match[0]);
        const bookingId = Number(payload?.booking_id ?? payload?.b ?? payload?.id);
        if (Number.isInteger(bookingId) && bookingId > 0) {
          return { bookingId, payload, error: "" };
        }
      } catch {
        return {
          bookingId: null,
          payload: null,
          error: "QR không parse được. Hãy quét lại hoặc nhập Booking ID thủ công.",
        };
      }
    }
    return {
      bookingId: null,
      payload: null,
      error: "QR không parse được. Hãy quét lại hoặc nhập Booking ID thủ công.",
    };
  }
}

export function parseBookingIdFromQR(text) {
  const raw = `${text ?? ""}`.trim();
  if (!raw) return null;

  const jsonNewMatch = raw.match(/"b"\s*:\s*(\d+)/);
  if (jsonNewMatch) {
    return Number(jsonNewMatch[1]);
  }

  const jsonOldMatch = raw.match(/"booking_id"\s*:\s*(\d+)/);
  if (jsonOldMatch) {
    return Number(jsonOldMatch[1]);
  }

  const lineMatch = raw.match(/Mã đặt chỗ\s*:\s*#(\d+)/);
  if (lineMatch) {
    return Number(lineMatch[1]);
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  return null;
}
