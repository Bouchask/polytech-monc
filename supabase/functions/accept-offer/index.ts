import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json, isUuid, readJson } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'POST') return failure('Méthode non autorisée.', 405);
    const body = await readJson(request);
    if (!body || !isUuid(body.requestId) || !isUuid(body.offerId)) {
      return failure('Identifiants de demande ou d’offre invalides.');
    }
    const { data, error } = await ctx.supabase.rpc('accept_service_offer', {
      p_request_id: body.requestId,
      p_offer_id: body.offerId,
    });
    if (error) {
      if (error.code === 'P0002') return failure('Cette offre n’est plus disponible.', 404);
      if (error.code === '22023') return failure('Cette demande ne peut plus accepter d’offre.', 409);
      return failure('Impossible de confirmer cette offre.', 500);
    }
    return json({ data });
  }),
};
