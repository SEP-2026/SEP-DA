export const PASSWORD_POLICY_TEXT = "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (vd: Longtu26@).";

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

export const isStrongPassword = (password) => PASSWORD_POLICY_REGEX.test(password || "");

export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "Rất yếu", color: "#dc2626" };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return { score: 1, label: "Rất yếu", color: "#dc2626" };
  if (score <= 3) return { score: 2, label: "Yếu", color: "#f97316" };
  if (score <= 4) return { score: 3, label: "Trung bình", color: "#eab308" };
  if (score <= 5) return { score: 4, label: "Mạnh", color: "#22c55e" };
  return { score: 5, label: "Rất mạnh", color: "#16a34a" };
};
