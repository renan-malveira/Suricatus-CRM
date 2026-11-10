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
-- Vínculo do negócio a um projeto do planner (legado; hoje o vínculo é por cliente).
alter table public.negocios add column if not exists planner_project_id text;
-- De onde veio a atividade: 'crm' (padrão) ou 'planner'.
alter table public.atividades add column if not exists origem text not null default 'crm';
create index if not exists idx_negocios_planner on public.negocios(planner_project_id) where planner_project_id is not null;

-- Vínculo cliente <-> projeto do planner (1 pra 1, criado automaticamente).
alter table public.clientes add column if not exists planner_project_id text;
create index if not exists idx_clientes_planner on public.clientes(planner_project_id) where planner_project_id is not null;

-- Atividades agora podem ser do CLIENTE (não só de um negócio), para o canal
-- de anotações CRM <-> Planner funcionar automaticamente por cliente.
alter table public.atividades add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.atividades alter column negocio_id drop not null;
create index if not exists idx_atividades_cliente on public.atividades(cliente_id);
-- Backfill: preenche cliente_id das atividades existentes a partir do negócio.
update public.atividades a
  set cliente_id = n.cliente_id
  from public.negocios n
  where a.negocio_id = n.id and a.cliente_id is null;

-- Permite o CRM (usuário logado) LER e ESCREVER na tabela projects do planner (linha 'main').
-- A escrita é necessária para criar projetos no planner a partir de um cliente novo.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'projects') then
    execute 'drop policy if exists "projects_sel_crm" on public.projects';
    execute 'drop policy if exists "projects_write_crm" on public.projects';
    execute 'create policy "projects_sel_crm" on public.projects for select to authenticated using (true)';
    execute 'create policy "projects_write_crm" on public.projects for all to authenticated using (true) with check (true)';
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

-- ---------- (9) Leads de prospecção, separados do Radar de eventos ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  tipo_cliente text not null default 'corporativo' check (tipo_cliente in ('publico','corporativo','agencia')),
  site text,
  cidade text,
  uf text,
  segmento text,
  contato_nome text,
  contato_cargo text,
  linkedin text,
  email text,
  telefone text,
  motivo_contato text,
  mensagem text,
  canal text,
  status text not null default 'novo' check (status in ('novo','contatado','respondeu','interessado','sem_interesse','convertido')),
  primeiro_contato_em date,
  proximo_follow_up date,
  reuniao_em date,
  notas text,
  cliente_id uuid references public.clientes(id) on delete set null,
  negocio_id uuid references public.negocios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_follow_up on public.leads(proximo_follow_up) where proximo_follow_up is not null;
create index if not exists idx_leads_cliente on public.leads(cliente_id) where cliente_id is not null;
create index if not exists idx_leads_negocio on public.leads(negocio_id) where negocio_id is not null;

-- ============================================================
--  (8) RADAR DE PROSPECÇÃO
--  Base gerada por um robô externo e entregue como base_prospeccao.xlsx.
--  A chave primária é o `id` DO ROBÔ (text), não um uuid — é ele que mantém
--  a sincronia entre a planilha e o banco. Nunca gerar id aqui.
--
--  CONTRATO (vem do "Leia-me" da planilha, respeitar sempre):
--    - colunas de PESQUISA: o robô reescreve todo dia -> o import sobrescreve.
--    - colunas COMERCIAIS (status/responsavel/notas): são da Amanda/Renan
--      -> o import NUNCA as toca. Ver `pros_upsert_*` mais abaixo.
-- ============================================================

create table if not exists public.pros_eventos (
  id text primary key,
  prioritario boolean not null default false,
  -- pesquisa (robô)
  nome text not null default '',
  edicao text, setor text, setores_secundarios text, formato text, status text,
  data_inicio text, data_fim text, precisao_data text, urgencia text,
  cidade text, uf text, local text, site text,
  fit int, justificativa_fit text, alvo text, publico_estimado text,
  organizador text, organizador_site text, email_comercial text, telefone text,
  patrocinio_pagina text, cota text, cota_prazo text, area_expositiva text,
  patrocinadores text, expositores text, marcas_pesquisadas text,
  primeiro_visto text, ultima_verificacao text, proxima_revisita text, fonte text,
  -- comercial (nosso)
  status_comercial text not null default 'novo',
  responsavel text,
  notas text,
  negocio_id uuid references public.negocios(id) on delete set null,
  importado_em timestamptz not null default now()
);

