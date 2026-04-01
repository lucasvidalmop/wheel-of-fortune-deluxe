
insert into storage.buckets (id, name, public) values ('app-assets', 'app-assets', true) on conflict (id) do nothing;

create policy "Authenticated users can upload app assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'app-assets');

create policy "Anyone can view app assets"
on storage.objects for select to public
using (bucket_id = 'app-assets');

create policy "Authenticated users can update app assets"
on storage.objects for update to authenticated
using (bucket_id = 'app-assets')
with check (bucket_id = 'app-assets');

create policy "Authenticated users can delete app assets"
on storage.objects for delete to authenticated
using (bucket_id = 'app-assets');
