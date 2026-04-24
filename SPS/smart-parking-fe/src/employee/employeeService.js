import API from "../services/api";

export async function employeeLogin(payload) {
  const response = await API.post("/api/employee/login", payload);
  return response.data;
}

export async function employeeMe() {
  const response = await API.get("/api/employee/me");
  return response.data;
}

export async function getEmployeeParkingLot() {
  const response = await API.get("/api/employee/parking-lot");
  return response.data;
}

export async function getEmployeeVehicles() {
  const response = await API.get("/api/employee/vehicles");
  return response.data;
}

export async function getEmployeeRevenue() {
  const response = await API.get("/api/employee/revenue");
  return response.data;
}

export async function getEmployeeProfile() {
  const response = await API.get("/api/employee/profile");
  return response.data;
}

export async function getEmployeeHistory() {
  const response = await API.get("/api/employee/history");
  return response.data;
}

export async function updateEmployeeParkingStatus(payload) {
  const response = await API.put("/api/employee/parking-status", payload);
  return response.data;
}

export async function employeeCheckIn(payload) {
  const response = await API.post("/api/employee/check-in", payload);
  return response.data;
}

export async function employeeCheckOut(payload) {
  const response = await API.post("/api/employee/check-out", payload);
  return response.data;
}
