import { withSupabase } from 'npm:@supabase/server@^1';
import { failure, json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'GET') return failure('Méthode non autorisée.', 405);
    const requestId = new URL(request.url).searchParams.get('requestId');
    let query = ctx.supabase.from('offers')
      .select('id,request_id,technician_id,proposed_price_mad,message,availability,proposed_at,status,created_at,technicians(id,name,specialty,rating,review_count,completed_jobs,experience_years,biography,avatar_url)')
      .order('created_at', { ascending: true });
    if (requestId) query = query.eq('request_id', requestId);
    const { data, error } = await query;
    if (error) return failure('Impossible de charger les offres.', 500);
    return json({ data });
  }),
};
