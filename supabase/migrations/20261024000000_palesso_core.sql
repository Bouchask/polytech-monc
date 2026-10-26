create extension if not exists pgcrypto;

create table public.categories (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.service_types (
  category_id text not null references public.categories(id) on delete cascade,
  name text not null,
  primary key (category_id, name)
);

create table public.service_items (
  id text primary key,
  category_id text not null,
  service_type text not null,
  name text not null,
  description text not null default '',
  min_price_mad integer,
  max_price_mad integer,
  image_url text not null default '',
  foreign key (category_id, service_type)
    references public.service_types(category_id, name) on delete cascade,
  check ((min_price_mad is null and max_price_mad is null)
    or (min_price_mad >= 0 and max_price_mad >= min_price_mad))
);

insert into public.categories (id, name, description, icon, image_url) values
  ('electricite', 'Électricité', 'Installation, dépannage et mise aux normes.', 'flash-outline', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900'),
  ('electromenager', 'Électroménager', 'Réparez vos appareils du quotidien.', 'cube-outline', 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=900'),
  ('plomberie', 'Plomberie', 'Des solutions fiables pour vos installations.', 'water-outline', 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=900'),
  ('peinture', 'Peinture', 'Rafraîchissez vos espaces avec soin.', 'color-palette-outline', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900'),
  ('nettoyage', 'Nettoyage', 'Un intérieur propre, sans effort.', 'sparkles-outline', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900')
on conflict (id) do nothing;

insert into public.service_types (category_id, name) values
  ('plomberie', 'Lavabo'), ('plomberie', 'Douche'), ('plomberie', 'Toilette'),
  ('plomberie', 'Bidet'), ('plomberie', 'Filtre d’eau'), ('plomberie', 'Chauffe-eau'),
  ('electricite', 'Prise électrique'), ('electricite', 'Éclairage'),
  ('electricite', 'Panne électrique'), ('electricite', 'Tableau électrique'),
  ('electromenager', 'Lave-linge'), ('electromenager', 'Réfrigérateur'),
  ('electromenager', 'Four'), ('electromenager', 'Lave-vaisselle'),
  ('peinture', 'Pièce complète'), ('peinture', 'Mur'), ('peinture', 'Retouches'),
  ('nettoyage', 'Nettoyage complet'), ('nettoyage', 'Cuisine'), ('nettoyage', 'Canapé')
on conflict do nothing;

insert into public.service_items
  (id, category_id, service_type, name, description, min_price_mad, max_price_mad, image_url)
values
  ('filter', 'plomberie', 'Filtre d’eau', 'Installation filtre d’eau', 'Installation et vérification des raccords.', 200, 300, 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=900'),
  ('cartridge', 'plomberie', 'Filtre d’eau', 'Remplacement de la cartouche', 'Remplacement et test de votre filtre.', 200, 250, 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=900'),
  ('sink', 'plomberie', 'Lavabo', 'Réparation de lavabo', 'Fuite, siphon ou robinetterie.', 150, 350, 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=900'),
  ('shower', 'plomberie', 'Douche', 'Réparation de douche', 'Robinet, flexible ou évacuation.', 180, 400, 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=900'),
  ('toilet', 'plomberie', 'Toilette', 'Dépannage toilette', 'Chasse d’eau et fuite.', 150, 350, 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900'),
  ('heater', 'plomberie', 'Chauffe-eau', 'Entretien chauffe-eau', 'Diagnostic et entretien courant.', 250, 500, 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900'),
  ('outlet', 'electricite', 'Prise électrique', 'Installation de prise', 'Pose ou remplacement sécurisé.', 150, 300, 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900'),
  ('lighting', 'electricite', 'Éclairage', 'Installation de luminaire', 'Montage et raccordement.', 120, 280, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900'),
  ('electrical-fault', 'electricite', 'Panne électrique', 'Dépannage électrique', 'Recherche de panne et remise en service.', null, null, 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900'),
  ('electrical-panel', 'electricite', 'Tableau électrique', 'Vérification du tableau électrique', 'Contrôle des protections et des connexions.', null, null, 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900'),
  ('washer', 'electromenager', 'Lave-linge', 'Réparation lave-linge', 'Diagnostic de panne à domicile.', 200, 500, 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=900'),
  ('fridge', 'electromenager', 'Réfrigérateur', 'Dépannage réfrigérateur', 'Diagnostic et réparation.', 250, 600, 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=900'),
  ('oven', 'electromenager', 'Four', 'Réparation de four', 'Diagnostic et réparation à domicile.', null, null, 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=900'),
  ('dishwasher', 'electromenager', 'Lave-vaisselle', 'Dépannage lave-vaisselle', 'Recherche de panne et vérification.', null, null, 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=900'),
  ('bidet', 'plomberie', 'Bidet', 'Réparation de bidet', 'Robinetterie, fuite ou évacuation.', null, null, 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=900'),
  ('roompaint', 'peinture', 'Pièce complète', 'Peinture d’une pièce', 'Préparation et finition soignée.', 800, 2200, 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900'),
  ('wallpaint', 'peinture', 'Mur', 'Peinture d’un mur', 'Préparation de surface et finition.', null, null, 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900'),
  ('paint-touchups', 'peinture', 'Retouches', 'Retouches de peinture', 'Petites réparations et finitions.', null, null, 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900'),
  ('deepclean', 'nettoyage', 'Nettoyage complet', 'Ménage en profondeur', 'Cuisine, salle de bain et surfaces.', 300, 700, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900'),
  ('kitchen-clean', 'nettoyage', 'Cuisine', 'Nettoyage de cuisine', 'Nettoyage des surfaces et équipements.', null, null, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900'),
  ('sofa-clean', 'nettoyage', 'Canapé', 'Nettoyage de canapé', 'Entretien des tissus et assises.', null, null, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900')
on conflict (id) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, ''),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 80),
  address text not null check (length(trim(address)) between 1 and 300),
  details text check (details is null or length(details) <= 500),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index addresses_one_default_per_user
  on public.addresses(user_id) where is_default;

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('PL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null references public.categories(id),
  service_types text[] not null default '{}',
  service_item_ids text[] not null default '{}',
  custom_service text check (custom_service is null or length(trim(custom_service)) <= 120),
  description text not null default '' check (char_length(description) <= 5000),
  address_id uuid references public.addresses(id) on delete set null,
  address_snapshot jsonb not null,
  urgency text not null check (urgency in ('urgent', 'scheduled')),
  scheduled_at timestamptz,
  all_day boolean not null default false,
  status text not null default 'PUBLISHED'
    check (status in ('PUBLISHED', 'OFFERS_RECEIVED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  accepted_offer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(service_types) > 0 or custom_service is not null),
  check (urgency <> 'scheduled' or all_day or scheduled_at is not null)
);

create index service_requests_user_created_idx on public.service_requests(user_id, created_at desc);

create table public.request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video', 'audio')),
  storage_path text not null,
  file_name text not null check (length(file_name) between 1 and 255),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  unique (request_id, storage_path)
);

create table public.technicians (
  id text primary key,
  name text not null,
  specialty text not null,
  rating numeric(2,1) check (rating is null or rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  completed_jobs integer not null default 0 check (completed_jobs >= 0),
  experience_years integer not null default 0 check (experience_years >= 0),
  biography text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  technician_id text not null references public.technicians(id),
  proposed_price_mad integer not null check (proposed_price_mad > 0),
  message text not null default '' check (char_length(message) <= 1000),
  availability text not null default '',
  proposed_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'NOT_SELECTED', 'REJECTED', 'WITHDRAWN')),
  created_at timestamptz not null default now(),
  unique (request_id, technician_id, id)
);

create index offers_request_idx on public.offers(request_id, created_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  offer_id uuid not null references public.offers(id),
  scheduled_at timestamptz,
  all_day boolean not null default false,
  status text not null default 'CONFIRMED'
    check (status in ('PROPOSED', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (all_day or scheduled_at is not null)
);

alter table public.service_requests
  add constraint service_requests_accepted_offer_fk
  foreign key (accepted_offer_id) references public.offers(id) on delete set null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 1000),
  kind text not null check (kind in ('offer', 'appointment', 'status')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.notify_request_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, request_id, title, body, kind)
  values (new.user_id, new.id, 'Demande publiée', 'Votre demande ' || new.reference || ' a bien été enregistrée.', 'status');
  return new;
end;
$$;

create trigger on_service_request_published
  after insert on public.service_requests
  for each row execute procedure public.notify_request_published();

create or replace function public.cancel_service_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_owner uuid;
  current_status text;
  request_ref text;
begin
  select user_id, status, reference into request_owner, current_status, request_ref
    from public.service_requests where id = p_request_id for update;
  if request_owner is distinct from auth.uid() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if current_status not in ('PUBLISHED', 'OFFERS_RECEIVED') then
    raise exception 'Request cannot be cancelled in its current state' using errcode = '22023';
  end if;
  update public.service_requests set status = 'CANCELLED', updated_at = now() where id = p_request_id;
  insert into public.notifications (user_id, request_id, title, body, kind)
    values (request_owner, p_request_id, 'Demande annulée', 'Votre demande ' || request_ref || ' a été annulée.', 'status');
end;
$$;

create or replace function public.accept_service_offer(p_request_id uuid, p_offer_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_owner uuid;
  request_status text;
  request_ref text;
  selected_offer public.offers%rowtype;
  appointment_row public.appointments%rowtype;
begin
  select user_id, status, reference into request_owner, request_status, request_ref
    from public.service_requests where id = p_request_id for update;
  if request_owner is distinct from auth.uid() then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if request_status not in ('PUBLISHED', 'OFFERS_RECEIVED') then
    raise exception 'Request cannot accept an offer in its current state' using errcode = '22023';
  end if;
  select * into selected_offer from public.offers
    where id = p_offer_id and request_id = p_request_id and status = 'PENDING' for update;
  if not found then
    raise exception 'Offer not available' using errcode = 'P0002';
  end if;
  update public.offers set status = case when id = p_offer_id then 'ACCEPTED' else 'NOT_SELECTED' end
    where request_id = p_request_id and status = 'PENDING';
  update public.service_requests set status = 'ACCEPTED', accepted_offer_id = p_offer_id, updated_at = now()
    where id = p_request_id;
  insert into public.appointments (request_id, offer_id, scheduled_at, all_day, status)
    values (p_request_id, p_offer_id, selected_offer.proposed_at, selected_offer.proposed_at is null, 'CONFIRMED')
    on conflict (request_id) do update set
      offer_id = excluded.offer_id,
      scheduled_at = excluded.scheduled_at,
      all_day = excluded.all_day,
      status = 'CONFIRMED',
      updated_at = now()
    returning * into appointment_row;
  insert into public.notifications (user_id, request_id, title, body, kind)
    values (request_owner, p_request_id, 'Offre acceptée', 'Votre offre pour la demande ' || request_ref || ' est confirmée.', 'appointment');
  return appointment_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set is_read = true
   where user_id = auth.uid() and (p_notification_id is null or id = p_notification_id);
end;
$$;

alter table public.categories enable row level security;
alter table public.service_types enable row level security;
alter table public.service_items enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_media enable row level security;
alter table public.technicians enable row level security;
alter table public.offers enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;

create policy "Catalog is readable" on public.categories for select to anon, authenticated using (true);
create policy "Service types are readable" on public.service_types for select to anon, authenticated using (true);
create policy "Service items are readable" on public.service_items for select to anon, authenticated using (true);
create policy "Technician previews are readable" on public.technicians for select to anon, authenticated using (true);

create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Read own addresses" on public.addresses for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own addresses" on public.addresses for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own addresses" on public.addresses for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own addresses" on public.addresses for delete to authenticated using (user_id = (select auth.uid()));
create policy "Read own requests" on public.service_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own request media" on public.request_media for select to authenticated using (user_id = (select auth.uid()));
create policy "Attach media to own request" on public.request_media for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.service_requests r where r.id = request_id and r.user_id = (select auth.uid())));
create policy "Read offers for own requests" on public.offers for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_id and r.user_id = (select auth.uid())));
create policy "Read appointments for own requests" on public.appointments for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_id and r.user_id = (select auth.uid())));
create policy "Read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));

grant select on public.categories, public.service_types, public.service_items, public.technicians to anon, authenticated;
grant select, insert, delete on public.addresses to authenticated;
grant select on public.profiles, public.service_requests, public.offers, public.appointments, public.notifications to authenticated;
grant select, insert on public.request_media to authenticated;

revoke insert, update, delete on public.service_requests from anon, authenticated;
revoke insert, update, delete on public.offers from anon, authenticated;
revoke insert, update, delete on public.appointments from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (full_name, phone, email, updated_at) on public.profiles to authenticated;
grant update (is_default, label, address, details, latitude, longitude) on public.addresses to authenticated;
grant update (is_read) on public.notifications to authenticated;

revoke all on function public.cancel_service_request(uuid) from public, anon;
revoke all on function public.accept_service_offer(uuid, uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.cancel_service_request(uuid) to authenticated;
grant execute on function public.accept_service_offer(uuid, uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-media', 'request-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/webm'])
on conflict (id) do nothing;

create policy "Read own request media files" on storage.objects for select to authenticated
  using (bucket_id = 'request-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own request media files" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own request media files" on storage.objects for delete to authenticated
  using (bucket_id = 'request-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
