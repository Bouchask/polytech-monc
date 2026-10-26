-- Phone Auth is the account identifier. Optional email stays in auth metadata
-- and the customer profile; no existing email-auth users or constraints change.
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
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.email, nullif(new.raw_user_meta_data ->> 'email', ''))
  )
  on conflict (id) do update set
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
    phone = case when excluded.phone <> '' then excluded.phone else public.profiles.phone end,
    email = coalesce(excluded.email, public.profiles.email),
    updated_at = now();
  return new;
end;
$$;
