import { SESSION_COOKIE } from "@/lib/jwt";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      process.env.NODE_ENV === "production" ? "Secure" : "",
      "Max-Age=0",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return res;
}
