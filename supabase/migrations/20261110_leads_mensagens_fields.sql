alter table public.leads
  add column if not exists evento_prioritario text,
  add column if not exists source_mensagem_id text;

create unique index if not exists idx_leads_source_mensagem_id
  on public.leads(source_mensagem_id)
  where source_mensagem_id is not null;

-- Reuniões passam a ser tratadas depois, nas áreas de clientes e funil.
update public.leads
set etapa = 'interessado'
where etapa in ('reuniao_agendada', 'reuniao_realizada');

alter table public.leads drop constraint if exists leads_etapa_check;
alter table public.leads add constraint leads_etapa_check
  check (etapa in ('novo','primeiro_contato','follow_up','respondeu','interessado'));
