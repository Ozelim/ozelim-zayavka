import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/jwt";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return Response.json(
      { error: "Email и пароль обязательны" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, is_active
         FROM users
        WHERE email = $1
        LIMIT 1`,
      [email],
    );
    const user = rows[0];

    // Дамми-сравнение, чтобы время ответа не выдавало существование email.
    const hashToCheck =
      user?.password_hash ||
      "$2b$10$0000000000000000000000000000000000000000000000000000.";
    const ok = await bcrypt.compare(password, hashToCheck);

    if (!user || !user.password_hash || !ok) {
      return Response.json(
        { error: "Неверный email или пароль" },
        { status: 401 },
      );
    }

    if (String(user.role).toLowerCase() !== "moderator") {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }
    if (user.is_active === false) {
      return Response.json({ error: "Аккаунт заблокирован" }, { status: 403 });
    }

    const token = await signSession({
      sub: String(user.id),
      userId: user.id,
      role: "MODERATOR",
      email: user.email,
    });

    const res = Response.json({
      ok: true,
      user: { id: user.id, email: user.email, role: "MODERATOR" },
    });
    res.headers.append(
      "Set-Cookie",
      [
        `${SESSION_COOKIE}=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        process.env.NODE_ENV === "production" ? "Secure" : "",
        `Max-Age=${SESSION_MAX_AGE}`,
      ]
        .filter(Boolean)
        .join("; "),
    );
    return res;
  } catch (err) {
    console.error("[POST /api/login]", err);
    return Response.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
