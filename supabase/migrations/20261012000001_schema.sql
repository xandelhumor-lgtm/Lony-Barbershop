-- =====================================================================
-- Lone Barbershop — schema, RLS e funções de agendamento
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Barbeiro (admin). Adicione o seu user_id aqui depois de criar a conta:
--   insert into public.admins (user_id) values ('<uuid do auth.users>');
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Serviços — FONTE ÚNICA: a seção de serviços, o formulário de
-- agendamento e o formulário de contato leem desta tabela.
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id            text primary key,              -- slug
  name          text not null,
  description   text not null,
  price_cents   integer not null check (price_cents >= 0),
  price_suffix  text,                          -- ex.: '/mês'
  duration_min  integer not null check (duration_min > 0),
  highlight     boolean not null default false,
  sort          integer not null default 0,
  active        boolean not null default true
);

insert into public.services (id, name, description, price_cents, price_suffix, duration_min, highlight, sort) values
  ('corte',      'Corte masculino', 'Tesoura e máquina, acabamento na navalha e finalização com produto.', 4500, null, 40, false, 1),
  ('barba',      'Barba',           'Toalha quente, desenho com navalha, hidratação e óleo para barba.',      3500, null, 30, false, 2),
  ('pacote',     'Pacote completo', 'Corte + barba no mesmo horário. O combo mais pedido da agenda.',        7000, null, 60, true,  3),
  ('degrade',    'Degradê',         'Fade baixo, médio ou alto com transição limpa e contorno marcado.',     5000, null, 45, false, 4),
  ('manutencao', 'Manutenção mensal','4 cortes no mês com horário prioritário. Sempre alinhado.',           15000, '/mês', 40, false, 5)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
  price_suffix = excluded.price_suffix, duration_min = excluded.duration_min,
  highlight = excluded.highlight, sort = excluded.sort;

