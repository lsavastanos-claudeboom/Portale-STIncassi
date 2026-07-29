-- =====================================================================
--  Portale Incassi - schema Supabase
--  Eseguire per intero nel SQL Editor di Supabase (una volta sola).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Membri autorizzati
--    Solo le email presenti qui possono vedere i dati dello studio.
--    L'utente viene creato da Supabase Auth; questa tabella lo abilita.
-- ---------------------------------------------------------------------
create table if not exists public.membri (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nome       text,
  ruolo      text not null default 'lettore' check (ruolo in ('admin','lettore')),
  creato_il  timestamptz not null default now()
);

-- Aggancio automatico: alla registrazione l'utente entra come lettore.
-- Il primo utente registrato diventa admin.
create or replace function public.registra_membro()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare n_membri int;
begin
  select count(*) into n_membri from public.membri;
  insert into public.membri (user_id, email, ruolo)
  values (new.id, new.email, case when n_membri = 0 then 'admin' else 'lettore' end)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.registra_membro();

-- ---------------------------------------------------------------------
-- 2. Caricamenti (un record per file Excel importato)
-- ---------------------------------------------------------------------
create table if not exists public.caricamenti (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null references auth.users(id) on delete cascade,
  nome_file    text not null,
  studio       text not null,
  righe        int  not null default 0,
  righe_nuove  int  not null default 0,
  periodo_da   date,
  periodo_a    date,
  creato_il    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Proforma
--    'attivita' contiene le colonne di dettaglio dell'export come
--    coppie { "voce": importo }, così lo schema regge nuove voci
--    senza migrazioni.
-- ---------------------------------------------------------------------
create table if not exists public.proforma (
  id             uuid primary key default gen_random_uuid(),
  caricamento_id uuid references public.caricamenti(id) on delete set null,
  studio         text not null,               -- STUDIRIUNITI | TECNACCISE
  sezionale      text not null,               -- C | P | D | T
  n_doc          text not null,
  data_doc       date not null,
  data_incasso   date,
  cliente        text not null,
  cliente_key    text not null,               -- nome normalizzato per i raggruppamenti
  imponibile     numeric(12,2) not null default 0,
  cassa          numeric(12,2) not null default 0,
  iva            numeric(12,2) not null default 0,
  totale         numeric(12,2) not null default 0,
  quantita       numeric(10,2),
  intermediario  text,
  attivita       jsonb not null default '{}'::jsonb,
  anno           int  generated always as (extract(year from data_doc)::int) stored,
  giorni_incasso int  generated always as (
                   case when data_incasso is null then null
                        else greatest((data_incasso - data_doc), 0) end
                 ) stored,
  creato_il      timestamptz not null default now(),
  unique (studio, sezionale, n_doc, data_doc)
);

create index if not exists proforma_data_doc_idx     on public.proforma (data_doc);
create index if not exists proforma_studio_anno_idx  on public.proforma (studio, anno);
create index if not exists proforma_cliente_key_idx  on public.proforma (cliente_key);
create index if not exists proforma_aperti_idx       on public.proforma (data_incasso) where data_incasso is null;

-- ---------------------------------------------------------------------
-- 4. Row Level Security
--    Chi è in 'membri' legge tutto; solo gli admin scrivono.
-- ---------------------------------------------------------------------
alter table public.membri      enable row level security;
alter table public.caricamenti enable row level security;
alter table public.proforma    enable row level security;

create or replace function public.e_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membri m where m.user_id = auth.uid())
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membri m where m.user_id = auth.uid() and m.ruolo = 'admin')
$$;

drop policy if exists membri_self on public.membri;
create policy membri_self on public.membri
  for select using (user_id = auth.uid() or public.e_admin());

drop policy if exists membri_admin_write on public.membri;
create policy membri_admin_write on public.membri
  for all using (public.e_admin()) with check (public.e_admin());

drop policy if exists caricamenti_read on public.caricamenti;
create policy caricamenti_read on public.caricamenti
  for select using (public.e_membro());

drop policy if exists caricamenti_write on public.caricamenti;
create policy caricamenti_write on public.caricamenti
  for all using (public.e_admin()) with check (public.e_admin());

drop policy if exists proforma_read on public.proforma;
create policy proforma_read on public.proforma
  for select using (public.e_membro());

drop policy if exists proforma_write on public.proforma;
create policy proforma_write on public.proforma
  for all using (public.e_admin()) with check (public.e_admin());

-- ---------------------------------------------------------------------
-- 5. Import massivo: upsert su (studio, sezionale, n_doc, data_doc).
--    Ricaricare lo stesso export aggiorna le date di incasso senza
--    creare duplicati.
-- ---------------------------------------------------------------------
create or replace function public.importa_proforma(righe jsonb, caricamento uuid)
returns table (inserite int, aggiornate int)
language plpgsql security definer set search_path = public
as $$
declare pre int; tot int;
begin
  if not public.e_admin() then
    raise exception 'Solo un amministratore può importare dati';
  end if;

  select count(*) into pre from public.proforma;

  insert into public.proforma (
    caricamento_id, studio, sezionale, n_doc, data_doc, data_incasso,
    cliente, cliente_key, imponibile, cassa, iva, totale, quantita,
    intermediario, attivita)
  select caricamento,
         r->>'studio', r->>'sezionale', r->>'n_doc',
         (r->>'data_doc')::date,
         nullif(r->>'data_incasso','')::date,
         r->>'cliente', r->>'cliente_key',
         (r->>'imponibile')::numeric, (r->>'cassa')::numeric,
         (r->>'iva')::numeric, (r->>'totale')::numeric,
         nullif(r->>'quantita','')::numeric,
         r->>'intermediario', coalesce(r->'attivita','{}'::jsonb)
  from jsonb_array_elements(righe) as r
  on conflict (studio, sezionale, n_doc, data_doc) do update set
    data_incasso   = excluded.data_incasso,
    cliente        = excluded.cliente,
    cliente_key    = excluded.cliente_key,
    imponibile     = excluded.imponibile,
    cassa          = excluded.cassa,
    iva            = excluded.iva,
    totale         = excluded.totale,
    quantita       = excluded.quantita,
    intermediario  = excluded.intermediario,
    attivita       = excluded.attivita,
    caricamento_id = excluded.caricamento_id;

  select count(*) into tot from public.proforma;

  inserite   := tot - pre;
  aggiornate := jsonb_array_length(righe) - (tot - pre);
  return next;
end $$;

-- ---------------------------------------------------------------------
-- 6. Svuota archivio (solo admin) - utile in fase di prova
-- ---------------------------------------------------------------------
create or replace function public.svuota_archivio()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then
    raise exception 'Solo un amministratore può svuotare l''archivio';
  end if;
  delete from public.proforma;
  delete from public.caricamenti;
end $$;
