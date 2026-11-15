// TRUTHFUL PRO API v0.1 — public read-only bootstrap, sensitive routes closed.
// Never return customer data or files without verified identity and authorization.
const securityHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};
function json(value, status = 200, more = {}) {
  return new Response(JSON.stringify(value), { status, headers: {...securityHeaders, ...more} });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return json({ error: 'not_allowed' }, 405, { Allow: 'GET, HEAD' });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' });
    if (url.pathname === '/health') {
      try {
        if (!env.DB || !env.DOCUMENTS) return json({status:'unavailable'},503);
        await env.DB.prepare('SELECT 1 AS ok').first();
        return json({ status: 'ok', service: 'truthful-pro-api' });
      } catch { return json({status:'unavailable'},503); }
    }
    if (url.pathname === '/v1/services') {
      try {
        if (!env.DB) return json({error:'unavailable'},503);
        const audience = url.searchParams.get('audience');
        if (audience !== null && audience !== 'individual' && audience !== 'company') return json({error:'invalid_audience'},400);
        const sql = audience
          ? 'SELECT id, audience, category_key, title_ar, title_en, authority_name, official_url FROM services WHERE is_active = 1 AND verification_status = ? AND audience = ? ORDER BY category_key, title_ar LIMIT 100'
          : 'SELECT id, audience, category_key, title_ar, title_en, authority_name, official_url FROM services WHERE is_active = 1 AND verification_status = ? ORDER BY audience, category_key, title_ar LIMIT 100';
        const args = audience ? ['verified', audience] : ['verified'];
        const records = await env.DB.prepare(sql).bind(...args).all();
        return json({ services: records.results || [] });
      } catch { return json({error:'unavailable'},503); }
    }
    // Customer requests, document downloads/uploads and administrative endpoints are intentionally disabled.
    return json({ error: 'not_found' }, 404);
  }
};
