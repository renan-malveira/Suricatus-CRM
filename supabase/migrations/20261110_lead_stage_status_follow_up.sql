-- Separate prospecting progress (Etapa) from lead outcome (Status).
alter table public.leads
  add column if not exists etapa text not null default 'novo',
  add column if not exists status_resultado text not null default 'aberto';

update public.leads
set etapa = case status
  when 'novo' then 'novo'
  when 'contatado' then 'primeiro_contato'
  when 'respondeu' then 'respondeu'
  when 'interessado' then 'interessado'
  when 'sem_interesse' then 'respondeu'
  when 'convertido' then 'interessado'
  else 'novo'
end,
status_resultado = case status
  when 'sem_interesse' then 'perdido'
  when 'convertido' then 'ganho'
  else 'aberto'
end;

alter table public.leads drop constraint if exists leads_etapa_check;
alter table public.leads add constraint leads_etapa_check
  check (etapa in ('novo','primeiro_contato','follow_up','respondeu','interessado','reuniao_agendada','reuniao_realizada'));
alter table public.leads drop constraint if exists leads_status_resultado_check;
alter table public.leads add constraint leads_status_resultado_check
  check (status_resultado in ('aberto','ganho','perdido'));

create index if not exists idx_leads_etapa on public.leads(etapa);
create index if not exists idx_leads_status_resultado on public.leads(status_resultado);

create or replace function public.sp_easter_sunday(p_year integer)
returns date language plpgsql immutable as $$
declare
  a integer; b integer; c integer; d integer; e integer; f integer; g integer;
  h integer; i integer; k integer; l integer; m integer; month_no integer; day_no integer;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  month_no := (h + l - 7 * m + 114) / 31;
  day_no := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, month_no, day_no);
end $$;

create or replace function public.is_business_day_sao_paulo(p_date date)
returns boolean language sql immutable as $$
  select extract(isodow from p_date) < 6
    and to_char(p_date, 'MM-DD') not in (
      '01-01','01-25','04-21','05-01','07-09','09-07','10-12',
      '11-02','11-15','11-20','12-25'
    )
    and p_date not in (
      public.sp_easter_sunday(extract(year from p_date)::integer) - 2,
      public.sp_easter_sunday(extract(year from p_date)::integer) + 60
    );
$$;

create or replace function public.calcular_follow_up_lead(p_contact_date date)
returns date language plpgsql immutable as $$
declare
  candidate date := p_contact_date;
  business_days integer := 0;
begin
  if p_contact_date is null then return null; end if;
  while business_days < 5 loop
    candidate := candidate + 1;
    if public.is_business_day_sao_paulo(candidate) then
      business_days := business_days + 1;
    end if;
  end loop;
  return candidate;
end $$;

create or replace function public.set_lead_follow_up()
returns trigger language plpgsql as $$
begin
  new.proximo_follow_up := public.calcular_follow_up_lead(new.primeiro_contato_em);
  return new;
end $$;

drop trigger if exists trg_lead_follow_up on public.leads;
create trigger trg_lead_follow_up
before insert or update of primeiro_contato_em, proximo_follow_up on public.leads
for each row execute function public.set_lead_follow_up();

-- Existing follow-up dates become consistent with the new automatic rule.
update public.leads
set proximo_follow_up = public.calcular_follow_up_lead(primeiro_contato_em);