-- ---------------------------------------------------------------------
-- Horários do barbeiro
-- ---------------------------------------------------------------------
create table if not exists public.time_slots (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null unique,
  ends_at    timestamptz not null,
  status     text not null default 'livre' check (status in ('livre', 'ocupado', 'cancelado')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists time_slots_status_start_idx on public.time_slots (status, starts_at);

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  slot_id              uuid not null references public.time_slots (id),
  service_id           text not null references public.services (id),
  customer_name        text not null check (char_length(customer_name) between 2 and 120),
  customer_email       text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone       text not null check (char_length(customer_phone) between 8 and 30),
  status               text not null default 'confirmado' check (status in ('confirmado', 'cancelado', 'concluido')),
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now()
);
-- impede dois agendamentos ativos no mesmo horário
create unique index if not exists bookings_one_active_per_slot
  on public.bookings (slot_id) where status = 'confirmado';
create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_reminder_idx on public.bookings (status, reminder_sent_at);

-- ---------------------------------------------------------------------
-- Mensagens do formulário de contato
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  service_id text references public.services (id),
  message    text not null check (char_length(message) between 2 and 2000),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.admins           enable row level security;
alter table public.services         enable row level security;
alter table public.time_slots       enable row level security;
alter table public.bookings         enable row level security;
alter table public.contact_messages enable row level security;

-- admins: só o próprio admin se enxerga
drop policy if exists "admins_self" on public.admins;
create policy "admins_self" on public.admins for select to authenticated using (user_id = auth.uid());

-- services: leitura pública dos ativos; escrita só admin
drop policy if exists "services_read" on public.services;
create policy "services_read" on public.services for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "services_admin" on public.services;
create policy "services_admin" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- time_slots: cliente vê SÓ horários livres e futuros
drop policy if exists "slots_read_free" on public.time_slots;
create policy "slots_read_free" on public.time_slots for select to anon, authenticated
  using (status = 'livre' and starts_at > now());
-- ...e o horário dos próprios agendamentos (para "Meus agendamentos")
drop policy if exists "slots_read_own" on public.time_slots;
create policy "slots_read_own" on public.time_slots for select to authenticated
  using (exists (select 1 from public.bookings b where b.slot_id = time_slots.id and b.user_id = auth.uid()));
drop policy if exists "slots_admin" on public.time_slots;
create policy "slots_admin" on public.time_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Sem policy de insert/update para clientes: mudanças passam pelas funções abaixo.

-- bookings: cliente lê só os seus; escrita via RPC
drop policy if exists "bookings_read_own" on public.bookings;
create policy "bookings_read_own" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "bookings_admin" on public.bookings;
create policy "bookings_admin" on public.bookings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- contact_messages: qualquer um envia; só admin lê
drop policy if exists "contact_insert" on public.contact_messages;
create policy "contact_insert" on public.contact_messages for insert to anon, authenticated with check (true);
drop policy if exists "contact_admin_read" on public.contact_messages;
create policy "contact_admin_read" on public.contact_messages for select to authenticated using (public.is_admin());

-- =====================================================================
-- RPC: agendar (atômico — trava o horário, marca "ocupado" e grava)
-- =====================================================================
create or replace function public.book_slot(
  p_slot_id uuid, p_service_id text, p_name text, p_email text, p_phone text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_slot    public.time_slots;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Faça login para agendar.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.services where id = p_service_id and active) then
    raise exception 'Serviço inválido.' using errcode = '22023';
  end if;

  select * into v_slot from public.time_slots where id = p_slot_id for update;
  if not found or v_slot.status <> 'livre' or v_slot.starts_at <= now() then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
  end if;

  update public.time_slots set status = 'ocupado' where id = p_slot_id;

  insert into public.bookings (user_id, slot_id, service_id, customer_name, customer_email, customer_phone)
  values (auth.uid(), p_slot_id, p_service_id, trim(p_name), lower(trim(p_email)), trim(p_phone))
  returning * into v_booking;

  return v_booking;
end $$;

-- =====================================================================
-- RPC: cancelar (libera o horário de volta para "livre")
-- =====================================================================
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings;
  v_start   timestamptz;
begin
  select b.* into v_booking from public.bookings b
   where b.id = p_booking_id and (b.user_id = auth.uid() or public.is_admin())
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'confirmado' then
    raise exception 'Esse agendamento já foi cancelado ou concluído.' using errcode = 'P0001';
  end if;

  select starts_at into v_start from public.time_slots where id = v_booking.slot_id for update;
  if v_start <= now() then
    raise exception 'Não é possível cancelar um horário que já passou.' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelado', cancelled_at = now()
   where id = p_booking_id returning * into v_booking;
  update public.time_slots set status = 'livre' where id = v_booking.slot_id;

  return v_booking;
end $$;

-- =====================================================================
-- RPC (admin/cron): gerar grade de horários
--   select public.generate_slots(current_date, current_date + 14);
-- Padrão: ter–sáb, 09:00–19:00, blocos de 60 min, fuso America/Sao_Paulo.
-- =====================================================================
create or replace function public.generate_slots(
  p_from date, p_to date,
  p_start time default '09:00', p_end time default '19:00',
  p_step_min int default 60,
  p_weekdays int[] default array[2,3,4,5,6],      -- 0=dom ... 6=sáb
  p_tz text default 'America/Sao_Paulo'
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  d date; t time; n int := 0; v_start timestamptz;
begin
  if auth.role() <> 'service_role' and not public.is_admin() and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Apenas o barbeiro pode gerar horários.';
  end if;
  d := p_from;
  while d <= p_to loop
    if extract(dow from d)::int = any (p_weekdays) then
      t := p_start;
      while t + make_interval(mins => p_step_min) <= p_end loop
        v_start := (d + t) at time zone p_tz;
        insert into public.time_slots (starts_at, ends_at)
        values (v_start, v_start + make_interval(mins => p_step_min))
        on conflict (starts_at) do nothing;
        if found then n := n + 1; end if;
        t := t + make_interval(mins => p_step_min);
      end loop;
    end if;
    d := d + 1;
  end loop;
  return n;
end $$;

revoke all on function public.book_slot(uuid, text, text, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.generate_slots(date, date, time, time, int, int[], text) from public, anon;
grant execute on function public.book_slot(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.generate_slots(date, date, time, time, int, int[], text) to authenticated, service_role;

-- Primeira grade: próximos 21 dias
select public.generate_slots(current_date, current_date + 21);
