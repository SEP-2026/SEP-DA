export function canCheckIn(booking) {
  return Boolean(booking?.allowed_actions?.includes("check_in"));
}

export function canCheckOut(booking) {
  return Boolean(booking?.allowed_actions?.includes("check_out"));
}
