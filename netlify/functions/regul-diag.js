// Diagnostic de la lecture automatique des documents (aucune valeur secrète n'est renvoyée)
// Vérifie : clé Supabase « service » valable pour CE projet, clé Anthropic valable, modèle disponible.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
exports.handler = async () => {
  const out = { supabase: 'absente', anthropic: 'absente', modele: process.env.ANTHROPIC_MODEL_DOCS || 'claude-sonnet-4-5', modele_ok: null };
  const K = process.env.SUPABASE_SERVICE_KEY, A = process.env.ANTHROPIC_API_KEY;
  if (K) {
    try { const r = await fetch(`${SUPABASE_URL}/rest/v1/charges_regularisations?select=id&limit=1`, { headers: { apikey: K, Authorization: 'Bearer ' + K } });
      out.supabase = r.ok ? 'ok' : 'refusee_' + r.status; } catch (e) { out.supabase = 'erreur'; }
  }
  if (A) {
    try { const r = await fetch('https://api.anthropic.com/v1/models/' + encodeURIComponent(out.modele), { headers: { 'x-api-key': A, 'anthropic-version': '2023-06-01' } });
      if (r.status === 401 || r.status === 403) out.anthropic = 'refusee_' + r.status;
      else { out.anthropic = 'ok'; out.modele_ok = r.ok; }
    } catch (e) { out.anthropic = 'erreur'; }
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(out) };
};
