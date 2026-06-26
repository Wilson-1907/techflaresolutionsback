const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty123",
  "admin123", "letmein1", "welcome1", "techflare", "iloveyou", "sunshine1",
  "football1", "baseball1", "monkey123", "dragon123", "master123", "login123",
  "passw0rd", "password!", "Password1", "Password123", "Qwerty123", "Admin123!",
]);

export type PasswordCheck = { ok: true } | { ok: false; message: string };

export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password must be 128 characters or fewer." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Password must include a lowercase letter." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include an uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include a number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: "Password must include a symbol (e.g. !@#$%)." };
  }
  if (/(.)\1{3,}/.test(password)) {
    return { ok: false, message: "Password must not repeat the same character four or more times." };
  }
  if (isSequential(password)) {
    return { ok: false, message: "Password must not be a predictable sequence." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: "Password is too common. Choose a stronger, unique password." };
  }
  return { ok: true };
}

function isSequential(value: string): boolean {
  const lower = value.toLowerCase();
  const digits = "0123456789";
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i <= lower.length - 4; i++) {
    const chunk = lower.slice(i, i + 4);
    if (digits.includes(chunk) || letters.includes(chunk)) return true;
    const rev = chunk.split("").reverse().join("");
    if (digits.includes(rev) || letters.includes(rev)) return true;
  }
  return false;
}

export function passwordsMatch(password: string, confirmPassword: string): PasswordCheck {
  if (password !== confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  return { ok: true };
}
