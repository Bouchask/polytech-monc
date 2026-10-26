-- MANUAL / DESTRUCTIVE ROLLBACK for 20261026140000_media_pipeline.sql.
-- Before running: confirm no request_media.byte_size exceeds 50 MiB and back up
-- all media metadata. This drops the new metadata columns and restores the prior RPC.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.request_media WHERE byte_size > 52428800) THEN
    RAISE EXCEPTION 'Cannot restore the 50 MiB constraint while larger media rows exist';
  END IF;
END $$;
alter table public.request_media drop constraint if exists request_media_processing_status_check;
alter table public.request_media drop constraint if exists request_media_byte_size_check;
alter table public.request_media add constraint request_media_byte_size_check
  check (byte_size > 0 and byte_size <= 52428800);
alter table public.request_media
  drop column if exists public_url,
  drop column if exists original_mime_type,
  drop column if exists file_extension,
  drop column if exists original_size_bytes,
  drop column if exists compression_ratio,
  drop column if exists original_width,
  drop column if exists original_height,
  drop column if exists processed_width,
  drop column if exists processed_height,
  drop column if exists original_codec,
  drop column if exists output_codec,
  drop column if exists sample_rate,
  drop column if exists channel_count,
  drop column if exists original_audio_bitrate,
  drop column if exists processed_audio_bitrate,
  drop column if exists original_frame_rate,
  drop column if exists processed_frame_rate,
  drop column if exists processing_profile,
  drop column if exists processing_settings,
  drop column if exists processing_status,
  drop column if exists processing_error,
  drop column if exists original_object_key,
  drop column if exists thumbnail_object_key,
  drop column if exists processing_started_at,
  drop column if exists processing_completed_at,
  drop column if exists object_disk;

create or replace function public.create_service_request(p_request jsonb)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_owner uuid := auth.uid();
  v_category_id text := p_request ->> 'categoryId';
  service_types text[] := array(select distinct element from pg_catalog.jsonb_array_elements_text(coalesce(p_request -> 'serviceTypes', '[]'::jsonb)) as entries(element));
  service_item_ids text[] := array(select distinct element from pg_catalog.jsonb_array_elements_text(coalesce(p_request -> 'serviceItemIds', '[]'::jsonb)) as entries(element));
  custom_service text := nullif(pg_catalog.btrim(coalesce(p_request ->> 'customService', '')), '');
  description text := coalesce(p_request ->> 'description', '');
  urgency text := p_request ->> 'urgency';
  scheduled_at timestamptz;
  all_day boolean := coalesce((p_request ->> 'allDay')::boolean, false);
  address jsonb := p_request -> 'address';
  request_row public.service_requests%rowtype;
  media_item jsonb;
  media_count integer := 0;
  image_count integer := 0;
  video_count integer := 0;
  audio_count integer := 0;
begin
  if request_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_category_id is null or not exists (select 1 from public.categories c where c.id = v_category_id) then
    raise exception 'Invalid category' using errcode = '22023';
  end if;
  if cardinality(service_types) = 0 and custom_service is null then
    raise exception 'A service type or custom service is required' using errcode = '22023';
  end if;
  if custom_service is not null and pg_catalog.char_length(custom_service) > 120 then
    raise exception 'Custom service is too long' using errcode = '22023';
  end if;
  if pg_catalog.char_length(description) > 5000 then
    raise exception 'Description is too long' using errcode = '22023';
  end if;
  if cardinality(service_types) > 0 and (
    select pg_catalog.count(*) from public.service_types t where t.category_id = v_category_id and t.name = any(service_types)
  ) <> cardinality(service_types) then
    raise exception 'Invalid service type' using errcode = '22023';
  end if;
  if cardinality(service_item_ids) > 0 and (
    select pg_catalog.count(*) from public.service_items i where i.category_id = v_category_id and i.id = any(service_item_ids)
  ) <> cardinality(service_item_ids) then
    raise exception 'Invalid service item' using errcode = '22023';
  end if;
  if urgency not in ('urgent', 'scheduled') then
    raise exception 'Invalid urgency' using errcode = '22023';
  end if;
  if address is null or pg_catalog.jsonb_typeof(address) <> 'object'
    or nullif(pg_catalog.btrim(address ->> 'address'), '') is null
    or pg_catalog.char_length(address ->> 'address') > 300 then
    raise exception 'A valid address is required' using errcode = '22023';
  end if;
  if urgency = 'scheduled' and not all_day then
    begin
      scheduled_at := (p_request ->> 'scheduledAt')::timestamptz;
    exception when others then
      raise exception 'A valid future schedule is required' using errcode = '22023';
    end;
    if scheduled_at <= now() then
      raise exception 'A valid future schedule is required' using errcode = '22023';
    end if;
  end if;

  insert into public.service_requests (
    user_id, category_id, service_types, service_item_ids, custom_service, description,
    address_snapshot, urgency, scheduled_at, all_day
  ) values (
    request_owner, v_category_id, service_types, service_item_ids, custom_service, description,
    jsonb_build_object(
      'label', left(coalesce(address ->> 'label', 'Adresse'), 80),
      'address', pg_catalog.btrim(address ->> 'address'),
      'details', nullif(left(coalesce(address ->> 'details', ''), 500), ''),
      'latitude', address -> 'latitude',
      'longitude', address -> 'longitude'
    ),
    urgency, case when urgency = 'scheduled' and not all_day then scheduled_at else null end, all_day
  ) returning * into request_row;

  if pg_catalog.jsonb_typeof(coalesce(p_request -> 'media', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid attachments' using errcode = '22023';
  end if;
  for media_item in select element from pg_catalog.jsonb_array_elements(coalesce(p_request -> 'media', '[]'::jsonb)) as entries(element) loop
    media_count := media_count + 1;
    if media_item ->> 'type' = 'image' then image_count := image_count + 1;
    elsif media_item ->> 'type' = 'video' then video_count := video_count + 1;
    elsif media_item ->> 'type' = 'audio' then audio_count := audio_count + 1;
    else raise exception 'Invalid attachment type' using errcode = '22023';
    end if;
    if coalesce(media_item ->> 'storagePath', '') not like request_owner::text || '/%'
      or pg_catalog.char_length(coalesce(media_item ->> 'fileName', '')) not between 1 and 255
      or (media_item ->> 'byteSize')::bigint not between 1 and 52428800
      or media_item ->> 'mimeType' not in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/webm') then
      raise exception 'Invalid attachment metadata' using errcode = '22023';
    end if;
    insert into public.request_media (request_id, user_id, media_type, storage_path, file_name, mime_type, byte_size, duration_ms)
    values (request_row.id, request_owner, media_item ->> 'type', media_item ->> 'storagePath', media_item ->> 'fileName', media_item ->> 'mimeType', (media_item ->> 'byteSize')::bigint, nullif(media_item ->> 'durationMs', '')::integer);
  end loop;
  if image_count > 4 or video_count > 2 or audio_count > 1 or media_count > 7 then
    raise exception 'Attachment limits exceeded' using errcode = '22023';
  end if;
  return request_row;
end;
$$;
revoke all on function public.create_service_request(jsonb) from public, anon;
grant execute on function public.create_service_request(jsonb) to authenticated;

drop index if exists public.request_media_processing_queue_idx;
