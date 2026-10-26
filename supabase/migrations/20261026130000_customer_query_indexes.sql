-- Keep the common customer list and request attachment reads index-backed.
create index if not exists addresses_user_created_idx
  on public.addresses (user_id, created_at desc);

create index if not exists request_media_request_created_idx
  on public.request_media (request_id, created_at);
