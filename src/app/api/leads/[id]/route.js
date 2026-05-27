import pool from "@/lib/db";
import { requireModerator } from "@/lib/auth";

const ALLOWED_STATUSES = new Set(["new", "in_progress", "done", "rejected"]);

// PATCH /api/leads/:id — модератор меняет статус заявки.
// Доступ ограничен kind'ами модератора.
export async function PATCH(request, { params }) {
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

  const status = body?.status;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return Response.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  if (!auth.kinds || auth.kinds.length === 0) {
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  }

  try {
    // Проверяем что заявка существует и её kind в разрешённых.
    const { rows: leadRows } = await pool.query(
      "SELECT id, kind FROM leads WHERE id = $1",
      [idNum],
    );
    if (leadRows.length === 0) {
      return Response.json({ error: "Заявка не найдена" }, { status: 404 });
    }
    if (!auth.kinds.includes(leadRows[0].kind)) {
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    }

    const updates = ["status = $1"];
    const args = [status];

    if (status === "done" || status === "rejected") {
      args.push(auth.moderatorId);
      updates.push(`processed_by = $${args.length}`);
      updates.push(`processed_at = NOW()`);
    } else if (status === "new") {
      updates.push(`processed_at = NULL`);
      updates.push(`processed_by = NULL`);
    }

    args.push(idNum);

    const { rows } = await pool.query(
      `UPDATE leads
          SET ${updates.join(", ")}
        WHERE id = $${args.length}
        RETURNING id, kind, status, processed_by, processed_at, updated_at`,
      args,
    );
    return Response.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /api/leads/:id]", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
