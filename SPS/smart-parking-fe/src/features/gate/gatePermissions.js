export function canCheckIn(booking) {
  const allowed = booking?.allowed_actions;
  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.includes("check_in");
  }
  const status = (booking?.booking_status || "").toLowerCase();
  return status === "pending" || status === "booked" || status === "checked_out";
}

export function canCheckOut(booking) {
  const allowed = booking?.allowed_actions;
  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.includes("check_out");
  }
  const status = (booking?.booking_status || "").toLowerCase();
  return status === "checked_in";
}
