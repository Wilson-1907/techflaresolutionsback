const base = process.env.API_URL || "http://localhost:3000";
const email = `test${Date.now()}@example.com`;
const body = {
  firstName: "Test",
  lastName: "User",
  email,
  password: "Secure1!Pass",
  confirmPassword: "Secure1!Pass",
  role: "CLIENT",
};

const res = await fetch(`${base}/api/auth/register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(res.status, text);
