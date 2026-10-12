// Edge Function: send-confirmation
// Chamada pelo site logo após o insert (RPC book_slot) — e também após um cancelamento.
// Body: { booking_id: string, type?: "confirmation" | "cancellation" }
// Exige o JWT do cliente: só o dono do agendamento consegue disparar o e-mail.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BOOKING_SELECT, corsHeaders, json, sendEmail, toSummary } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { booking_id, type = "confirmation" } = await req.json();
    if (!booking_id || !["confirmation", "cancellation"].includes(type)) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) Quem está chamando?
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    // 2) Carrega o agendamento com service role (inclui horário e serviço)
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error } = await admin.from("bookings").select(BOOKING_SELECT).eq("id", booking_id).single();
    if (error || !row) return json({ error: "Agendamento não encontrado" }, 404);
    if (row.user_id !== user.id) return json({ error: "Proibido" }, 403);

    if (type === "confirmation") {
      if (row.status !== "confirmado") return json({ error: "Agendamento não está confirmado" }, 409);
      if (row.confirmation_sent_at) return json({ ok: true, skipped: "já enviado" });
    } else if (row.status !== "cancelado") {
      return json({ error: "Agendamento não está cancelado" }, 409);
    }

    await sendEmail(row.customer_email, type, toSummary(row));

    if (type === "confirmation") {
      await admin.from("bookings").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", booking_id);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
