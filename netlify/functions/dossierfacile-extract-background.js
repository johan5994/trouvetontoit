// Import DossierFacile : lecture automatique du PDF téléchargé depuis DossierFacile
// et remplissage du dossier locataire Trouve Ton Toit (profiles.dossier_data).
// - Claude lit le PDF (page de garde + pièces) et rend un JSON structuré, avec les pages de chaque pièce
// - le PDF est découpé par étape (identité, hébergement, situation pro, ressources, impôt, garant)
// - seules les étapes encore vides sont remplies : rien de ce que le locataire a déjà fourni n'est écrasé
// Statut suivi dans dossier_data.df.extract = { status: 'en_cours' | 'ok' | 'erreur', ... }
// Variables : SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL_DOCS facultatif).
const { PDFDocument } = require('pdf-lib');
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'documents-dossiers';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const enc = p => p.split('/').map(encodeURIComponent).join('/');

async function getDossier(clerk) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?clerk_id=eq.${encodeURIComponent(clerk)}&select=dossier_data`, { headers: H });
  const j = await r.json(); let d = j?.[0]?.dossier_data || {};
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  return d;
}
async function setDossier(clerk, d) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?clerk_id=eq.${encodeURIComponent(clerk)}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ dossier_data: d }) });
  if (!r.ok) throw new Error('profiles ' + r.status + ' ' + await r.text());
}
async function setStatut(clerk, extract) { const d = await getDossier(clerk); d.df = d.df || {}; d.df.extract = extract; await setDossier(clerk, d); }

const PROMPT = `Ce PDF est un dossier de location exporté depuis DossierFacile (service public français) : une page de synthèse puis les pièces justificatives du locataire et éventuellement de ses garants.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, au format :
{
  "locataire": { "prenom": "", "nom": "", "email": "" ou null },
  "dossier_valide": true | false | null,
  "identite": { "type": "cni" | "passeport" | "sejour" | "permis" | "france_identite" | "autre_id", "pages": [1,2] } ou null,
  "hebergement": { "type": "quittances" | "attestation_paiement" | "attestation_hebergement" | "heberge_sans_attestation" | "taxe_fonciere" | "autre_heberg", "pages": [] } ou null,
  "profession": { "type": "cdi" | "cdd" | "fonctionnaire" | "independant" | "retraite" | "chomage" | "etudes" | "alternance" | "stage" | "service_civique" | "intermittent" | "allocations_rsa" | "autre_pro", "employeur": "" ou null, "depuis": "AAAA-MM-JJ" ou null, "pages": [] } ou null,
  "ressources": { "type": "salarie_plus3" | "salarie_moins3" | "salarie_pas_encore" | "independant_rev" | "intermittent_rev" | "artiste_rev" | "aide_sociale" | "pension_rev" | "rente_rev" | "bourse" | "sans_revenus", "montant_mensuel_net": 1234 ou null, "pages": [] } ou null,
  "impot": { "present": true | false, "annee_revenus": 2025 ou null, "revenu_fiscal": 12345 ou null, "rattache_parents": true | false, "pages": [] } ou null,
  "garants": [ { "type": "garant_personne" | "garant_visale" | "garant_organisme" | "garant_moral", "prenom": "", "nom": "", "email": "" ou null, "numero_visa": "" ou null, "revenu_mensuel_net": 1234 ou null, "pages": [] } ],
  "remarques": ""
}
Règles :
- "pages" = numéros de pages du PDF (1 = première page) où se trouve la pièce correspondante du LOCATAIRE (pas la page de synthèse). Les pièces des garants vont dans garants[].pages.
- ressources.type : salarié en poste depuis plus de 3 mois avec bulletins → "salarie_plus3". Montant = revenu mensuel NET déclaré dans la synthèse DossierFacile si présent, sinon net moyen des bulletins.
- hebergement : locataire → "quittances" (ou "attestation_paiement"), hébergé → "attestation_hebergement", propriétaire → "taxe_fonciere".
- Si une information n'apparaît pas, mets null. N'invente rien. "garants" = [] s'il n'y en a pas.
- "dossier_valide" = true si le document indique que le dossier a été vérifié/validé par DossierFacile.`;

function pagesOk(p, n) { return [...new Set((Array.isArray(p) ? p : []).map(Number).filter(x => Number.isInteger(x) && x >= 1 && x <= n))].sort((a, b) => a - b); }

async function decoupe(src, pages, clerk, key, ts) {
  if (!pages.length) return null;
  const out = await PDFDocument.create();
  const cp = await out.copyPages(src, pages.map(p => p - 1));
  cp.forEach(p => out.addPage(p));
  const bytes = await out.save();
  const path = `dossier/${clerk}/df_${key}_${ts}.pdf`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: Buffer.from(bytes) });
  if (!up.ok) throw new Error('upload ' + up.status + ' ' + await up.text());
  const sg = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${enc(path)}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 604800 }) });
  const sj = sg.ok ? await sg.json() : {};
  const url = sj.signedURL ? SUPABASE_URL + '/storage/v1' + sj.signedURL : '';
  return { name: pages.length > 1 ? `DossierFacile — pages ${pages[0]}-${pages[pages.length - 1]}.pdf` : `DossierFacile — page ${pages[0]}.pdf`, path, url, ext: 'pdf', fromDF: true };
}

exports.handler = async (event) => {
  let clerk, path;
  try { ({ clerk_id: clerk, path } = JSON.parse(event.body || '{}')); } catch (e) {}
  if (!clerk || !path || !KEY) return { statusCode: 400, body: 'clerk_id et path requis' };
  // Le fichier doit appartenir au dossier de ce locataire
  if (!path.startsWith(`dossier/${clerk}/`) || path.includes('..')) return { statusCode: 403, body: 'chemin refusé' };
  const t0 = new Date().toISOString();
  try {
    if (!process.env.ANTHROPIC_API_KEY) { await setStatut(clerk, { status: 'erreur', at: t0, err: 'Lecture automatique non activée sur le site.' }); return { statusCode: 200, body: 'no key' }; }
    await setStatut(clerk, { status: 'en_cours', at: t0, path });
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { headers: H });
    if (!res.ok) throw new Error('Fichier introuvable (' + res.status + ')');
    const buf = Buffer.from(await res.arrayBuffer());
    let src; try { src = await PDFDocument.load(buf, { ignoreEncryption: true }); } catch (e) { throw new Error('Ce fichier n’est pas un PDF lisible.'); }
    const n = src.getPageCount();
    if (n > 100) throw new Error('PDF trop long (' + n + ' pages, 100 au maximum).');

    const ai = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL_DOCS || 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }, { type: 'text', text: PROMPT }] }] }),
    });
    const aj = await ai.json();
    if (!ai.ok) throw new Error('Lecture impossible : ' + (aj?.error?.message || ai.status));
    const txt = (aj.content || []).map(c => c.text || '').join('');
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('Réponse illisible');
    const ex = JSON.parse(txt.slice(a, b + 1));

    // Découpage par étape puis remplissage des étapes vides
    const ts = Date.now();
    const d = await getDossier(clerk);
    const rempli = [];
    const libre = i => !d[i]?.type || d[i]?.fromDF; // une étape déjà importée de DossierFacile peut être réimportée
    const etape = async (i, key, bloc, extra) => {
      if (!bloc || !bloc.type || !libre(i)) return;
      const f = await decoupe(src, pagesOk(bloc.pages, n), clerk, key, ts + i);
      d[i] = { type: bloc.type, files: f ? [f] : [], fromDF: true, ...extra };
      if (!f) d[i].noDoc = true;
      rempli.push(i);
    };
    await etape(0, 'identite', ex.identite);
    const HEB = { quittances: 'locataire', attestation_paiement: 'locataire', attestation_hebergement: 'heberge', heberge_sans_attestation: 'heberge', taxe_fonciere: 'proprietaire', autre_heberg: 'autre' };
    await etape(1, 'hebergement', ex.hebergement, { situation: HEB[ex.hebergement?.type] || 'autre' });
    await etape(2, 'profession', ex.profession, { employeur: ex.profession?.employeur || null, depuis: ex.profession?.depuis || null });
    const montant = Number(ex.ressources?.montant_mensuel_net) || null;
    await etape(3, 'ressources', ex.ressources, { amount: ex.ressources?.type === 'sans_revenus' ? null : montant });
    if (ex.impot && libre(4)) {
      if (ex.impot.present) await etape(4, 'impot', { type: 'avec_impot', pages: ex.impot.pages }, { revenu_fiscal: ex.impot.revenu_fiscal || null, annee: ex.impot.annee_revenus || null });
      else { d[4] = { type: ex.impot.rattache_parents ? 'skipped_rattache' : 'skipped_impot', skipped: true, files: [], fromDF: true }; if (ex.impot.rattache_parents) d[4].label = 'Rattaché au foyer fiscal des parents'; rempli.push(4); }
    }
    const G = Array.isArray(ex.garants) ? ex.garants.filter(g => g && g.type) : [];
    if (libre(5)) {
      if (!G.length && ex.garants && Array.isArray(ex.garants)) { /* pas de garant : on laisse le locataire choisir */ }
      else if (G.length) {
        const g0 = G[0];
        if (g0.type === 'garant_personne') {
          const garants = [];
          for (let k = 0; k < G.filter(g => g.type === 'garant_personne').length && k < 2; k++) {
            const g = G.filter(x => x.type === 'garant_personne')[k];
            const f = await decoupe(src, pagesOk(g.pages, n), clerk, 'garant' + (k + 1), ts + 10 + k);
            garants.push({ garant_name: { prenom: g.prenom || '', nom: g.nom || '', email: g.email || '' }, garant_subs: {}, files: f ? [f] : [], fromDF: true, revenu_df: Number(g.revenu_mensuel_net) || null });
          }
          d[5] = { type: 'garant_personne', garants, fromDF: true };
        } else {
          const f = await decoupe(src, pagesOk(g0.pages, n), clerk, 'garant', ts + 10);
          d[5] = { type: g0.type, files: f ? [f] : [], fromDF: true, ...(g0.type === 'garant_visale' && g0.numero_visa ? { visa: g0.numero_visa } : {}), ...(g0.type === 'garant_moral' ? { moral_nom: [g0.prenom, g0.nom].filter(Boolean).join(' ') } : {}) };
        }
        rempli.push(5);
      }
    }
    d.df = d.df || {};
    d.df.extract = {
      status: 'ok', at: new Date().toISOString(), path, rempli,
      resume: {
        nom: [ex.locataire?.prenom, ex.locataire?.nom].filter(Boolean).join(' ') || null,
        profession: ex.profession?.type || null, employeur: ex.profession?.employeur || null,
        revenus: montant, garants: G.map(g => ({ type: g.type, nom: [g.prenom, g.nom].filter(Boolean).join(' ') || null })),
        valide: ex.dossier_valide ?? null, remarques: ex.remarques || null,
      },
    };
    await setDossier(clerk, d);
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('dossierfacile-extract', e);
    try { await setStatut(clerk, { status: 'erreur', at: t0, err: String(e.message || e).slice(0, 300) }); } catch (x) {}
    return { statusCode: 500, body: 'erreur' };
  }
};
