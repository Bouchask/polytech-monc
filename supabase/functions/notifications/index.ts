import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json, isUuid, readJson } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method === 'GET') {
      const { data, error } = await ctx.supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return failure('Impossible de charger les notifications.', 500);
      return json({ data });
    }
    if (request.method !== 'PATCH') return failure('Méthode non autorisée.', 405);
    const body = await readJson(request);
    if (!body || (body.id !== undefined && body.id !== null && !isUuid(body.id))) return failure('Identifiant de notification invalide.');
    const { error } = await ctx.supabase.rpc('mark_notification_read', { p_notification_id: body.id ?? null });
    if (error) return failure('Impossible de mettre à jour la notification.', 500);
    return json({ ok: true });
  }),
};
