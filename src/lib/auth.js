import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";
import pool from "@/lib/db";

// Проверяет валидную сессию модератора и подгружает его разрешённые kind'ы.
// Возвращает { ok: true, moderatorId, email, kinds } либо { ok: false, response }.
export async function requireModerator() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Требуется авторизация" },
        { status: 401 },
      ),
    };
  }
  if (String(session.role).toUpperCase() !== "MODERATOR") {
    return {
      ok: false,
      response: Response.json({ error: "Нет доступа" }, { status: 403 }),
    };
  }

  const moderatorId = Number(session.userId ?? session.sub) || null;
  if (!moderatorId) {
    return {
      ok: false,
      response: Response.json({ error: "Нет доступа" }, { status: 403 }),
    };
  }

  // Подгружаем актуальные доступы и проверяем что аккаунт не заблокирован.
  const { rows } = await pool.query(
    `SELECT u.is_active,
            COALESCE(
              (SELECT array_agg(mlk.kind ORDER BY mlk.kind)
                 FROM moderator_lead_kinds mlk
                WHERE mlk.user_id = u.id),
              ARRAY[]::text[]
            ) AS kinds
       FROM users u
      WHERE u.id = $1 AND u.role = 'moderator'`,
    [moderatorId],
  );

  if (rows.length === 0 || rows[0].is_active === false) {
    return {
      ok: false,
      response: Response.json({ error: "Нет доступа" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    moderatorId,
    email: session.email || null,
    kinds: rows[0].kinds || [],
  };
}
