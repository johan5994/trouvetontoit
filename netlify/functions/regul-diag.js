// Diagnostic de la lecture automatique des documents (aucune valeur secrète n'est renvoyée)
// Vérifie : clé Supabase « service » valable pour CE projet, clé Anthropic valable, modèle disponible.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
exports.handler = async () => {
  const out = { supabase: 'absente', anthropic: 'absente', modele: process.env.ANTHROPIC_MODEL_DOCS || 'claude-sonnet-4-5', modele_ok: null };
  const K = process.env.SUPABASE_SERVICE_KEY, A = process.env.ANTHROPIC_API_KEY;
  if (K) {
    // Type de clé (sans jamais la renvoyer) : ancienne clé JWT « service_role » ou nouvelle clé « sb_secret_… »
    out.type_cle = K.startsWith('sb_secret_') ? 'sb_secret' : K.startsWith('sb_publishable_') ? 'sb_publishable (mauvaise clé : publique)' : K.startsWith('eyJ') ? (() => { try { return 'jwt_' + JSON.parse(Buffer.from(K.split('.')[1], 'base64').toString()).role + '_' + JSON.parse(Buffer.from(K.split('.')[1], 'base64').toString()).ref; } catch (e) { return 'jwt_illisible'; } })() : 'inconnu';
    const h = K.startsWith('sb_') ? { apikey: K } : { apikey: K, Authorization: 'Bearer ' + K };
    for (const [nom, path] of [['table', 'rest/v1/charges_regularisations?select=id&limit=1'], ['stockage', 'storage/v1/bucket/documents-dossiers']]) {
      try { const r = await fetch(`${SUPABASE_URL}/${path}`, { headers: h }); const t = await r.text();
        out[nom === 'table' ? 'supabase' : 'stockage'] = r.ok ? 'ok' : 'refusee_' + r.status;
        if (!r.ok) out[nom + '_message'] = t.slice(0, 200); } catch (e) { out[nom === 'table' ? 'supabase' : 'stockage'] = 'erreur'; }
    }
  }
  if (A) {
    try { const r = await fetch('https://api.anthropic.com/v1/models/' + encodeURIComponent(out.modele), { headers: { 'x-api-key': A, 'anthropic-version': '2023-06-01' } });
      if (r.status === 401 || r.status === 403) out.anthropic = 'refusee_' + r.status;
      else { out.anthropic = 'ok'; out.modele_ok = r.ok; }
    } catch (e) { out.anthropic = 'erreur'; }
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(out) };
};
