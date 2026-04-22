import API from "../../services/api";

export async function resolveGateScan(payload) {
  const response = await API.post("/gate/scan/resolve", payload);
  return response.data;
}

export async function getGateBooking(bookingId) {
  const response = await API.get(`/gate/bookings/${bookingId}`);
  return response.data;
}

export async function checkInGate(payload) {
  const response = await API.post("/gate/check-in", payload);
  return response.data;
}

export async function checkOutGate(payload) {
  const response = await API.post("/gate/check-out", payload);
  return response.data;
}
