-- Local-only fixture data. `supabase db push` does not apply this file.
-- Demo login: +212600000001 / PalessoDemo2026!
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, phone, phone_confirmed_at, encrypted_password,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, phone_change_token,
  email_change_token_current, reauthentication_token, email_change_confirm_status,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'samira.demo@palesso.test', now(), '+212600000001', now(), crypt('PalessoDemo2026!', gen_salt('bf')),
  '', '', '', '', '', '', '', '', 0,
  '{"provider":"email","providers":["email","phone"]}'::jsonb,
  '{"full_name":"Samira El Idrissi","phone":"+212600000001"}'::jsonb,
  now(), now()
) on conflict (id) do update set
  email = excluded.email, email_confirmed_at = excluded.email_confirmed_at,
  phone = excluded.phone, phone_confirmed_at = excluded.phone_confirmed_at,
  encrypted_password = excluded.encrypted_password, raw_app_meta_data = excluded.raw_app_meta_data,
  confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '',
  phone_change = '', phone_change_token = '', email_change_token_current = '', reauthentication_token = '',
  email_change_confirm_status = 0, raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values (
  'samira.demo@palesso.test',
  'a1111111-1111-4111-8111-111111111111',
  '{"sub":"a1111111-1111-4111-8111-111111111111","email":"samira.demo@palesso.test"}'::jsonb,
  'email', now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, full_name, phone, email)
values ('a1111111-1111-4111-8111-111111111111', 'Samira El Idrissi', '+212600000001', 'samira.demo@palesso.test')
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, email = excluded.email, updated_at = now();

insert into public.technicians (id, name, specialty, rating, review_count, completed_jobs, experience_years, biography, avatar_url)
values
  ('t1', 'Youssef El Amrani', 'Plomberie', 4.9, 128, 340, 8, 'Artisan plombier à Casablanca, spécialisé en dépannage et installation.', 'https://i.pravatar.cc/300?img=12'),
  ('t2', 'Amine Berrada', 'Plomberie', 4.8, 86, 215, 6, 'Interventions soignées et conseils transparents pour vos installations.', 'https://i.pravatar.cc/300?img=11'),
  ('t3', 'Karim Zahraoui', 'Plomberie', 4.7, 63, 180, 5, 'Disponible rapidement dans le Grand Casablanca.', 'https://i.pravatar.cc/300?img=14'),
  ('t4', 'Nadia Benali', 'Électricité', 4.9, 91, 244, 7, 'Installation électrique et dépannage résidentiel.', 'https://i.pravatar.cc/300?img=47')
on conflict (id) do update set
  name = excluded.name, specialty = excluded.specialty, rating = excluded.rating,
  review_count = excluded.review_count, completed_jobs = excluded.completed_jobs,
  experience_years = excluded.experience_years, biography = excluded.biography, avatar_url = excluded.avatar_url;

insert into public.addresses (id, user_id, label, address, details, latitude, longitude, is_default)
values
  ('a2222222-2222-4222-8222-222222222221', 'a1111111-1111-4111-8111-111111111111', 'Maison', 'Maarif, Casablanca', 'Résidence Al Amal, immeuble B', 33.5899, -7.6326, true),
  ('a2222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111', 'Travail', 'Sidi Maarouf, Casablanca', null, 33.5292, -7.6604, false)
on conflict (id) do nothing;

