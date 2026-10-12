// Gera public/js/config.js a partir das variáveis de ambiente do Netlify.
// A anon key do Supabase é pública por design — a segurança vem do RLS.
// NUNCA coloque a service_role key aqui.
import { writeFileSync } from "node:fs";

const env = process.env;
const cfg = {
  SUPABASE_URL: env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
  TIMEZONE: env.BARBER_TIMEZONE || "America/Sao_Paulo",
  BARBER_ADDRESS: env.BARBER_ADDRESS || "",
  INSTAGRAM_URL: env.INSTAGRAM_URL || "",
};

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  console.warn("⚠️  SUPABASE_URL / SUPABASE_ANON_KEY ausentes — o site vai rodar em modo demonstração.");
}
if (/service_role/.test(Buffer.from((cfg.SUPABASE_ANON_KEY.split(".")[1] || ""), "base64").toString())) {
  console.error("❌ SUPABASE_ANON_KEY contém uma service_role key. Use a anon key.");
  process.exit(1);
}

writeFileSync(
  new URL("../public/js/config.js", import.meta.url),
  `// Gerado automaticamente no build — não edite.\nwindow.LONE_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`
);
console.log("✅ public/js/config.js gerado", cfg.SUPABASE_URL ? `(${cfg.SUPABASE_URL})` : "(demo)");
