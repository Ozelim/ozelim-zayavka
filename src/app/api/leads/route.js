import pool from "@/lib/db";
import { requireModerator } from "@/lib/auth";

const ALLOWED_KINDS = new Set([
  "tour_request",
  "tour_calculator",
  "tour_booking",
  "endowment",
  "legal_consult",
  "insurance_request",
  "tickets_request",
]);
const ALLOWED_STATUSES = new Set(["new", "in_progress", "done", "rejected"]);

// GET /api/leads?kind=&status=&search=&page=&limit=
// Возвращает только заявки тех kind'ов, к которым у модератора есть доступ.
export async function GET(request) {
  const auth = await requireModerator();
  if (!auth.ok) return auth.response;

  // У модератора нет ни одного разрешённого kind — отдаём пустой результат.
  if (!auth.kinds || auth.kinds.length === 0) {
    return Response.json({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
      summary: {},
      allowedKinds: [],
    });
  }

  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind");
  const status = searchParams.get("status");
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
  );
  const offset = (page - 1) * limit;

  // Если выбран конкретный kind — он должен быть в разрешённых, иначе игнорим
  // и отдаём по всему доступному набору.
  const effectiveKinds =
    kindParam && ALLOWED_KINDS.has(kindParam) && auth.kinds.includes(kindParam)
      ? [kindParam]
      : auth.kinds;

  const conditions = [];
  const args = [];

  args.push(effectiveKinds);
  conditions.push(`l.kind = ANY($${args.length}::text[])`);

  if (status && ALLOWED_STATUSES.has(status)) {
    args.push(status);
    conditions.push(`l.status = $${args.length}`);
  }
  if (search) {
    args.push(`%${search}%`);
    const like = args.length;
    args.push(search);
    const exact = args.length;
    conditions.push(
      `(l.name ILIKE $${like}
        OR l.phone ILIKE $${like}
        OR l.email ILIKE $${like}
        OR l.message ILIKE $${like}
        OR CAST(l.id AS TEXT) = $${exact})`,
    );
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  try {
    const dataSql = `
      SELECT l.id, l.kind, l.status,
             l.name, l.phone, l.email, l.contact_method, l.message,
             l.user_id, l.tour_id, l.resort_direction_id, l.resort_base_id,
             l.data, l.source, l.admin_note, l.note_date,
             l.processed_by, l.processed_at,
             l.created_at, l.updated_at,
             t.title  AS tour_title,
             rd.name  AS resort_direction_name,
             rb.name  AS resort_base_name,
             (SELECT COUNT(*)::int FROM lead_comments lc WHERE lc.lead_id = l.id)
                      AS comments_count
        FROM leads l
        LEFT JOIN tours              t  ON t.id  = l.tour_id
        LEFT JOIN resort_directions  rd ON rd.id = l.resort_direction_id
        LEFT JOIN resort_bases       rb ON rb.id = l.resort_base_id
        ${where}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT $${args.length + 1} OFFSET $${args.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM leads l ${where}`;
    const summarySql = `
      SELECT kind, status, COUNT(*)::int AS cnt
        FROM leads
       WHERE kind = ANY($1::text[])
       GROUP BY kind, status
    `;

    const [{ rows }, { rows: countRows }, { rows: summaryRows }] =
      await Promise.all([
        pool.query(dataSql, [...args, limit, offset]),
        pool.query(countSql, args),
        pool.query(summarySql, [auth.kinds]),
      ]);

    const total = countRows[0]?.total ?? 0;

    const summary = {};
    for (const k of auth.kinds) {
      summary[k] = { new: 0, in_progress: 0, done: 0, rejected: 0, total: 0 };
    }
    summary.__all__ = { new: 0, in_progress: 0, done: 0, rejected: 0, total: 0 };
    for (const r of summaryRows) {
      if (!summary[r.kind]) continue;
      summary[r.kind][r.status] = r.cnt;
      summary[r.kind].total += r.cnt;
      summary.__all__[r.status] += r.cnt;
      summary.__all__.total += r.cnt;
    }

    return Response.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
      allowedKinds: auth.kinds,
    });
  } catch (err) {
    console.error("[GET /api/leads]", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
