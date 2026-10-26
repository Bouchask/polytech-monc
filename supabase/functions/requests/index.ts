import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json, readJson } from '../_shared/http.ts';

type MediaInput = {
  type: 'image' | 'video' | 'audio';
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  durationMs?: number;
};

const allowedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
]);

function errorResponse(error: { code?: string } | null, fallback: string): Response {
  if (!error) return failure(fallback, 500);
  if (error.code === '23505' || error.code === '23503' || error.code === '23514') {
    return failure('Certaines informations de la demande sont invalides.', 400);
  }
  return failure(fallback, 500);
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.jwtClaims?.sub;
    if (typeof userId !== 'string') return failure('Session utilisateur invalide.', 401);

    if (request.method === 'GET') {
      const id = new URL(request.url).searchParams.get('id');
      let query = ctx.supabase.from('service_requests').select('*').order('created_at', { ascending: false });
      if (id) query = query.eq('id', id);
      const { data, error } = await query;
      if (error) return errorResponse(error, 'Impossible de charger vos demandes.');
      return json({ data });
    }

    if (request.method !== 'POST') return failure('Méthode non autorisée.', 405);
    const body = await readJson(request);
    if (!body) return failure('Corps JSON invalide.');

    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const serviceTypes = Array.isArray(body.serviceTypes) ? body.serviceTypes.filter((x): x is string => typeof x === 'string') : [];
    const serviceItemIds = Array.isArray(body.serviceItemIds) ? body.serviceItemIds.filter((x): x is string => typeof x === 'string') : [];
    const customService = typeof body.customService === 'string' ? body.customService.trim() : '';
    const description = typeof body.description === 'string' ? body.description : '';
    const urgency = body.urgency === 'scheduled' ? 'scheduled' : body.urgency === 'urgent' ? 'urgent' : null;
    const allDay = body.allDay === true;
    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : null;
    const address = body.address && typeof body.address === 'object' && !Array.isArray(body.address)
      ? body.address as Record<string, unknown>
      : null;

    if (!categoryId || (!serviceTypes.length && !customService)) return failure('Choisissez un service ou décrivez une demande personnalisée.');
    if (customService.length > 120) return failure('Le nom du service personnalisé est trop long.');
    if (description.length > 5000) return failure('La description dépasse 5 000 caractères.');
    if (!urgency) return failure('Le mode d’intervention est invalide.');
    if (!address || typeof address.address !== 'string' || !address.address.trim() || address.address.length > 300) {
      return failure('Une adresse d’intervention valide est obligatoire.');
    }
    if (urgency === 'scheduled' && !allDay) {
      const date = scheduledAt ? new Date(scheduledAt) : null;
      if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        return failure('Choisissez une date de rendez-vous future.');
      }
    }

    const { data: category, error: categoryError } = await ctx.supabase
      .from('categories').select('id').eq('id', categoryId).maybeSingle();
    if (categoryError || !category) return failure('La catégorie sélectionnée est introuvable.');

    if (serviceTypes.length) {
      const { data: validTypes, error } = await ctx.supabase.from('service_types')
        .select('name').eq('category_id', categoryId).in('name', serviceTypes);
      if (error || (validTypes?.length ?? 0) !== new Set(serviceTypes).size) {
        return failure('Un type de service ne correspond pas à cette catégorie.');
      }
    }

    if (serviceItemIds.length) {
      const { data: validItems, error } = await ctx.supabase.from('service_items')
        .select('id').eq('category_id', categoryId).in('id', serviceItemIds);
      if (error || (validItems?.length ?? 0) !== new Set(serviceItemIds).size) {
        return failure('Une prestation sélectionnée est invalide.');
      }
    }

    const media = Array.isArray(body.media) ? body.media : [];
    const normalizedMedia: MediaInput[] = [];
    for (const raw of media) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return failure('Une pièce jointe est invalide.');
      const item = raw as Record<string, unknown>;
      if (!['image', 'video', 'audio'].includes(String(item.type))
        || typeof item.storagePath !== 'string'
        || !item.storagePath.startsWith(`${userId}/`)
        || item.storagePath.includes('..')
        || typeof item.fileName !== 'string' || !item.fileName.trim() || item.fileName.length > 255
        || typeof item.mimeType !== 'string' || !allowedMimeTypes.has(item.mimeType)
        || typeof item.byteSize !== 'number' || !Number.isInteger(item.byteSize) || item.byteSize <= 0 || item.byteSize > 52_428_800
        || (item.durationMs !== undefined && (typeof item.durationMs !== 'number' || item.durationMs < 0 || item.durationMs > 3_600_000))) {
        return failure('Le format ou la taille d’une pièce jointe est invalide.');
      }
      normalizedMedia.push({
        type: item.type as MediaInput['type'], storagePath: item.storagePath,
        fileName: item.fileName, mimeType: item.mimeType, byteSize: item.byteSize,
        ...(typeof item.durationMs === 'number' ? { durationMs: item.durationMs } : {}),
      });
    }
    if (normalizedMedia.filter((item) => item.type === 'image').length > 4
      || normalizedMedia.filter((item) => item.type === 'video').length > 2
      || normalizedMedia.filter((item) => item.type === 'audio').length > 1) {
      return failure('La demande dépasse les limites de pièces jointes autorisées.');
    }

    const snapshot = {
      label: typeof address.label === 'string' ? address.label.slice(0, 80) : 'Adresse',
      address: address.address.trim(),
      ...(typeof address.details === 'string' ? { details: address.details.slice(0, 500) } : {}),
      ...(typeof address.latitude === 'number' ? { latitude: address.latitude } : {}),
      ...(typeof address.longitude === 'number' ? { longitude: address.longitude } : {}),
    };

    const { data: created, error: createError } = await ctx.supabaseAdmin.from('service_requests').insert({
      user_id: userId,
      category_id: categoryId,
      service_types: [...new Set(serviceTypes)],
      service_item_ids: [...new Set(serviceItemIds)],
      custom_service: customService || null,
      description,
      address_snapshot: snapshot,
      urgency,
      scheduled_at: urgency === 'scheduled' && !allDay ? scheduledAt : null,
      all_day: allDay,
    }).select('*').single();
    if (createError || !created) return errorResponse(createError, 'Impossible de publier la demande.');

    if (normalizedMedia.length) {
      const { error: mediaError } = await ctx.supabaseAdmin.from('request_media').insert(normalizedMedia.map((item) => ({
        request_id: created.id,
        user_id: userId,
        media_type: item.type,
        storage_path: item.storagePath,
        file_name: item.fileName,
        mime_type: item.mimeType,
        byte_size: item.byteSize,
        duration_ms: item.durationMs ?? null,
      })));
      if (mediaError) {
        await ctx.supabaseAdmin.from('service_requests').delete().eq('id', created.id).eq('user_id', userId);
        return errorResponse(mediaError, 'Impossible d’enregistrer les pièces jointes.');
      }
    }

    return json({ data: created }, 201);
  }),
};
