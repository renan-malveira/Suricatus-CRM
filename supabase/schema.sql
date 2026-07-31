-- ============================================================
--  CRM Suricatus — schema do banco (rodar no SQL Editor do Supabase)
--  Idempotente: pode rodar de novo por cima de uma versão anterior.
-- ============================================================

-- ---------- Tabelas base ----------

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'corporativo' check (tipo in ('publico','corporativo','agencia')),
  segmento text,
  contato_nome text,
  contato_cargo text,
  email text,
  telefone text,
  uf text,
  origem text,
  responsavel text,
  status text default 'Lead',
  created_at timestamptz not null default now()
);

create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  linha text not null default 'corporativo'
    check (linha in ('evento','plataforma','publico','corporativo')),
  solucao text,
  valor numeric not null default 0,
  etapa text not null default 'lead'
    check (etapa in ('lead','qualificacao','diagnostico','proposta','ganho','perdido','standby')),
  probabilidade int not null default 15,
  responsavel text,
  previsao_fechamento date,
  proxima_acao text,
  created_at timestamptz not null default now()
);

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null default 'nota',
  descricao text not null,
  autor text,
  created_at timestamptz not null default now()
);

create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nome text not null,
  tamanho bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- (3) Motivo de perda em negócios ----------
alter table public.negocios add column if not exists motivo_perda text;
alter table public.negocios add column if not exists fechado_em timestamptz;

-- ---------- (4) Atividades com data agendada / conclusão ----------
alter table public.atividades add column if not exists data_agendada timestamptz;
alter table public.atividades add column if not exists concluida boolean not null default false;

-- ---------- (7) Integração com o Suricatus Planner ----------
-- Vínculo do negócio a um projeto do planner (data.projects[].id na linha 'main').
alter table public.negocios add column if not exists planner_project_id text;
-- De onde veio a atividade: 'crm' (padrão) ou 'planner'.
alter table public.atividades add column if not exists origem text not null default 'crm';
create index if not exists idx_negocios_planner on public.negocios(planner_project_id) where planner_project_id is not null;

-- Permite o CRM (usuário logado) LER a lista de projetos do planner (tabela projects, linha 'main').
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'projects') then
    execute 'drop policy if exists "projects_sel_crm" on public.projects';
    execute 'create policy "projects_sel_crm" on public.projects for select to authenticated using (true)';
  end if;
end $$;

-- ---------- (2) Histórico de etapas ----------
create table if not exists public.negocio_etapa_historico (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  etapa_de text,
  etapa_para text not null,
  autor text,
  created_at timestamptz not null default now()
);

-- ---------- (5) Contatos (uma empresa/cliente tem vários contatos) ----------
create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  telefone text,
  principal boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- (6) Perfis / papéis de acesso ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  role text not null default 'editor' check (role in ('admin','editor','leitor')),
  created_at timestamptz not null default now()
);

create index if not exists idx_negocios_etapa on public.negocios(etapa);
create index if not exists idx_atividades_negocio on public.atividades(negocio_id);
create index if not exists idx_atividades_agenda on public.atividades(data_agendada) where data_agendada is not null;
create index if not exists idx_anexos_negocio on public.anexos(negocio_id);
create index if not exists idx_historico_negocio on public.negocio_etapa_historico(negocio_id);
create index if not exists idx_contatos_cliente on public.contatos(cliente_id);

-- ---------- Funções de papel (SECURITY DEFINER: leem profiles sem recursão de RLS) ----------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'editor')
$$;

create or replace function public.can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin','editor')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
$$;

-- ---------- Trigger: cria profile automático a cada novo usuário ----------
-- O primeiro usuário do sistema vira admin; os demais viram editor.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, email, nome, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          case when cnt = 0 then 'admin' else 'editor' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuários que já existiam antes do trigger ganham profile.
insert into public.profiles (id, email, nome, role)
select id, email, coalesce(raw_user_meta_data->>'name', email), 'editor'
from auth.users
on conflict (id) do nothing;

-- Garante que o usuário mais antigo (você) seja admin.
update public.profiles set role = 'admin'
where id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- ---------- RLS ----------

alter table public.clientes  enable row level security;
alter table public.negocios  enable row level security;
alter table public.atividades enable row level security;
alter table public.anexos    enable row level security;
alter table public.negocio_etapa_historico enable row level security;
alter table public.contatos  enable row level security;
alter table public.profiles  enable row level security;

-- Tabelas de dados: todos os logados leem; só admin/editor escrevem.
do $$
declare t text;
begin
  foreach t in array array['clientes','negocios','atividades','anexos','negocio_etapa_historico','contatos'] loop
    execute format('drop policy if exists "%1$s_all" on public.%1$s', t);
    execute format('drop policy if exists "equipe_all" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_sel" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_ins" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_upd" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_del" on public.%1$s', t);
    execute format('create policy "%1$s_sel" on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "%1$s_ins" on public.%1$s for insert to authenticated with check (public.can_write())', t);
    execute format('create policy "%1$s_upd" on public.%1$s for update to authenticated using (public.can_write()) with check (public.can_write())', t);
    execute format('create policy "%1$s_del" on public.%1$s for delete to authenticated using (public.can_write())', t);
  end loop;
end $$;

-- Profiles: todos os logados leem; só admin altera papéis.
drop policy if exists "profiles_sel" on public.profiles;
drop policy if exists "profiles_write" on public.profiles;
create policy "profiles_sel" on public.profiles for select to authenticated using (true);
create policy "profiles_write" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage: bucket privado de anexos ----------

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

drop policy if exists "anexos_equipe_all" on storage.objects;
drop policy if exists "anexos_sel" on storage.objects;
drop policy if exists "anexos_ins" on storage.objects;
drop policy if exists "anexos_del" on storage.objects;
create policy "anexos_sel" on storage.objects for select to authenticated
  using (bucket_id = 'anexos');
create policy "anexos_ins" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.can_write());
create policy "anexos_del" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and public.can_write());
