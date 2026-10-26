import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json, isUuid, readJson } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'POST') return failure('Méthode non autorisée.', 405);
    const body = await readJson(request);
    if (!body || !isUuid(body.requestId)) return failure('Identifiant de demande invalide.');
    const { error } = await ctx.supabase.rpc('cancel_service_request', { p_request_id: body.requestId });
    if (error) {
      if (error.code === 'P0002') return failure('Demande introuvable.', 404);
      if (error.code === '22023') return failure('Cette demande ne peut plus être annulée.', 409);
      return failure('Impossible d’annuler cette demande.', 500);
    }
    return json({ ok: true });
  }),
};
