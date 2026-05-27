import { SignJWT, jwtVerify } from "jose";

// Отдельная cookie от ozelim-admin2 (admin_session) и ozelim2 (user_session) —
// разные сайты на одном домене не должны делить сессии.
export const SESSION_COOKIE = "moderator_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 дней

const ALG = "HS256";

const SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_TOKEN;
  if (!secret) {
    throw new Error(
      "JWT_SECRET (или ADMIN_TOKEN) не задан в переменных окружения",
    );
  }
  return new TextEncoder().encode(secret);
})();

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALG] });
    return payload;
  } catch {
    return null;
  }
}
