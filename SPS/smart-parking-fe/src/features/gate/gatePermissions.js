export function canCheckIn(booking) {
  const allowed = booking?.allowed_actions;
  if (Array.isArray(allowed)) {
    return allowed.includes("check_in");
  }
  const status = (booking?.booking_status || "").toLowerCase();
  const paymentStatus = (booking?.payment?.payment_status || "").toLowerCase();
  if (status === "pending" && paymentStatus && paymentStatus !== "paid") {
    return false;
  }
  return status === "booked" || status === "checked_out";
}

export function canCheckOut(booking) {
  const allowed = booking?.allowed_actions;
  if (Array.isArray(allowed)) {
    return allowed.includes("check_out");
  }
  const status = (booking?.booking_status || "").toLowerCase();
  return status === "checked_in";
}
