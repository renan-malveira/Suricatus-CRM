alter table public.leads
  add column if not exists updated_at timestamptz;

-- Existing contact dates are the only persisted signal of past edits.
-- Keep today's marked contacts ahead of the leads imported today.
update public.leads
set updated_at = case
  when primeiro_contato_em = current_date then now()
  when primeiro_contato_em is not null then greatest(created_at, primeiro_contato_em::timestamptz)
  else created_at
end
where updated_at is null;

alter table public.leads
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists idx_leads_updated_at
  on public.leads(updated_at desc, created_at desc);

create or replace function public.touch_lead_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.touch_lead_updated_at();
