import { withSupabase } from 'npm:@supabase/server@^1';
import { json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'none' }, async () =>
    json({ service: 'palesso-api', status: 'ok', timestamp: new Date().toISOString() })),
};
