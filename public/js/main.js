// =====================================================================
// Lone Barbershop — interface
// =====================================================================
import { api, config, isDemo } from "./api.js";
import { PORTFOLIO, TESTIMONIALS, SERVICE_ICONS, SERVICE_EXTRAS } from "./data.js";

document.documentElement.classList.remove("no-js");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TZ = config.timezone;

// ---------- Formatação ----------
const fmtDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtWeek = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });
const fmtDayNum = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit" });
const fmtMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "short" });
const fmtLong = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const dayKey = (d) => fmtDayKey.format(new Date(d));
const time = (d) => fmtTime.format(new Date(d));
const longDate = (d) => { const s = fmtLong.format(new Date(d)); return s.charAt(0).toUpperCase() + s.slice(1); };
const price = (s) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: s.price_cents % 100 ? 2 : 0 }).format(s.price_cents / 100);

// ---------- Toasts ----------
function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast ${type ? "toast--" + type : ""}`;
  t.textContent = msg;
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 320); }, 4200);
}

// ---------- Estado ----------
const state = {
  services: [],
  session: null,
  slots: [],              // horários livres (21 dias)
  days: [],               // [{ key, date, slots: [] }]
  dayIndex: 0,
  slot: null,
  pendingSubmit: false,
  lastBooking: null,
};

// =====================================================================
// Logo: fallback em texto se a imagem falhar
// =====================================================================
$$("[data-logo-fallback]").forEach((img) => {
  const fail = () => {
    const pic = img.closest("picture");
    const span = document.createElement("span");
    span.className = "logo-fallback";
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", "Lone Barbershop");
    span.textContent = "LB";
    pic.replaceChildren(span);
  };
  if (img.complete && img.naturalWidth === 0) fail(); else img.addEventListener("error", fail, { once: true });
});

// =====================================================================
// Header, menu e navegação ativa
// =====================================================================
const header = $("#header");
const fab = $("#fab");
const onScroll = () => {
  const y = scrollY;
  header.classList.toggle("is-scrolled", y > 24);
  header.classList.toggle("is-top", y < innerHeight * 0.45);
  const bookingRect = $("#agendar").getBoundingClientRect();
  const inBooking = bookingRect.top < innerHeight && bookingRect.bottom > 0;
  const contactTop = $("#contato").getBoundingClientRect().top;
  fab.classList.toggle("is-visible", y > innerHeight * 0.8 && !inBooking && contactTop > innerHeight * 0.6);
};
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const burger = $("#burger"), nav = $("#nav");
const closeNav = () => { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); };
burger.addEventListener("click", () => {
  const open = !nav.classList.contains("is-open");
  nav.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", (e) => e.target.closest("a") && closeNav());

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) $$(".nav a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
["servicos", "portfolio", "processo", "depoimentos", "contato"].forEach((id) => navObserver.observe(document.getElementById(id)));

// =====================================================================
// Animações de scroll (Intersection Observer)
// =====================================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-visible"); revealObserver.unobserve(en.target); }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
const observeReveals = (root = document) => $$(".reveal:not(.is-visible)", root).forEach((el) => revealObserver.observe(el));
observeReveals();

// =====================================================================
// Serviços (fonte única → seção, agendamento e contato)
// =====================================================================
function renderServices() {
  const grid = $("#servicesGrid");
  grid.innerHTML = state.services.map((s, i) => `
    <article class="card service reveal ${s.highlight ? "service--highlight" : ""}" style="--d:${(i % 3) * 0.07}s">
      <div class="service__top">
        <span class="service__icon">${SERVICE_ICONS[s.id] || SERVICE_ICONS.corte}</span>
        ${s.highlight ? '<span class="service__badge">Mais pedido</span>' : ""}
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      ${s.highlight ? `<ul class="service__list">${(SERVICE_EXTRAS[s.id] || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="service__meta">
        <span class="service__price">${price(s)}${s.price_suffix ? `<small>${esc(s.price_suffix)}</small>` : ""}</span>
        <span class="service__dur">${s.duration_min} min</span>
      </div>
      <button class="btn ${s.highlight ? "btn--primary" : "btn--ghost"} btn--block" data-book-service="${esc(s.id)}">Agendar ${esc(s.name.toLowerCase())}</button>
    </article>`).join("");
  observeReveals(grid);

  const opts = state.services.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} — ${price(s)}${s.price_suffix || ""}</option>`).join("");
  $("#bookingService").innerHTML = `<option value="" disabled selected>Selecione o serviço</option>${opts}`;
  $("#contactService").innerHTML = `<option value="">Ainda não sei</option>${opts}`;
}

function goBookWithService(serviceId) {
  if (serviceId) $("#bookingService").value = serviceId;
  updateTotal();
  document.getElementById("agendar").scrollIntoView({ behavior: "smooth" });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-book-service]");
  if (b) goBookWithService(b.dataset.bookService);
});

// =====================================================================
// Portfólio + lightbox
// =====================================================================
const PH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/></svg>';
const placeholder = (label) => `<div class="ph">${PH_SVG}${label ? `<span>${esc(label)}</span>` : ""}</div>`;
const imgSrc = (src, w) => src.includes("images.unsplash.com") ? `${src}&w=${w}` : src;

function renderPortfolio() {
  const cats = ["Todos", ...new Set(PORTFOLIO.map((p) => p.category))];
  $("#portfolioFilters").innerHTML = cats.map((c, i) =>
    `<button class="chip ${i === 0 ? "is-active" : ""}" role="tab" aria-selected="${i === 0}" data-filter="${esc(c)}">${esc(c)}</button>`).join("");

  const grid = $("#portfolioGrid");
  grid.innerHTML = PORTFOLIO.map((p, i) => `
    <button class="work ${p.size ? "work--" + p.size : ""} reveal" style="--d:${(i % 5) * 0.05}s" data-index="${i}" data-cat="${esc(p.category)}" aria-label="Ver em tela cheia: ${esc(p.title)}">
      <img src="${esc(imgSrc(p.src, 700))}" srcset="${esc(imgSrc(p.src, 450))} 450w, ${esc(imgSrc(p.src, 700))} 700w, ${esc(imgSrc(p.src, 1000))} 1000w" sizes="(min-width:1200px) 20vw, (min-width:900px) 25vw, 50vw" alt="${esc(p.title)} — ${esc(p.category)}" loading="lazy" decoding="async">
      <span class="work__zoom glass" aria-hidden="true">⤢</span>
      <span class="work__info"><span class="tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3></span>
    </button>`).join("");
  $$("img", grid).forEach((img) => img.addEventListener("error", () => img.replaceWith(Object.assign(document.createElement("div"), { innerHTML: placeholder("") }).firstChild), { once: true }));
  observeReveals(grid);

  $("#portfolioFilters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    $$(".chip").forEach((c) => { c.classList.toggle("is-active", c === chip); c.setAttribute("aria-selected", String(c === chip)); });
    const f = chip.dataset.filter;
    $$(".work", grid).forEach((w) => { w.classList.toggle("is-hidden", f !== "Todos" && w.dataset.cat !== f); w.classList.add("is-visible"); });
  });
  grid.addEventListener("click", (e) => { const w = e.target.closest(".work"); if (w) openLightbox(+w.dataset.index); });
}

const lb = $("#lightbox");
let lbIndex = 0, lbLastFocus = null;
const visibleWorks = () => $$("#portfolioGrid .work:not(.is-hidden)").map((w) => +w.dataset.index);

function showLb(i) {
  lbIndex = i;
  const p = PORTFOLIO[i];
  const fig = $(".lightbox__figure");
  const old = $("#lbImg, .lightbox__figure > .ph", fig);
  const img = document.createElement("img");
  img.id = "lbImg"; img.alt = `${p.title} — ${p.category}`;
  img.src = imgSrc(p.src, 1600);
  img.addEventListener("error", () => img.replaceWith(Object.assign(document.createElement("div"), { innerHTML: placeholder(p.category) }).firstChild), { once: true });
  old.replaceWith(img);
  $("#lbTag").textContent = p.category;
  $("#lbTitle").textContent = p.title;
  $("#lbDesc").textContent = p.description;
  const list = visibleWorks();
  $("#lbCount").textContent = `${list.indexOf(i) + 1} / ${list.length}`;
  // pré-carrega vizinhos
  [list[(list.indexOf(i) + 1) % list.length], list[(list.indexOf(i) - 1 + list.length) % list.length]]
    .forEach((n) => { const im = new Image(); im.src = imgSrc(PORTFOLIO[n].src, 1600); });
}
function openLightbox(i) {
  lbLastFocus = document.activeElement;
  lb.hidden = false; document.body.style.overflow = "hidden";
  showLb(i); $(".lightbox__close").focus();
}
function closeLightbox() { lb.hidden = true; document.body.style.overflow = ""; lbLastFocus?.focus(); }
function stepLb(dir) { const l = visibleWorks(); showLb(l[(l.indexOf(lbIndex) + dir + l.length) % l.length]); }
$("#lbPrev").addEventListener("click", () => stepLb(-1));
$("#lbNext").addEventListener("click", () => stepLb(1));
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.closest("[data-close]")) closeLightbox(); });
$("#lbBook").addEventListener("click", () => { closeLightbox(); goBookWithService(PORTFOLIO[lbIndex].service); });
let touchX = null;
lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (e) => { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1); touchX = null; });

// =====================================================================
// Depoimentos
// =====================================================================
function renderTestimonials() {
  const hues = [38, 28, 46];
  $("#testimonialsGrid").innerHTML = TESTIMONIALS.map((t, i) => {
    const initials = t.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
    return `<figure class="card quote reveal" style="--d:${i * 0.08}s">
      <div class="quote__stars" aria-label="${t.stars} de 5 estrelas">${"★".repeat(t.stars)}</div>
      <blockquote>“${esc(t.text)}”</blockquote>
      <figcaption>
        <span class="avatar" style="background:linear-gradient(135deg,hsl(${hues[i % 3]} 70% 62%),hsl(${hues[i % 3]} 75% 38%))" aria-hidden="true">${esc(initials)}</span>
        <span><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></span>
      </figcaption>
    </figure>`;
  }).join("");
  observeReveals($("#testimonialsGrid"));
}

// =====================================================================
// Validação simples de formulários
// =====================================================================
function validate(form) {
  let ok = true;
  $$("input[required], select[required], textarea[required]", form).forEach((el) => {
    const valid = el.checkValidity() && (el.type !== "tel" || el.value.replace(/\D/g, "").length >= 10);
    el.closest(".field")?.classList.toggle("is-invalid", !valid);
    if (!valid && ok) { el.focus(); ok = false; }
  });
  return ok;
}
document.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("is-invalid"));

// máscara de telefone BR
$('#bookingForm [name="phone"]').addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
    : d.length > 6 ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3")
    : d.length > 2 ? d.replace(/(\d{2})(\d+)/, "($1) $2") : d;
});

function setLoading(btn, on) { btn.classList.toggle("is-loading", on); btn.disabled = on; }

// =====================================================================
// AGENDAMENTO
// =====================================================================
function setStep(n) {
  $$(".bstep").forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
  $$("[data-progress]").forEach((p) => {
    p.classList.toggle("is-active", +p.dataset.progress === n);
    p.classList.toggle("is-done", +p.dataset.progress < n);
  });
}

async function loadSlots() {
  const from = new Date();
  const to = new Date(from.getTime() + 22 * 864e5);
  state.slots = await api.getFreeSlots(from.toISOString(), to.toISOString());

  const byDay = new Map();
  for (let i = 0; i < 21; i++) {
    const d = new Date(from.getTime() + i * 864e5);
    byDay.set(dayKey(d), { key: dayKey(d), date: d, slots: [] });
  }
  state.slots.forEach((s) => byDay.get(dayKey(s.starts_at))?.slots.push(s));
  state.days = [...byDay.values()];

  if (state.slot && !state.slots.some((s) => s.id === state.slot.id)) state.slot = null;
  if (!state.days[state.dayIndex]?.slots.length) {
    const first = state.days.findIndex((d) => d.slots.length);
    state.dayIndex = first < 0 ? 0 : first;
  }
  $("#nextFree").textContent = state.slots[0]
    ? (dayKey(state.slots[0].starts_at) === dayKey(new Date()) ? `Hoje ${time(state.slots[0].starts_at)}` : `${fmtWeek.format(new Date(state.slots[0].starts_at)).replace(".", "")} ${time(state.slots[0].starts_at)}`)
    : "Lotado";
  renderDays(); renderSlots();
}

function renderDays() {
  const strip = $("#daysStrip");
  strip.innerHTML = state.days.map((d, i) => {
    const n = d.slots.length;
    return `<button class="day ${i === state.dayIndex ? "is-active" : ""}" role="option" aria-selected="${i === state.dayIndex}" data-day="${i}" ${n ? "" : "disabled"}>
      <small>${i === 0 ? "Hoje" : fmtWeek.format(d.date).replace(".", "")}</small>
      <strong>${fmtDayNum.format(d.date)}</strong>
      <em>${n ? `${n} livre${n > 1 ? "s" : ""}` : fmtMonth.format(d.date).replace(".", "")}</em>
    </button>`;
  }).join("");
  const active = strip.querySelector(".is-active");
  if (active) strip.scrollLeft = Math.max(0, active.offsetLeft - 8); // rola só a faixa, nunca a página
}

function renderSlots() {
  const day = state.days[state.dayIndex];
  const grid = $("#slotsGrid");
  if (!day || !day.slots.length) {
    grid.innerHTML = `<p class="slots__empty">${state.slots.length ? "Sem horários livres neste dia. Escolha outra data." : "Agenda lotada nos próximos dias. Me manda uma mensagem que eu encaixo você."}</p>`;
  } else {
    grid.innerHTML = day.slots.map((s) =>
      `<button class="slot ${state.slot?.id === s.id ? "is-active" : ""}" role="option" aria-selected="${state.slot?.id === s.id}" data-slot="${s.id}">${time(s.starts_at)}</button>`).join("");
  }
  $("#toStep2").disabled = !state.slot;
  $("#slotPicked").innerHTML = state.slot ? `<strong style="color:var(--gold-2)">${longDate(state.slot.starts_at)}</strong> às <strong style="color:var(--gold-2)">${time(state.slot.starts_at)}</strong>` : "Nenhum horário selecionado.";
}

$("#daysStrip").addEventListener("click", (e) => {
  const b = e.target.closest(".day"); if (!b || b.disabled) return;
  state.dayIndex = +b.dataset.day; renderDays(); renderSlots();
});
$("#daysPrev").addEventListener("click", () => $("#daysStrip").scrollBy({ left: -$("#daysStrip").clientWidth * 0.8, behavior: "smooth" }));
$("#daysNext").addEventListener("click", () => $("#daysStrip").scrollBy({ left: $("#daysStrip").clientWidth * 0.8, behavior: "smooth" }));
$("#slotsGrid").addEventListener("click", (e) => {
  const b = e.target.closest(".slot"); if (!b) return;
  state.slot = state.slots.find((s) => s.id === b.dataset.slot); renderSlots();
});

function updateTotal() {
  const s = state.services.find((x) => x.id === $("#bookingService").value);
  $("#bookingTotal").innerHTML = s ? `Total: <strong style="color:var(--text)">${price(s)}${s.price_suffix || ""}</strong> · ${s.duration_min} min` : "";
}
$("#bookingService").addEventListener("change", updateTotal);

$("#toStep2").addEventListener("click", () => {
  if (!state.slot) return;
  $("#pickedChip").innerHTML = `<span aria-hidden="true">📅</span><span><strong>${longDate(state.slot.starts_at)}</strong> às <strong>${time(state.slot.starts_at)}</strong></span>`;
  prefillFromSession();
  updateTotal();
  setStep(2);
  $("#bookingPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#backTo1").addEventListener("click", () => setStep(1));

function prefillFromSession() {
  const f = $("#bookingForm");
  const u = state.session?.user;
  if (!u) return;
  if (!f.email.value) f.email.value = u.email || "";
  if (!f.name.value && u.user_metadata?.full_name) f.name.value = u.user_metadata.full_name;
}

async function submitBooking() {
  const f = $("#bookingForm");
  const btn = $("#confirmBtn");
  $("#bookingError").textContent = "";
  if (!validate(f)) return;
  if (!state.slot) { setStep(1); return; }
  if (!state.session) {
    state.pendingSubmit = true;
    openAuth("signup", "Crie sua conta para confirmar o horário");
    return;
  }

  setLoading(btn, true);
  try {
    const { booking, emailSent } = await api.book({
      slotId: state.slot.id, serviceId: f.service.value,
      name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
    });
    const svc = state.services.find((s) => s.id === f.service.value);
    state.lastBooking = booking;
    $("#doneText").textContent = emailSent
      ? `Mandei a confirmação para ${f.email.value.trim()}. Uma hora antes você recebe um lembrete.`
      : "Seu horário está salvo. Não consegui enviar o e-mail agora, mas você vê tudo em “Meus agendamentos”.";
    $("#doneSummary").innerHTML = `
      <dt>Serviço</dt><dd>${esc(svc?.name)}</dd>
      <dt>Data</dt><dd>${longDate(state.slot.starts_at)}</dd>
      <dt>Hora</dt><dd>${time(state.slot.starts_at)}</dd>
      <dt>Valor</dt><dd>${svc ? price(svc) + (svc.price_suffix || "") : ""}</dd>
      <dt>Cliente</dt><dd>${esc(f.name.value.trim())}</dd>`;
    setStep(3);
    toast("Agendamento confirmado!", "ok");
    state.slot = null;
    loadSlots();
  } catch (err) {
    $("#bookingError").textContent = err.message;
    if (/ocupado|horário/i.test(err.message)) { state.slot = null; await loadSlots(); setTimeout(() => setStep(1), 1600); }
  } finally { setLoading(btn, false); }
}
$("#bookingForm").addEventListener("submit", (e) => { e.preventDefault(); submitBooking(); });
$("#bookAnother").addEventListener("click", () => { setStep(1); });
$("#seeBookings").addEventListener("click", () => openBookings());
$("#myBookingsBtn").addEventListener("click", () => openBookings());

// =====================================================================
// Modais (auth + meus agendamentos)
// =====================================================================
let modalLastFocus = null;
function openModal(m) { modalLastFocus = document.activeElement; m.hidden = false; document.body.style.overflow = "hidden"; setTimeout(() => $("input, button.tab, .modal__close", m)?.focus(), 50); }
function closeModal(m) { m.hidden = true; document.body.style.overflow = ""; modalLastFocus?.focus(); }
$$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(m); }));
document.addEventListener("keydown", (e) => {
  if (!lb.hidden) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") stepLb(1);
    if (e.key === "ArrowLeft") stepLb(-1);
    return;
  }
  if (e.key === "Escape") { $$(".modal:not([hidden])").forEach(closeModal); closeNav(); }
});

const authModal = $("#authModal"), authForm = $("#authForm");
let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  $$(".tab", authModal).forEach((t) => { t.classList.toggle("is-active", t.dataset.tab === mode); t.setAttribute("aria-selected", String(t.dataset.tab === mode)); });
  $$("[data-only]", authModal).forEach((el) => { el.hidden = el.dataset.only !== mode; });
  $('button[type="submit"]', authForm).textContent = mode === "login" ? "Entrar" : "Criar conta";
  authForm.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  $(".form-error", authForm).textContent = "";
}
function openAuth(mode = "login", title = "Entre na sua conta") {
  setAuthMode(mode);
  $("#authTitle").textContent = title;
  const bf = $("#bookingForm");
  if (bf.email.value && !authForm.email.value) authForm.email.value = bf.email.value;
  if (bf.name.value && !authForm.name.value) authForm.name.value = bf.name.value;
  openModal(authModal);
}
$$(".tab", authModal).forEach((t) => t.addEventListener("click", () => setAuthMode(t.dataset.tab)));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $(".form-error", authForm);
  const btn = $('button[type="submit"]', authForm);
  err.textContent = "";
  if (!validate(authForm)) return;
  setLoading(btn, true);
  try {
    if (authMode === "login") {
      await api.signIn(authForm.email.value.trim(), authForm.password.value);
    } else {
      const { needsConfirmation } = await api.signUp(authForm.email.value.trim(), authForm.password.value, authForm.name.value.trim());
      if (needsConfirmation) {
        err.textContent = "";
        toast("Conta criada! Confirme pelo link que enviei no seu e-mail e depois entre aqui.", "ok");
        setAuthMode("login");
        return;
      }
    }
    state.session = await api.getSession();
    closeModal(authModal);
    toast("Você entrou na sua conta.", "ok");
    if (state.pendingSubmit) { state.pendingSubmit = false; prefillFromSession(); submitBooking(); }
  } catch (ex) { err.textContent = ex.message; }
  finally { setLoading(btn, false); btn.textContent = authMode === "login" ? "Entrar" : "Criar conta"; }
});
$("#forgotBtn").addEventListener("click", async () => {
  const email = authForm.email.value.trim();
  if (!email) { $(".form-error", authForm).textContent = "Digite seu e-mail acima primeiro."; return; }
  try { await api.resetPassword(email); toast("Se o e-mail tiver conta, você vai receber um link para redefinir a senha.", "ok"); }
  catch (ex) { $(".form-error", authForm).textContent = ex.message; }
});

const bookingsModal = $("#bookingsModal");
async function openBookings() {
  if (!state.session) { openAuth("login", "Entre para ver seus agendamentos"); return; }
  $("#bookingsUser").textContent = state.session.user.email;
  const list = $("#myBookingsList");
  list.innerHTML = '<div class="skeleton" style="height:90px"></div>';
  openModal(bookingsModal);
  try {
    const rows = await api.myBookings();
    if (!rows.length) { list.innerHTML = '<p class="slots__empty">Você ainda não tem agendamentos.</p>'; return; }
    list.innerHTML = rows.map((b) => {
      const start = b.time_slots?.starts_at;
      const past = start && new Date(start) <= new Date();
      const canCancel = b.status === "confirmado" && !past;
      const label = { confirmado: past ? "concluído" : "confirmado", cancelado: "cancelado", concluido: "concluído" }[b.status];
      const cls = b.status === "confirmado" && past ? "concluido" : b.status;
      return `<article class="mb ${past || b.status !== "confirmado" ? "is-past" : ""}">
        <h4>${esc(b.services?.name)}</h4>
        <p>${start ? `${longDate(start)} · ${time(start)}` : ""}</p>
        <span class="status status--${cls}">${label}</span>
        ${canCancel ? `<button class="btn btn--ghost btn--sm" data-cancel="${esc(b.id)}">Cancelar</button>` : ""}
      </article>`;
    }).join("");
  } catch (ex) { list.innerHTML = `<p class="form-error">${esc(ex.message)}</p>`; }
}
$("#myBookingsList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-cancel]"); if (!btn) return;
  if (btn.dataset.confirming !== "1") {
    btn.dataset.confirming = "1"; btn.textContent = "Confirmar cancelamento";
    setTimeout(() => { if (btn.isConnected) { btn.dataset.confirming = ""; btn.textContent = "Cancelar"; } }, 4000);
    return;
  }
  setLoading(btn, true);
  try {
    await api.cancel(btn.dataset.cancel);
    toast("Agendamento cancelado. O horário voltou pra agenda.", "ok");
    await Promise.all([openBookings(), loadSlots()]);
  } catch (ex) { toast(ex.message, "error"); setLoading(btn, false); }
});
$("#logoutBtn").addEventListener("click", async () => { await api.signOut(); state.session = null; closeModal(bookingsModal); toast("Você saiu da conta."); });

function updateAccountBtn() {
  const b = $("#accountBtn");
  b.textContent = state.session ? "Minha conta" : "Entrar";
}
$("#accountBtn").addEventListener("click", () => state.session ? openBookings() : openAuth("login"));
api.onAuthChange((s) => { state.session = s; updateAccountBtn(); });

// =====================================================================
// Contato
// =====================================================================
$("#contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget, btn = $('button[type="submit"]', f), err = $(".form-error", f);
  err.textContent = "";
  if (!validate(f)) return;
  setLoading(btn, true);
  try {
    await api.sendContact({ name: f.name.value.trim(), email: f.email.value.trim(), service: f.service.value, message: f.message.value.trim() });
    f.reset();
    toast("Mensagem enviada! Respondo em breve.", "ok");
  } catch (ex) { err.textContent = ex.message; }
  finally { setLoading(btn, false); }
});

// =====================================================================
// Boot
// =====================================================================
$("#year").textContent = new Date().getFullYear();
if (config.address) $("#footerAddress").textContent = config.address;
if (config.instagram) $("#footerInsta").href = config.instagram;
if (TZ !== "America/Sao_Paulo") $("#tzLabel").textContent = `fuso ${TZ}`;
if (isDemo) {
  const badge = $("#demoBadge");
  badge.hidden = false;
  badge.addEventListener("click", () => badge.remove());
  setTimeout(() => badge.remove(), 9000);
}

renderPortfolio();
renderTestimonials();

(async () => {
  state.session = await api.getSession();
  updateAccountBtn();
  try {
    state.services = await api.getServices();
    renderServices();
  } catch (ex) {
    $("#servicesGrid").innerHTML = `<p class="form-error">Não foi possível carregar os serviços: ${esc(ex.message)}</p>`;
  }
  try { await loadSlots(); }
  catch (ex) { $("#slotsGrid").innerHTML = `<p class="slots__empty">Não foi possível carregar a agenda: ${esc(ex.message)}</p>`; }
  // links do e-mail (#agendar) após login por confirmação
  if (location.hash === "#agendar") document.getElementById("agendar").scrollIntoView();
})();

// Atualiza a agenda quando o cliente volta para a aba
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadSlots().catch(() => {}); });
