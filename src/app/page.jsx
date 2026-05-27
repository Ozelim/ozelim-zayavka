"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  MessageSquare,
  Map,
  Calculator,
  HandCoins,
  Scale,
  ShieldCheck,
  Plane,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Mail,
  MessageCircle,
  User,
  Calendar,
  MapPin,
  LogOut,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

const KIND_META = {
  tour_request:      { label: "Оставленные заявки", icon: Map },
  tour_calculator:   { label: "Калькулятор туров",  icon: Calculator },
  tour_booking:      { label: "Записи туров",       icon: Map },
  endowment:         { label: "Эндаумент",          icon: HandCoins },
  legal_consult:     { label: "Юр. услуги",         icon: Scale },
  insurance_request: { label: "Страхование",        icon: ShieldCheck },
  tickets_request:   { label: "Билеты",             icon: Plane },
};

const STATUS_TABS = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Обработано" },
  { value: "rejected", label: "Отклонено" },
];

const STATUS_META = {
  new:         { label: "Новая",      variant: "warning",     icon: Clock },
  in_progress: { label: "В работе",   variant: "blue",        icon: Loader2 },
  done:        { label: "Обработана", variant: "default",     icon: CheckCircle2 },
  rejected:    { label: "Отклонена",  variant: "destructive", icon: XCircle },
};

const CONTACT_ICON = {
  whatsapp: MessageCircle,
  telegram: MessageCircle,
  phone: Phone,
  email: Mail,
};

