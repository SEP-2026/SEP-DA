import API from "../../services/api";

function deriveAllowedActions(booking) {
  const status = (booking?.booking_status || "").toLowerCase();
  const paymentStatus = (booking?.payment?.payment_status || "").toLowerCase();
  if (status === "checked_in") return ["check_out"];
  if (status === "booked" || status === "checked_out") return ["check_in"];
  if (status === "pending" && (!paymentStatus || paymentStatus === "paid")) return ["check_in"];
  return [];
}

export async function resolveGateScan(payload) {
  const response = await API.post("/gate/scan/resolve", payload);
  return response.data;
}

export async function getGateBooking(bookingId) {
  try {
    const response = await API.get(`/gate/bookings/${bookingId}`);
    return response.data;
  } catch (error) {
    if (error?.response?.status !== 403) {
      throw error;
    }
    const fallback = await API.get(`/booking/gate/${bookingId}`);
    const booking = fallback.data || {};
    return {
      ...booking,
      allowed_actions: deriveAllowedActions(booking),
    };
  }
}

export async function checkInGate(payload) {
  try {
    const response = await API.post("/gate/check-in", payload);
    return response.data;
  } catch (error) {
    if (error?.response?.status !== 403) {
      throw error;
    }
    const fallback = await API.post("/check-in", null, {
      params: { booking_id: payload.booking_id },
    });
    return {
      ...fallback.data,
      booking: {
        ...(fallback.data || {}),
        booking_id: fallback.data?.booking_id,
        booking_status: fallback.data?.booking_status,
        actual_checkin: fallback.data?.actual_checkin,
      },
    };
  }
}

export async function checkOutGate(payload) {
  try {
    const response = await API.post("/gate/check-out", payload);
    return response.data;
  } catch (error) {
    if (error?.response?.status !== 403) {
      throw error;
    }
    const fallback = await API.post("/check-out", null, {
      params: { booking_id: payload.booking_id },
    });
    return {
      ...fallback.data,
      booking: {
        ...(fallback.data || {}),
        booking_id: fallback.data?.booking_id,
        booking_status: fallback.data?.booking_status,
        actual_checkin: fallback.data?.actual_checkin,
        actual_checkout: fallback.data?.actual_checkout,
      },
    };
  }
}

export async function getCheckoutPreview(bookingId) {
  const response = await API.get(`/bookings/${bookingId}/checkout-preview`);
  return response.data;
}

export async function confirmCheckout(bookingId) {
  const response = await API.post(`/bookings/${bookingId}/checkout`, {});
  return response.data;
}

export async function getBookingStatus(bookingId) {
  const response = await API.get(`/bookings/${bookingId}/status`);
  return response.data;
}
