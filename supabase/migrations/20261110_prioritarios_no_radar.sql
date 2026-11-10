-- O Radar apresenta apenas os eventos selecionados na aba ⭐ Prioritários.
alter table public.pros_eventos
  add column if not exists prioritario boolean not null default false;

create index if not exists idx_pros_eventos_prioritarios_data
  on public.pros_eventos (data_inicio)
  where prioritario = true;

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
