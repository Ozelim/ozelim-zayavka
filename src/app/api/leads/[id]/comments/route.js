import pool from "@/lib/db";
import { requireModerator } from "@/lib/auth";

// Доступ к комментариям — только если у модератора есть kind этой заявки.
async function assertLeadAccess(leadId, allowedKinds) {
  const { rows } = await pool.query(
    "SELECT id, kind FROM leads WHERE id = $1",
    [leadId],
  );
  if (rows.length === 0) return { ok: false, status: 404, error: "Заявка не найдена" };
  if (!allowedKinds.includes(rows[0].kind)) {
    return { ok: false, status: 403, error: "Нет доступа" };
  }
  return { ok: true };
}

// GET /api/leads/:id/comments — список комментариев.
export async function GET(_request, { params }) {
  const auth = await requireModerator();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Некорректный id" }, { status: 400 });
  }

  const guard = await assertLeadAccess(idNum, auth.kinds || []);
  if (!guard.ok) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { rows } = await pool.query(
      `SELECT lc.id, lc.body, lc.created_at, lc.author_id,
              u.email      AS author_email,
              u.name       AS author_name,
              u.surname    AS author_surname
         FROM lead_comments lc
         LEFT JOIN users u ON u.id = lc.author_id
        WHERE lc.lead_id = $1
        ORDER BY lc.created_at ASC, lc.id ASC`,
      [idNum],
    );
    return Response.json(rows);
  } catch (err) {
    console.error("[GET /api/leads/:id/comments]", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

// POST /api/leads/:id/comments — добавить комментарий. body: { body }
export async function POST(request, { params }) {
  const auth = await requireModerator();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return Response.json({ error: "Некорректный id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const text = String(body?.body || "").trim();
  if (!text) {
    return Response.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
  }
  if (text.length > 5000) {
    return Response.json({ error: "Комментарий слишком длинный" }, { status: 400 });
  }

  const guard = await assertLeadAccess(idNum, auth.kinds || []);
  if (!guard.ok) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO lead_comments (lead_id, author_id, body)
            VALUES ($1, $2, $3)
         RETURNING id, body, created_at, author_id`,
      [idNum, auth.moderatorId, text],
    );
    return Response.json(
      {
        ...rows[0],
        author_email: auth.email,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/leads/:id/comments]", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
