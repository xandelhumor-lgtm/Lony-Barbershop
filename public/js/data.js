// =====================================================================
// Conteúdo estático do site.
// SERVIÇOS: a fonte real é a tabela `public.services` no Supabase.
// DEMO_SERVICES abaixo só é usada no modo demonstração (sem Supabase)
// e espelha exatamente o seed da migration.
// =====================================================================

export const DEMO_SERVICES = [
  { id: "corte", name: "Corte masculino", description: "Tesoura e máquina, acabamento na navalha e finalização com produto.", price_cents: 4500, price_suffix: null, duration_min: 40, highlight: false, sort: 1 },
  { id: "barba", name: "Barba", description: "Toalha quente, desenho com navalha, hidratação e óleo para barba.", price_cents: 3500, price_suffix: null, duration_min: 30, highlight: false, sort: 2 },
  { id: "pacote", name: "Pacote completo", description: "Corte + barba no mesmo horário. O combo mais pedido da agenda.", price_cents: 7000, price_suffix: null, duration_min: 60, highlight: true, sort: 3 },
  { id: "degrade", name: "Degradê", description: "Fade baixo, médio ou alto com transição limpa e contorno marcado.", price_cents: 5000, price_suffix: null, duration_min: 45, highlight: false, sort: 4 },
  { id: "manutencao", name: "Manutenção mensal", description: "4 cortes no mês com horário prioritário. Sempre alinhado.", price_cents: 15000, price_suffix: "/mês", duration_min: 40, highlight: false, sort: 5 },
];

// Itens exibidos no card de destaque (apenas apresentação)
export const SERVICE_EXTRAS = {
  pacote: ["Corte com acabamento na navalha", "Barba com toalha quente", "Hidratação e finalização", "Mais barato que separado"],
};

// Ícones por serviço (SVG inline, sem dependências)
export const SERVICE_ICONS = {
  corte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/></svg>',
  barba: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4v6a7 7 0 0 0 14 0V4"/><path d="M9 14c1 1 5 1 6 0"/><path d="M12 17v4"/></svg>',
  pacote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>',
  degrade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20h16M6 16h12M8 12h8M10 8h4M11.5 4h1"/></svg>',
  manutencao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg>',
};

// =====================================================================
// PORTFÓLIO — o coração do site.
// Troque `src` pelas SUAS fotos (ex.: "/assets/portfolio/degrade-01.webp").
// Dica: exporte em WebP, ~1600px no lado maior, qualidade 80.
// `service` liga a foto ao serviço → botão "Quero esse estilo" já
// abre a agenda com o serviço certo selecionado.
// `size`: "tall" (2 linhas) | "wide" (2 colunas) | "" (normal)
// =====================================================================
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=70`;

export const PORTFOLIO = [
  { id: 1, category: "Degradê",  service: "degrade",    size: "tall", title: "Mid fade com risco",        description: "Fade médio, transição limpa e risco lateral na navalha.", src: u("1621605815971-fbc98d665033") },
  { id: 2, category: "Barba",    service: "barba",      size: "",     title: "Barba desenhada",           description: "Contorno na navalha com toalha quente e óleo finalizador.", src: u("1605497788044-5a32c7078486") },
  { id: 3, category: "Corte",    service: "corte",      size: "",     title: "Social na tesoura",         description: "Corte clássico com volume controlado em cima.", src: u("1503951914875-452162b0f3f1") },
  { id: 4, category: "Pacote",   service: "pacote",     size: "wide", title: "Corte + barba completo",    description: "O pacote mais pedido: degradê baixo e barba alinhada.", src: u("1585747860715-2ba37e788b70") },
  { id: 5, category: "Degradê",  service: "degrade",    size: "",     title: "Low fade texturizado",      description: "Degradê baixo com topo texturizado e pomada matte.", src: u("1599351431202-1e0f0137899a") },
  { id: 6, category: "Corte",    service: "corte",      size: "tall", title: "Crop francês",              description: "Franja reta, laterais curtas, acabamento natural.", src: u("1622286342621-4bd786c2447c") },
  { id: 7, category: "Barba",    service: "barba",      size: "",     title: "Barba cheia alinhada",      description: "Volume preservado, bochecha e pescoço limpos.", src: u("1593702275687-f8b402bf1fb5") },
  { id: 8, category: "Degradê",  service: "degrade",    size: "",     title: "Skin fade",                 description: "Degradê na pele com transição sem marca.", src: u("1517832606299-7ae9b720a186") },
  { id: 9, category: "Pacote",   service: "manutencao", size: "",     title: "Manutenção do mês",         description: "Cliente do plano mensal — sempre no ponto.", src: u("1622296089863-eb7fc530daa8") },
  { id: 10, category: "Corte",   service: "corte",      size: "",     title: "Pompadour moderno",         description: "Laterais baixas e topo com volume para trás.", src: u("1512690459411-b9245aed614b") },
];

// =====================================================================
// DEPOIMENTOS (fictícios — substitua por avaliações reais de clientes)
// =====================================================================
export const TESTIMONIALS = [
  { name: "Rafael Moura", role: "Engenheiro de software", text: "Agendo pelo site em 30 segundos, chego e já sento. O degradê sai igual toda vez — foi o que me fez parar de trocar de barbeiro.", stars: 5 },
  { name: "Diego Albuquerque", role: "Advogado", text: "O pacote completo virou meu ritual de sexta. Atendimento sem pressa, barba impecável e o lembrete no e-mail salva minha agenda.", stars: 5 },
  { name: "Lucas Ferreira", role: "Personal trainer", text: "Mostrei uma foto do portfólio, ele entendeu na hora e ainda ajustou pro formato do meu rosto. Assinei a manutenção mensal no mesmo dia.", stars: 5 },
];
