import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json, isUuid, readJson } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.jwtClaims?.sub;
    if (typeof userId !== 'string') return failure('Session utilisateur invalide.', 401);

    if (request.method === 'GET') {
      const { data, error } = await ctx.supabase.from('addresses').select('*').order('created_at', { ascending: false });
      if (error) return failure('Impossible de charger les adresses.', 500);
      return json({ data });
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || typeof body.label !== 'string' || !body.label.trim() || body.label.length > 80
        || typeof body.address !== 'string' || !body.address.trim() || body.address.length > 300
        || (body.details !== undefined && (typeof body.details !== 'string' || body.details.length > 500))) {
        return failure('Les informations de l’adresse sont invalides.');
      }
      const latitude = typeof body.latitude === 'number' ? body.latitude : null;
      const longitude = typeof body.longitude === 'number' ? body.longitude : null;
      if ((latitude !== null && (latitude < -90 || latitude > 90)) || (longitude !== null && (longitude < -180 || longitude > 180))) {
        return failure('Les coordonnées de l’adresse sont invalides.');
      }
      const { data, error } = await ctx.supabase.from('addresses').insert({
        user_id: userId,
        label: body.label.trim(),
        address: body.address.trim(),
        details: typeof body.details === 'string' ? body.details.trim() || null : null,
        latitude,
        longitude,
      }).select('*').single();
      if (error) return failure('Impossible d’enregistrer cette adresse.', 500);
      return json({ data }, 201);
    }

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id');
      if (!isUuid(id)) return failure('Identifiant d’adresse invalide.');
      const { data, error } = await ctx.supabase.from('addresses').delete().eq('id', id).select('id').maybeSingle();
      if (error) return failure('Impossible de supprimer cette adresse.', 500);
      if (!data) return failure('Adresse introuvable.', 404);
      return json({ ok: true });
    }

    return failure('Méthode non autorisée.', 405);
  }),
};
