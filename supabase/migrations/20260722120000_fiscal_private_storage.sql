insert into storage.buckets (id, name, public)
values ('fiscal-private', 'fiscal-private', false)
on conflict (id) do update set public = false;

drop policy if exists "authenticated read fiscal private" on storage.objects;
drop policy if exists "authenticated upload fiscal private" on storage.objects;
drop policy if exists "authenticated update fiscal private" on storage.objects;
drop policy if exists "admin delete fiscal private" on storage.objects;

create policy "authenticated read fiscal private"
on storage.objects for select
to authenticated
using (bucket_id = 'fiscal-private');

create policy "authenticated upload fiscal private"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fiscal-private');

create policy "authenticated update fiscal private"
on storage.objects for update
to authenticated
using (bucket_id = 'fiscal-private')
with check (bucket_id = 'fiscal-private');

create policy "admin delete fiscal private"
on storage.objects for delete
to authenticated
using (bucket_id = 'fiscal-private' and public.is_app_admin());
