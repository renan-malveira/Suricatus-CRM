-- Leads de prospecção, separados do Radar de eventos.
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

alter table public.leads enable row level security;
drop policy if exists "leads_sel" on public.leads;
drop policy if exists "leads_ins" on public.leads;
drop policy if exists "leads_upd" on public.leads;
drop policy if exists "leads_del" on public.leads;
create policy "leads_sel" on public.leads for select to authenticated using (true);
create policy "leads_ins" on public.leads for insert to authenticated with check (public.can_write());
create policy "leads_upd" on public.leads for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "leads_del" on public.leads for delete to authenticated using (public.can_write());

-- Converte o compromisso em atividade da Agenda e negócio de qualificação,
-- em uma transação só, depois da conversão do lead em cliente.
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
