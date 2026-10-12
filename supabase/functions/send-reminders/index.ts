// Edge Function: send-reminders
// Disparada pelo pg_cron a cada 15 minutos (ver migrations/..._cron.sql).
// Envia o lembrete para todo agendamento confirmado que começa em até 60 minutos
// e ainda não recebeu lembrete. Com cron de 15 em 15 min, o cliente recebe o
// e-mail entre 60 e 45 minutos antes do horário.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BOOKING_SELECT, json, sendEmail, toSummary } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: rows, error } = await admin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmado")
    .is("reminder_sent_at", null)
    .gt("time_slots.starts_at", now.toISOString())
    .lte("time_slots.starts_at", inOneHour.toISOString());

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const row of rows ?? []) {
    // "Reserva" o envio antes de mandar, para nunca duplicar se duas execuções se sobrepuserem
    const { data: claimed } = await admin
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    try {
      await sendEmail(row.customer_email, "reminder", toSummary(row));
      results.push({ id: row.id, ok: true });
    } catch (e) {
      // libera para nova tentativa no próximo ciclo
      await admin.from("bookings").update({ reminder_sent_at: null }).eq("id", row.id);
      results.push({ id: row.id, ok: false, error: String((e as Error).message ?? e) });
    }
  }

  console.log(`send-reminders: ${results.length} processados`, results);
  return json({ processed: results.length, results });
});