insert into public.service_requests (
  id, reference, user_id, category_id, service_types, service_item_ids, description,
  address_id, address_snapshot, urgency, scheduled_at, all_day, status, accepted_offer_id, created_at, updated_at
) values
  ('b3333333-3333-4333-8333-333333333331', 'PL-DEMO001', 'a1111111-1111-4111-8111-111111111111', 'plomberie', array['Filtre d’eau'], array['filter'], 'Le filtre est à installer sous l’évier.', 'a2222222-2222-4222-8222-222222222221', '{"label":"Maison","address":"Maarif, Casablanca","details":"Résidence Al Amal, immeuble B","latitude":33.5899,"longitude":-7.6326}'::jsonb, 'urgent', null, false, 'OFFERS_RECEIVED', null, now() - interval '2 days', now() - interval '2 days'),
  ('b3333333-3333-4333-8333-333333333332', 'PL-DEMO002', 'a1111111-1111-4111-8111-111111111111', 'plomberie', array['Lavabo'], array['sink'], 'Le robinet goutte depuis hier.', 'a2222222-2222-4222-8222-222222222221', '{"label":"Maison","address":"Maarif, Casablanca","details":"Résidence Al Amal, immeuble B","latitude":33.5899,"longitude":-7.6326}'::jsonb, 'scheduled', '2026-10-26 10:00:00+01', false, 'IN_PROGRESS', null, now() - interval '5 days', now() - interval '1 day'),
  ('b3333333-3333-4333-8333-333333333333', 'PL-DEMO003', 'a1111111-1111-4111-8111-111111111111', 'electricite', array['Éclairage'], array['lighting'], 'Pose d’un plafonnier dans le salon.', 'a2222222-2222-4222-8222-222222222222', '{"label":"Travail","address":"Sidi Maarouf, Casablanca","latitude":33.5292,"longitude":-7.6604}'::jsonb, 'scheduled', '2026-10-12 14:00:00+01', false, 'COMPLETED', null, now() - interval '15 days', now() - interval '13 days'),
  ('b3333333-3333-4333-8333-333333333334', 'PL-DEMO004', 'a1111111-1111-4111-8111-111111111111', 'nettoyage', array['Nettoyage complet'], array['deepclean'], 'Nettoyage de l’appartement.', 'a2222222-2222-4222-8222-222222222221', '{"label":"Maison","address":"Maarif, Casablanca","details":"Résidence Al Amal, immeuble B","latitude":33.5899,"longitude":-7.6326}'::jsonb, 'urgent', null, false, 'CANCELLED', null, now() - interval '23 days', now() - interval '22 days')
on conflict (id) do nothing;

insert into public.offers (id, request_id, technician_id, proposed_price_mad, message, availability, proposed_at, status)
values
  ('c4444444-4444-4444-8444-444444444431', 'b3333333-3333-4333-8333-333333333331', 't1', 250, 'Je peux intervenir rapidement. Matériel inclus.', 'Demain · 16h–18h', now() + interval '1 day', 'PENDING'),
  ('c4444444-4444-4444-8444-444444444432', 'b3333333-3333-4333-8333-333333333331', 't2', 220, 'Disponible demain matin, intervention soignée.', 'Demain · 9h–11h', now() + interval '1 day', 'PENDING'),
  ('c4444444-4444-4444-8444-444444444433', 'b3333333-3333-4333-8333-333333333331', 't3', 280, 'Expert en filtration, déplacement inclus.', 'Demain · 18h–20h', now() + interval '1 day', 'PENDING'),
  ('c4444444-4444-4444-8444-444444444441', 'b3333333-3333-4333-8333-333333333332', 't2', 300, 'Je confirme le rendez-vous.', '26 oct. · 10h', '2026-10-26 10:00:00+01', 'ACCEPTED')
on conflict (id) do nothing;

update public.service_requests
set accepted_offer_id = 'c4444444-4444-4444-8444-444444444441'
where id = 'b3333333-3333-4333-8333-333333333332' and accepted_offer_id is null;

insert into public.appointments (request_id, offer_id, scheduled_at, all_day, status)
values ('b3333333-3333-4333-8333-333333333332', 'c4444444-4444-4444-8444-444444444441', '2026-10-26 10:00:00+01', false, 'CONFIRMED')
on conflict (request_id) do nothing;

insert into public.notifications (id, user_id, request_id, title, body, kind, is_read, created_at)
values
  ('d5555555-5555-4555-8555-555555555551', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333331', 'Nouvelles offres reçues', 'Trois artisans ont répondu à votre demande.', 'offer', false, now() - interval '1 hour'),
  ('d5555555-5555-4555-8555-555555555552', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333332', 'Rendez-vous confirmé', 'Votre intervention est prévue le 26 octobre.', 'appointment', false, now() - interval '1 day'),
  ('d5555555-5555-4555-8555-555555555553', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333', 'Intervention terminée', 'Votre demande est marquée comme terminée.', 'status', true, now() - interval '12 days'),
  ('d5555555-5555-4555-8555-555555555554', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333334', 'Demande annulée', 'Cette demande de démonstration a été annulée.', 'status', true, now() - interval '22 days')
on conflict (id) do nothing;
