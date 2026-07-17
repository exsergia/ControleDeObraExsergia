create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g');
  digits_sem_pais text := case when left(regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g'), 2) = '55'
    then substr(regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g'), 3)
    else regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g')
  end;
  resolved_email text;
begin
  if digits = '' then
    return null;
  end if;

  select lower(c.data ->> 'email')
    into resolved_email
  from public.cpfs c
  where c.id = digits
     or c.id = digits_sem_pais
  limit 1;

  if resolved_email is not null and resolved_email <> '' then
    return resolved_email;
  end if;

  select lower(coalesce(o.email, o.data ->> 'email'))
    into resolved_email
  from public.operadores o
  where regexp_replace(coalesce(o.cpf, o.data ->> 'cpf', ''), '\D', '', 'g') in (digits, digits_sem_pais)
     or regexp_replace(coalesce(o.telefone, o.data ->> 'telefone', ''), '\D', '', 'g') in (digits, digits_sem_pais)
     or right(regexp_replace(coalesce(o.telefone, o.data ->> 'telefone', ''), '\D', '', 'g'), 11) = right(digits_sem_pais, 11)
  limit 1;

  return nullif(resolved_email, '');
end;
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;
