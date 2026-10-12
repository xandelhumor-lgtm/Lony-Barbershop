// =====================================================================
// Camada de dados: Supabase (produção) ou memória (modo demonstração).
// Toda a UI fala só com este módulo.
// =====================================================================
import { DEMO_SERVICES } from "./data.js";

const CFG = window.LONE_CONFIG || {};
export const config = {
  url: CFG.SUPABASE_URL || "",
  anonKey: CFG.SUPABASE_ANON_KEY || "",
  timezone: CFG.TIMEZONE || "America/Sao_Paulo",
  address: CFG.BARBER_ADDRESS || "",
  instagram: CFG.INSTAGRAM_URL || "",
};
export const isDemo = !config.url || !config.anonKey || config.url.includes("YOUR_");

// Traduz erros comuns do Supabase para PT-BR
function friendly(err) {
  const m = (err && (err.message || err.error_description || err.msg)) || String(err);
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/User already registered/i.test(m)) return "Esse e-mail já tem conta. Use a aba Entrar.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor. Verifique sua internet.";
  return m;
}
const wrap = async (p) => { const { data, error } = await p; if (error) throw new Error(friendly(error)); return data; };

// ---------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------
async function createSupabaseApi() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  return {
    async getServices() {
      return wrap(sb.from("services").select("*").eq("active", true).order("sort"));
    },
    async getFreeSlots(fromISO, toISO) {
      // RLS já garante: só horários "livre" e futuros chegam aqui
      return wrap(sb.from("time_slots").select("id, starts_at, ends_at")
        .gte("starts_at", fromISO).lt("starts_at", toISO).order("starts_at"));
    },
    async getSession() { return (await sb.auth.getSession()).data.session; },
    onAuthChange(cb) { sb.auth.onAuthStateChange((_e, session) => cb(session)); },
    async signIn(email, password) { return wrap(sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password, name) {
      const data = await wrap(sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: location.origin + "/#agendar" } }));
      return { needsConfirmation: !data.session };
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { return wrap(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin })); },

    async book({ slotId, serviceId, name, email, phone }) {
      const booking = await wrap(sb.rpc("book_slot", {
        p_slot_id: slotId, p_service_id: serviceId, p_name: name, p_email: email, p_phone: phone,
      }));
      // Dispara o e-mail de confirmação logo após o insert
      const emailResult = await sb.functions.invoke("send-confirmation", { body: { booking_id: booking.id, type: "confirmation" } });
      return { booking, emailSent: !emailResult.error };
    },
    async cancel(bookingId) {
      const booking = await wrap(sb.rpc("cancel_booking", { p_booking_id: bookingId }));
      sb.functions.invoke("send-confirmation", { body: { booking_id: bookingId, type: "cancellation" } }).catch(() => {});
      return booking;
    },
    async myBookings() {
      return wrap(sb.from("bookings")
        .select("id, status, service_id, customer_name, customer_email, customer_phone, created_at, time_slots(starts_at, ends_at), services(name, duration_min, price_cents, price_suffix)")
        .order("created_at", { ascending: false }).limit(30));
    },
    async sendContact(msg) {
      return wrap(sb.from("contact_messages").insert({
        name: msg.name, email: msg.email, service_id: msg.service || null, message: msg.message,
      }));
    },
  };
}

// ---------------------------------------------------------------------
// Demonstração (sem backend) — mesmo contrato
// ---------------------------------------------------------------------
function createDemoApi() {
  const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
  const slots = [];
  const now = new Date();
  for (let d = 0; d < 21; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (![2, 3, 4, 5, 6].includes(day.getDay())) continue;
    for (let h = 9; h < 19; h++) {
      const s = new Date(day); s.setHours(h, 0, 0, 0);
      if (s <= now) continue;
      // pseudo-aleatório determinístico: ~35% ocupado
      const busy = ((d * 31 + h * 17) % 100) < 35;
      slots.push({ id: `s-${s.getTime()}`, starts_at: s.toISOString(), ends_at: new Date(s.getTime() + 3600e3).toISOString(), status: busy ? "ocupado" : "livre" });
    }
  }
  const bookings = [];
  let session = null;
  const listeners = [];
  const emit = () => listeners.forEach((cb) => cb(session));

  return {
    async getServices() { await wait(250); return DEMO_SERVICES; },
    async getFreeSlots(fromISO, toISO) {
      await wait(200);
      return slots.filter((s) => s.status === "livre" && s.starts_at >= fromISO && s.starts_at < toISO && new Date(s.starts_at) > new Date())
        .map(({ id, starts_at, ends_at }) => ({ id, starts_at, ends_at }));
    },
    async getSession() { return session; },
    onAuthChange(cb) { listeners.push(cb); },
    async signIn(email) { await wait(); session = { user: { id: "demo", email, user_metadata: {} } }; emit(); return session; },
    async signUp(email, _p, name) { await wait(); session = { user: { id: "demo", email, user_metadata: { full_name: name } } }; emit(); return { needsConfirmation: false }; },
    async signOut() { session = null; emit(); },
    async resetPassword() { await wait(); },
    async book({ slotId, serviceId, name, email, phone }) {
      await wait(700);
      const slot = slots.find((s) => s.id === slotId);
      if (!slot || slot.status !== "livre") throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
      slot.status = "ocupado";
      const svc = DEMO_SERVICES.find((s) => s.id === serviceId);
      const booking = { id: `b-${Date.now()}`, status: "confirmado", service_id: serviceId, customer_name: name, customer_email: email, customer_phone: phone, created_at: new Date().toISOString(), slot_id: slotId, time_slots: { starts_at: slot.starts_at, ends_at: slot.ends_at }, services: svc };
      bookings.unshift(booking);
      return { booking, emailSent: true };
    },
    async cancel(id) {
      await wait();
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status !== "confirmado") throw new Error("Esse agendamento já foi cancelado.");
      b.status = "cancelado";
      const slot = slots.find((s) => s.id === b.slot_id); if (slot) slot.status = "livre";
      return b;
    },
    async myBookings() { await wait(250); return bookings; },
    async sendContact() { await wait(600); },
  };
}

export const api = isDemo ? createDemoApi() : await createSupabaseApi();
