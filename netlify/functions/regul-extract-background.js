// Régularisation des charges : lecture automatique des documents déposés par le propriétaire
// (décompte annuel du syndic, avis de taxe foncière, factures) avec Claude.
// Fonction « background » Netlify (jusqu'à 15 min) : répond tout de suite, le résultat est écrit
// dans gestion_regul.extraction ; le portail de l'agence l'affiche dès qu'il arrive.
// Variables : SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL_DOCS facultatif).
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'documents-dossiers';

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) });

const PROMPT = `Tu lis des documents français envoyés par un propriétaire bailleur pour la régularisation annuelle des charges locatives de SON logement (un lot) :
- décompte / relevé annuel de charges de copropriété du syndic (approuvé en assemblée générale),
- avis de taxe foncière (pour la taxe d'enlèvement des ordures ménagères, TEOM),
- éventuelles factures (eau, entretien, contrat chaudière…).

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de cette forme :
{
  "documents": ["decompte_syndic" | "taxe_fonciere" | "facture" | "autre"],
  "lot": "désignation du lot si indiquée, sinon null",
  "exercice": {"debut": "AAAA-MM-JJ", "fin": "AAAA-MM-JJ"} ou null,
  "lignes": [{"nature": "libellé court du poste", "montant": 123.45, "recuperable": true, "source": "syndic | facture"}],
  "total_recuperable_document": 1234.56 ou null,
  "teom": {"annee": 2025, "montant_hors_frais": 234.00, "frais_gestion": 18.72} ou null,
  "remarques": "ce qui est incertain ou à vérifier, en une ou deux phrases"
}

Règles :
- Les montants sont ceux DU LOT du propriétaire (sa quote-part), jamais le total de l'immeuble. Nombres avec un point décimal, sans symbole.
- Si le décompte a une colonne « récupérable », « locatif » ou « part locataire », sers-t'en pour "recuperable" et pour le montant récupérable. Un poste partiellement récupérable donne deux lignes (part récupérable / part non récupérable).
- Sinon applique le décret n° 87-713 : récupérables = eau, chauffage et eau chaude collectifs, ascenseur (entretien courant), électricité et entretien des parties communes, ménage, espaces verts, gardien (selon la règle légale), ordures ménagères ; NON récupérables = honoraires du syndic, assurance de l'immeuble, gros travaux, fonds de travaux (loi ALUR), frais de procédure, frais bancaires, mise en conformité.
- Ne mets pas la TEOM dans "lignes" : uniquement dans "teom". Sur l'avis de taxe foncière, "montant_hors_frais" = la cotisation de taxe d'enlèvement des ordures ménagères SANS les frais de gestion de la fiscalité directe locale (ceux-ci ne sont pas récupérables).
- Inclue aussi les lignes non récupérables (recuperable: false) pour que le gestionnaire voie tout.
- Si un document est illisible ou n'est pas lié aux charges, dis-le dans "remarques".`;

exports.handler = async (event) => {
  let id = null;
  try { id = JSON.parse(event.body || '{}').id; } catch (e) {}
  if (!id || !KEY) return { statusCode: 400, body: 'id ou clé manquante' };
  let r;
  try { r = (await api(`gestion_regul?id=eq.${id}&select=*`))?.[0]; } catch (e) { return { statusCode: 500, body: e.message }; }
  if (!r) return { statusCode: 404, body: 'introuvable' };
  if (!process.env.ANTHROPIC_API_KEY) { await patch(`gestion_regul?id=eq.${id}`, { extraction_err: 'Lecture automatique non activée (clé ANTHROPIC_API_KEY absente) : saisissez les montants.' }); return { statusCode: 200, body: 'no key' }; }
  try {
    const content = [];
    for (const d of (r.docs || []).slice(0, 8)) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${d.path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 25e6) continue;
      const ext = String(d.name || d.path).split('.').pop().toLowerCase();
      const data = buf.toString('base64');
      content.push({ type: 'text', text: `Document « ${d.name || 'sans nom'} » (déposé comme : ${d.type || 'non précisé'}) :` });
      if (ext === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
      else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) content.push({ type: 'image', source: { type: 'base64', media_type: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext, data } });
    }
    if (!content.length) { await patch(`gestion_regul?id=eq.${id}`, { extraction_err: 'Aucun document lisible (PDF ou photo attendus).' }); return { statusCode: 200, body: 'no doc' }; }
    content.push({ type: 'text', text: `Année de régularisation demandée : ${r.annee}.\n\n` + PROMPT });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL_DOCS || 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content }] }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error?.message || ('HTTP ' + res.status));
    const txt = (j.content || []).map(c => c.text || '').join('');
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    const ex = JSON.parse(txt.slice(a, b + 1));
    // Nettoyage minimal
    ex.lignes = (Array.isArray(ex.lignes) ? ex.lignes : []).map(l => ({ nature: String(l.nature || 'Poste').slice(0, 120), montant: Math.round((Number(l.montant) || 0) * 100) / 100, recuperable: l.recuperable !== false, source: l.source || null })).filter(l => l.montant);
    await patch(`gestion_regul?id=eq.${id}`, { extraction: ex, extraction_err: null, extraction_at: new Date().toISOString(), ...(r.statut === 'attente_docs' ? { statut: 'a_verifier' } : {}) });
    // Prévenir l'agence dans sa messagerie
    try {
      const m = (await api(`gestion_mandats?id=eq.${r.mandat_id}&select=bien_label,bien_adresse,owner_name`))?.[0] || {};
      await api('messages', { method: 'POST', body: JSON.stringify({ sender_id: 'system', receiver_id: r.agency_id, type: 'message', read: false,
        content: `Régularisation des charges ${r.annee} — ${m.bien_label || m.bien_adresse || 'un bien'} : les documents de ${m.owner_name || 'du propriétaire'} ont été lus. Vérifiez et envoyez le décompte au locataire (Gestion locative → Ma journée).` }) });
    } catch (e) {}
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('regul-extract', e);
    await patch(`gestion_regul?id=eq.${id}`, { extraction_err: 'Lecture automatique impossible (' + String(e.message).slice(0, 160) + ') : saisissez les montants.' }).catch(() => {});
    return { statusCode: 200, body: 'err' };
  }
};
