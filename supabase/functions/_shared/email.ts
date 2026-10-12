// Utilitários compartilhados pelas Edge Functions: envio via Resend + template HTML.

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TZ = Deno.env.get("BARBER_TIMEZONE") ?? "America/Sao_Paulo";

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(iso));
}
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function formatPrice(cents: number, suffix?: string | null) {
  const v = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  return suffix ? `${v}${suffix}` : v;
}

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface BookingSummary {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  starts_at: string;
  service_name: string;
  service_duration: number;
  service_price: string;
}

type Kind = "confirmation" | "reminder" | "cancellation";

const COPY: Record<Kind, { subject: (b: BookingSummary) => string; title: string; intro: string }> = {
  confirmation: {
    subject: (b) => `Agendamento confirmado — ${b.service_name}, ${formatDate(b.starts_at)} às ${formatTime(b.starts_at)}`,
    title: "Horário confirmado",
    intro: "Seu horário está reservado. Aqui está o resumo do que foi marcado:",
  },
  reminder: {
    subject: (b) => `Lembrete: seu horário é hoje às ${formatTime(b.starts_at)}`,
    title: "Falta 1 hora",
    intro: "Passando pra lembrar do seu horário daqui a pouco:",
  },
  cancellation: {
    subject: (b) => `Agendamento cancelado — ${formatDate(b.starts_at)} às ${formatTime(b.starts_at)}`,
    title: "Agendamento cancelado",
    intro: "Seu agendamento foi cancelado e o horário foi liberado. Quando quiser, é só marcar de novo:",
  },
};

export function renderEmail(kind: Kind, b: BookingSummary) {
  const site = Deno.env.get("SITE_URL") ?? "";
  const address = Deno.env.get("BARBER_ADDRESS") ?? "";
  const c = COPY[kind];
  const row = (k: string, v: string) =>
    `<tr><td style="padding:10px 0;color:#8a8a96;font-size:13px;width:110px">${k}</td><td style="padding:10px 0;color:#ececf1;font-size:15px;font-weight:600">${esc(v)}</td></tr>`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0a0a0f;font-family:Inter,Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#13131a;border:1px solid #26262f;border-radius:20px;overflow:hidden">
    <tr><td align="center" style="padding:32px 24px 8px">${site ? `<img src="${site}/assets/logo-sm.png" alt="Lone Barbershop" width="70" style="display:block;height:auto">` : ""}
      <p style="margin:14px 0 0;color:#d4a017;letter-spacing:.2em;font-size:11px;text-transform:uppercase">Lone Barbershop</p>
      <h1 style="margin:8px 0 0;color:#ececf1;font-size:26px;font-family:'Space Grotesk',Arial,sans-serif">${c.title}</h1></td></tr>
    <tr><td style="padding:16px 32px 8px;color:#b8b8c4;font-size:15px;line-height:1.6">Olá, ${esc(b.customer_name.split(" ")[0])}! ${c.intro}</td></tr>
    <tr><td style="padding:0 32px"><table role="presentation" width="100%" style="border-top:1px solid #26262f;border-bottom:1px solid #26262f">
      ${row("Serviço", b.service_name)}
      ${row("Data", formatDate(b.starts_at))}
      ${row("Hora", formatTime(b.starts_at))}
      ${row("Duração", `${b.service_duration} min`)}
      ${row("Valor", b.service_price)}
      ${address ? row("Local", address) : ""}
    </table></td></tr>
    <tr><td align="center" style="padding:28px 32px">${site ? `<a href="${site}/#agendar" style="display:inline-block;background:linear-gradient(135deg,#e6b52c,#b8860b);color:#1a1405;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${kind === "cancellation" ? "Marcar novo horário" : "Ver ou cancelar agendamento"}</a>` : ""}</td></tr>
    <tr><td style="padding:0 32px 28px;color:#6e6e7a;font-size:12px;line-height:1.5;text-align:center">Precisa remarcar? Cancele pelo site e o horário volta pra agenda na hora.</td></tr>
  </table></td></tr></table></body></html>`;

  const text = [
    `${c.title} — Lone Barbershop`, "", `Olá, ${b.customer_name}! ${c.intro}`, "",
    `Serviço: ${b.service_name}`, `Data: ${formatDate(b.starts_at)}`, `Hora: ${formatTime(b.starts_at)}`,
    `Duração: ${b.service_duration} min`, `Valor: ${b.service_price}`, address ? `Local: ${address}` : "",
    "", site ? `${site}/#agendar` : "",
  ].join("\n");

  return { subject: c.subject(b), html, text };
}

export async function sendEmail(to: string, kind: Kind, b: BookingSummary) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  const from = Deno.env.get("EMAIL_FROM") ?? "Lone Barbershop <onboarding@resend.dev>";
  const { subject, html, text } = renderEmail(kind, b);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, reply_to: Deno.env.get("EMAIL_REPLY_TO") || undefined }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

// deno-lint-ignore no-explicit-any
export function toSummary(row: any): BookingSummary {
  return {
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    starts_at: row.time_slots.starts_at,
    service_name: row.services.name,
    service_duration: row.services.duration_min,
    service_price: formatPrice(row.services.price_cents, row.services.price_suffix),
  };
}

export const BOOKING_SELECT =
  "id, user_id, status, customer_name, customer_email, customer_phone, confirmation_sent_at, reminder_sent_at, cancelled_at," +
  " time_slots!inner(starts_at, ends_at), services!inner(name, duration_min, price_cents, price_suffix)";