const PAGE_SIZE = 20;
const POLL_MS = 20000;

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yy}. ${hh}:${mi}`;
}

function kindLabel(kind) {
  return KIND_META[kind]?.label ?? kind;
}

function summary(lead) {
  const d = lead.data || {};
  switch (lead.kind) {
    case "tour_request": {
      const dir = d.directionName || lead.resort_direction_name;
      const adults = d.adults ?? 0;
      const children = d.children ?? 0;
      const dur = d.durationDays ? `${d.durationDays} дн.` : null;
      const parts = [dir];
      if (adults || children) parts.push(`${adults}+${children} чел.`);
      if (dur) parts.push(dur);
      return parts.filter(Boolean).join(" · ") || "—";
    }
    case "tour_calculator": {
      const dir = d.directionName || lead.resort_direction_name;
      const base = d.baseName || lead.resort_base_name;
      const total = d.totalPrice
        ? `${Number(d.totalPrice).toLocaleString("ru-RU")} ₸`
        : null;
      return [dir, base, total].filter(Boolean).join(" · ") || "—";
    }
    case "tour_booking":
      return d.tourTitle || lead.tour_title || "Тур";
    case "endowment":
      return d.investType || "Эндаумент";
    case "legal_consult":
    case "insurance_request":
    case "tickets_request":
      return d.topic || lead.message || kindLabel(lead.kind);
    default:
      return "—";
  }
}

function authorName(c) {
  return (
    [c.author_name, c.author_surname].filter(Boolean).join(" ") ||
    c.author_email ||
    "Модератор"
  );
}

export default function ZayavkaPage() {
  const router = useRouter();
  const [allowedKinds, setAllowedKinds] = useState([]);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryData, setSummaryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const reqRef = useRef(0);

  const fetchData = useCallback(
    async (silent = false) => {
      const reqId = ++reqRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        if (kind !== "all") params.set("kind", kind);
        if (status !== "all") params.set("status", status);
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));

        const res = await fetch(`/api/leads?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Ошибка ${res.status}`);
        }
        const json = await res.json();
        if (reqId !== reqRef.current) return;
        setRows(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setSummaryData(json.summary || {});
        setAllowedKinds(json.allowedKinds || []);
      } catch (err) {
        if (reqId !== reqRef.current) return;
        toast.error("Не удалось загрузить заявки", err.message);
      } finally {
        if (reqId === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [kind, status, search, page],
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => fetchData(true), POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  function changeKind(next) {
    setKind(next);
    setPage(1);
  }
  function changeStatus(next) {
    setStatus(next);
    setPage(1);
  }

  async function fetchComments(leadId) {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/comments`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`);
      setComments(Array.isArray(json) ? json : []);
    } catch (err) {
      toast.error("Не удалось загрузить комментарии", err.message);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  function openLead(row) {
    setSelected(row);
    setCommentDraft("");
    setComments([]);
    fetchComments(row.id);
  }

  async function sendComment() {
    if (!selected) return;
    const text = commentDraft.trim();
    if (!text) return;
    setCommentSending(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`);
      setComments((prev) => [...prev, json]);
      setCommentDraft("");
      // Обновляем счётчик в списке
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, comments_count: (r.comments_count || 0) + 1 }
            : r,
        ),
      );
    } catch (err) {
      toast.error("Не удалось отправить", err.message);
    } finally {
      setCommentSending(false);
    }
  }

  async function changeLeadStatus(nextStatus) {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`);
      toast.success("Статус обновлён", STATUS_META[nextStatus]?.label || nextStatus);
      setSelected((prev) => (prev ? { ...prev, ...json } : prev));
      fetchData(true);
    } catch (err) {
      toast.error("Не удалось обновить", err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Не удалось выйти");
    }
  }

  const kindTabs = useMemo(() => {
    const tabs = [{ value: "all", label: "Все", icon: MessageSquare }];
    for (const k of allowedKinds) {
      tabs.push({ value: k, label: KIND_META[k]?.label || k, icon: KIND_META[k]?.icon || MessageSquare });
    }
    return tabs;
  }, [allowedKinds]);

  const stats = useMemo(() => {
    const s = summaryData.__all__ || { new: 0, in_progress: 0, done: 0, total: 0 };
    return [
      { label: "Всего",      value: s.total,       icon: MessageSquare },
      { label: "Новых",      value: s.new,         icon: Clock },
      { label: "В работе",   value: s.in_progress, icon: Loader2 },
      { label: "Обработано", value: s.done,        icon: CheckCircle2 },
    ];
  }, [summaryData]);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-green-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-green-900 leading-none">
                Кабинет заявок
              </h1>
              <p className="text-xs text-green-500 mt-1">
                Доступно типов: {allowedKinds.length}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {allowedKinds.length === 0 && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Администратор пока не выдал вам доступ ни к одному типу заявок.
            Обратитесь к нему, чтобы получить права.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-green-500 font-medium uppercase tracking-wide">
                      {s.label}
                    </p>
                    <p className="text-xl font-bold text-green-900 mt-0.5">
                      {s.value}
                    </p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-green-100 text-green-700">
                    <s.icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Список заявок</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Поиск: имя, телефон, email, ID..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-green-200 bg-white text-green-900 placeholder-green-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="gap-2"
                >
                  <RefreshCw
                    className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"}
                  />
                  Обновить
                </Button>
              </div>
            </div>

            {kindTabs.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {kindTabs.map((t) => {
                  const Icon = t.icon;
                  const cnt =
                    t.value === "all"
                      ? summaryData.__all__?.total ?? 0
                      : summaryData[t.value]?.total ?? 0;
                  return (
                    <button
                      key={t.value}
                      onClick={() => changeKind(t.value)}
                      className={
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors " +
                        (kind === t.value
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-white border-green-200 text-green-700 hover:bg-green-50")
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                      <span className={kind === t.value ? "opacity-90" : "opacity-60"}>
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {STATUS_TABS.map((t) => {
                const allStats = summaryData.__all__ || {};
                const cnt =
                  t.value === "all" ? allStats.total ?? 0 : allStats[t.value] ?? 0;
                return (
                  <button
                    key={t.value}
                    onClick={() => changeStatus(t.value)}
                    className={
                      "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors " +
                      (status === t.value
                        ? "bg-green-100 border-green-300 text-green-800"
                        : "bg-white border-green-200 text-green-600 hover:bg-green-50")
                    }
                  >
                    {t.label}
                    <span className={status === t.value ? "opacity-90" : "opacity-60"}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent>
            {loading && rows.length === 0 ? (
              <div className="text-center py-10 text-green-500">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                Загрузка...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-green-500">
                Заявок не найдено
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((lead) => {
                  const meta = STATUS_META[lead.status] || STATUS_META.new;
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => openLead(lead)}
                      className="w-full text-left flex items-start gap-4 px-4 py-3 rounded-lg border border-green-100 hover:bg-green-50 hover:border-green-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm flex-shrink-0">
                        {(lead.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-green-900 text-sm truncate">
                            {lead.name || "—"}
                          </p>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <span className="text-[11px] uppercase tracking-wider text-green-500">
                            {kindLabel(lead.kind)}
                          </span>
                          {lead.comments_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-600">
                              <MessageCircle className="w-3 h-3" />
                              {lead.comments_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-green-600 mt-0.5 truncate">
                          {summary(lead)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-green-500 mt-1 flex-wrap">
                          {lead.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </span>
                          )}
                          {lead.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {lead.email}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{" "}
                            {formatDate(lead.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-green-100">
                <p className="text-xs text-green-500">
                  Страница {page} из {totalPages} · всего {total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(page - 1)}
                  >
                    Назад
                  </Button>
                  <span className="px-2 text-xs text-green-700">{page}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage(page + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setSelected(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Заявка №{selected.id}
                  <Badge variant={STATUS_META[selected.status]?.variant}>
                    {STATUS_META[selected.status]?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {kindLabel(selected.kind)} · {formatDate(selected.created_at)}
                </DialogDescription>
              </DialogHeader>

              <LeadDetails lead={selected} />

              <div className="space-y-2 pt-2 border-t border-green-100">
                <p className="text-xs uppercase tracking-wider text-green-500 font-medium">
                  Комментарии
                </p>
                {commentsLoading ? (
                  <div className="text-sm text-green-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                    Загрузка...
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-green-400 py-1">
                    Комментариев пока нет
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-green-100 bg-green-50/50 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-green-600">
                          <span className="font-semibold">{authorName(c)}</span>
                          <span>{formatDate(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-green-900 mt-1 whitespace-pre-wrap break-words">
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 pt-1">
                  <textarea
                    rows={2}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Написать комментарий..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-green-200 bg-white text-green-900 placeholder-green-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <Button
                    size="sm"
                    onClick={sendComment}
                    disabled={commentSending || !commentDraft.trim()}
                    className="gap-1"
                  >
                    {commentSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Отправить
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-green-100">
                {selected.status !== "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => changeLeadStatus("in_progress")}
                  >
                    Взять в работу
                  </Button>
                )}
                {selected.status !== "done" && (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={actionLoading}
                    onClick={() => changeLeadStatus("done")}
                  >
                    Отметить обработанной
                  </Button>
                )}
                {selected.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionLoading}
                    onClick={() => changeLeadStatus("rejected")}
                  >
                    Отклонить
                  </Button>
                )}
                {selected.status !== "new" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionLoading}
                    onClick={() => changeLeadStatus("new")}
                  >
                    Вернуть в новые
                  </Button>
                )}
                {actionLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-green-500 ml-2 self-center" />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadDetails({ lead }) {
  const Icon = CONTACT_ICON[lead.contact_method] || User;
  const d = lead.data || {};
  const dataEntries = Object.entries(d).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <DetailItem icon={User} label="Имя" value={lead.name} />
        <DetailItem icon={Icon} label="Связь" value={lead.contact_method || "—"} />
        <DetailItem icon={Phone} label="Телефон" value={lead.phone} />
        <DetailItem icon={Mail} label="Email" value={lead.email} />
      </div>

      {(lead.tour_title || lead.resort_direction_name || lead.resort_base_name) && (
        <div className="bg-green-50 rounded-lg p-3 space-y-1 text-xs">
          {lead.tour_title && (
            <DetailRow label="Тур / курорт" value={lead.tour_title} />
          )}
          {lead.resort_direction_name && (
            <DetailRow
              label="Направление"
              value={lead.resort_direction_name}
              icon={MapPin}
            />
          )}
          {lead.resort_base_name && (
            <DetailRow label="База" value={lead.resort_base_name} />
          )}
        </div>
      )}

      {dataEntries.length > 0 && (
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs uppercase tracking-wider text-green-500 font-medium mb-2">
            Детали заявки
          </p>
          <div className="space-y-1.5 text-xs">
            {dataEntries.map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-green-500 shrink-0 pt-0.5 w-28">{key}</span>
                <span className="text-green-900 font-medium break-all">
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lead.message && (
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs uppercase tracking-wider text-green-500 font-medium mb-1">
            Сообщение
          </p>
          <p className="text-green-900 whitespace-pre-wrap">{lead.message}</p>
        </div>
      )}

      {lead.admin_note && (
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <p className="text-xs uppercase tracking-wider text-yellow-700 font-medium mb-1">
            Заметка администратора
          </p>
          <p className="text-yellow-900 whitespace-pre-wrap text-sm">
            {lead.admin_note}
          </p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-green-700">
      <Icon className="w-4 h-4 text-green-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-green-500">
          {label}
        </div>
        <div className="text-sm truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-green-600 inline-flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </span>
      <span className="text-green-900 text-sm">{value}</span>
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((v) =>
        typeof v === "object" && v?.name
          ? v.name
          : typeof v === "object"
          ? JSON.stringify(v)
          : String(v),
      )
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString("ru-RU");
  return String(value);
}