create table if not exists public.pros_marcas (
  id text primary key,
  marca text not null default '',
  setores text, n_eventos int, eventos text, papeis text,
  site text, linkedin text, status_busca text, n_contatos int, primeiro_visto text,
  importado_em timestamptz not null default now()
);

create table if not exists public.pros_contatos (
  id text primary key,
  marca text, nome text not null default '', cargo text, area text, nivel text,
  prioridade int, linkedin text, email text, telefone text,
  confianca text, fonte text, tipo_fonte text, primeiro_visto text,
  status_contato text not null default 'novo',
  notas text,
  importado_em timestamptz not null default now()
);

-- Log de cada importação, pra saber de quando é o dado que está na tela.
create table if not exists public.pros_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text,
  eventos int not null default 0,
  marcas int not null default 0,
  contatos int not null default 0,
  autor text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pros_ev_urgencia on public.pros_eventos(urgencia);
create index if not exists idx_pros_ev_data on public.pros_eventos(data_inicio);
create index if not exists idx_pros_eventos_prioritarios_data on public.pros_eventos(data_inicio) where prioritario = true;
create index if not exists idx_pros_ev_negocio on public.pros_eventos(negocio_id) where negocio_id is not null;
create index if not exists idx_pros_ct_marca on public.pros_contatos(marca);
create index if not exists idx_pros_mc_marca on public.pros_marcas(marca);

-- ---------- Upsert que preserva as colunas comerciais ----------
-- O cliente manda o payload inteiro do robô; estas funções fazem
-- "insert ... on conflict do update" listando SÓ as colunas de pesquisa.
-- Assim status_comercial/responsavel/notas/negocio_id sobrevivem a toda
-- reimportação, que é exatamente o que o Leia-me promete.

create or replace function public.pros_upsert_eventos(linhas jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_write() then raise exception 'sem permissao de escrita'; end if;
  insert into public.pros_eventos (
    id, nome, edicao, setor, setores_secundarios, formato, status,
    data_inicio, data_fim, precisao_data, urgencia, cidade, uf, local, site,
    fit, justificativa_fit, alvo, publico_estimado, organizador, organizador_site,
    email_comercial, telefone, patrocinio_pagina, cota, cota_prazo, area_expositiva,
    patrocinadores, expositores, marcas_pesquisadas, primeiro_visto,
    ultima_verificacao, proxima_revisita, fonte, importado_em,
    -- só valem na PRIMEIRA vez que a linha entra (semeadas pelo que você já
    -- tinha anotado no Excel); daí em diante o banco é o dono e o DO UPDATE
    -- abaixo não as inclui.
    status_comercial, responsavel, notas)
  select
    x.id, x.nome, x.edicao, x.setor, x.setores_secundarios, x.formato, x.status,
    x.data_inicio, x.data_fim, x.precisao_data, x.urgencia, x.cidade, x.uf, x.local, x.site,
    x.fit, x.justificativa_fit, x.alvo, x.publico_estimado, x.organizador, x.organizador_site,
    x.email_comercial, x.telefone, x.patrocinio_pagina, x.cota, x.cota_prazo, x.area_expositiva,
    x.patrocinadores, x.expositores, x.marcas_pesquisadas, x.primeiro_visto,
    x.ultima_verificacao, x.proxima_revisita, x.fonte, now(),
    coalesce(nullif(x.status_comercial, ''), 'novo'), nullif(x.responsavel, ''), nullif(x.notas, '')
  from jsonb_to_recordset(linhas) as x(
    id text, nome text, edicao text, setor text, setores_secundarios text, formato text, status text,
    data_inicio text, data_fim text, precisao_data text, urgencia text, cidade text, uf text, local text, site text,
    fit int, justificativa_fit text, alvo text, publico_estimado text, organizador text, organizador_site text,
    email_comercial text, telefone text, patrocinio_pagina text, cota text, cota_prazo text, area_expositiva text,
    patrocinadores text, expositores text, marcas_pesquisadas text, primeiro_visto text,
    ultima_verificacao text, proxima_revisita text, fonte text,
    status_comercial text, responsavel text, notas text)
  where x.id is not null and x.id <> ''
  on conflict (id) do update set
    nome = excluded.nome, edicao = excluded.edicao, setor = excluded.setor,
    setores_secundarios = excluded.setores_secundarios, formato = excluded.formato,
    status = excluded.status, data_inicio = excluded.data_inicio, data_fim = excluded.data_fim,
    precisao_data = excluded.precisao_data, urgencia = excluded.urgencia, cidade = excluded.cidade,
    uf = excluded.uf, local = excluded.local, site = excluded.site, fit = excluded.fit,
    justificativa_fit = excluded.justificativa_fit, alvo = excluded.alvo,
    publico_estimado = excluded.publico_estimado, organizador = excluded.organizador,
    organizador_site = excluded.organizador_site, email_comercial = excluded.email_comercial,
    telefone = excluded.telefone, patrocinio_pagina = excluded.patrocinio_pagina,
    cota = excluded.cota, cota_prazo = excluded.cota_prazo, area_expositiva = excluded.area_expositiva,
    patrocinadores = excluded.patrocinadores, expositores = excluded.expositores,
    marcas_pesquisadas = excluded.marcas_pesquisadas, primeiro_visto = excluded.primeiro_visto,
    ultima_verificacao = excluded.ultima_verificacao, proxima_revisita = excluded.proxima_revisita,
    fonte = excluded.fonte, importado_em = now();
    -- status_comercial, responsavel, notas e negocio_id: intencionalmente FORA.
  get diagnostics n = row_count;
  return n;
end $$;

-- Sincroniza a seleção da aba ⭐ Prioritários sem apagar o restante do Radar.
create or replace function public.pros_marcar_prioritarios(ids text[])
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_write() then raise exception 'sem permissao de escrita'; end if;

  select count(*) into n
  from public.pros_eventos
  where id = any(coalesce(ids, array[]::text[]));

  update public.pros_eventos
  set prioritario = (id = any(coalesce(ids, array[]::text[])))
  where prioritario is distinct from (id = any(coalesce(ids, array[]::text[])));

  return n;
end $$;
revoke all on function public.pros_marcar_prioritarios(text[]) from public;
revoke all on function public.pros_marcar_prioritarios(text[]) from anon;
grant execute on function public.pros_marcar_prioritarios(text[]) to authenticated;

create or replace function public.pros_upsert_marcas(linhas jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_write() then raise exception 'sem permissao de escrita'; end if;
  insert into public.pros_marcas (
    id, marca, setores, n_eventos, eventos, papeis, site, linkedin,
    status_busca, n_contatos, primeiro_visto, importado_em)
  select x.id, x.marca, x.setores, x.n_eventos, x.eventos, x.papeis, x.site, x.linkedin,
         x.status_busca, x.n_contatos, x.primeiro_visto, now()
  from jsonb_to_recordset(linhas) as x(
    id text, marca text, setores text, n_eventos int, eventos text, papeis text,
    site text, linkedin text, status_busca text, n_contatos int, primeiro_visto text)
  where x.id is not null and x.id <> ''
  on conflict (id) do update set
    marca = excluded.marca, setores = excluded.setores, n_eventos = excluded.n_eventos,
    eventos = excluded.eventos, papeis = excluded.papeis, site = excluded.site,
    linkedin = excluded.linkedin, status_busca = excluded.status_busca,
    n_contatos = excluded.n_contatos, primeiro_visto = excluded.primeiro_visto,
    importado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.pros_upsert_contatos(linhas jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_write() then raise exception 'sem permissao de escrita'; end if;
  insert into public.pros_contatos (
    id, marca, nome, cargo, area, nivel, prioridade, linkedin, email, telefone,
    confianca, fonte, tipo_fonte, primeiro_visto, importado_em,
    status_contato, notas)  -- só na primeira entrada da linha; ver comentário em pros_upsert_eventos
  select x.id, x.marca, x.nome, x.cargo, x.area, x.nivel, x.prioridade, x.linkedin,
         x.email, x.telefone, x.confianca, x.fonte, x.tipo_fonte, x.primeiro_visto, now(),
         coalesce(nullif(x.status_contato, ''), 'novo'), nullif(x.notas, '')
  from jsonb_to_recordset(linhas) as x(
    id text, marca text, nome text, cargo text, area text, nivel text, prioridade int,
    linkedin text, email text, telefone text, confianca text, fonte text,
    tipo_fonte text, primeiro_visto text, status_contato text, notas text)
  where x.id is not null and x.id <> ''
  on conflict (id) do update set
    marca = excluded.marca, nome = excluded.nome, cargo = excluded.cargo, area = excluded.area,
    nivel = excluded.nivel, prioridade = excluded.prioridade, linkedin = excluded.linkedin,
    email = excluded.email, telefone = excluded.telefone, confianca = excluded.confianca,
    fonte = excluded.fonte, tipo_fonte = excluded.tipo_fonte,
    primeiro_visto = excluded.primeiro_visto, importado_em = now();
    -- status_contato e notas: intencionalmente FORA.
  get diagnostics n = row_count;
  return n;
end $$;

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

-- Só cria negócio no funil quando o lead já foi convertido em cliente e tem
-- reunião marcada. Negócio, atividade de agenda e vínculo ficam atômicos.
create or replace function public.agendar_reuniao_lead(p_lead_id uuid, p_data date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare l public.leads%rowtype; n_id uuid;
begin
  if not public.can_write() then raise exception 'sem permissao de escrita'; end if;
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead nao encontrado'; end if;
  if l.cliente_id is null or l.status <> 'convertido' then
    raise exception 'converta o lead em cliente antes de agendar a reuniao';
  end if;
  if p_data is null then raise exception 'data da reuniao obrigatoria'; end if;
  if l.negocio_id is not null then return l.negocio_id; end if;

  insert into public.negocios (titulo, cliente_id, linha, etapa, probabilidade,
    proxima_acao, previsao_fechamento)
  values ('Reunião comercial — ' || l.empresa, l.cliente_id,
    case when l.tipo_cliente = 'publico' then 'publico' else 'corporativo' end,
    'qualificacao', 25, 'Registrar resultado da reunião e próximos passos', null)
  returning id into n_id;

  insert into public.atividades (negocio_id, cliente_id, tipo, descricao, origem,
    data_agendada, concluida)
  values (n_id, l.cliente_id, 'reuniao', 'Reunião comercial — ' || l.empresa,
    'crm', (p_data + time '12:00') at time zone 'America/Sao_Paulo', false);

  update public.leads set negocio_id = n_id, reuniao_em = p_data where id = p_lead_id;
  return n_id;
end $$;
revoke all on function public.agendar_reuniao_lead(uuid, date) from public;
revoke all on function public.agendar_reuniao_lead(uuid, date) from anon;
grant execute on function public.agendar_reuniao_lead(uuid, date) to authenticated;

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
alter table public.pros_eventos enable row level security;
alter table public.pros_marcas enable row level security;
alter table public.pros_contatos enable row level security;
alter table public.pros_importacoes enable row level security;
alter table public.leads enable row level security;

-- Tabelas de dados: todos os logados leem; só admin/editor escrevem.
do $$
declare t text;
begin
  foreach t in array array['clientes','negocios','atividades','anexos','negocio_etapa_historico','contatos',
                           'pros_eventos','pros_marcas','pros_contatos','pros_importacoes','leads'] loop
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
