// Import DossierFacile : lecture automatique du PDF téléchargé depuis DossierFacile
// et remplissage du dossier locataire Trouve Ton Toit (profiles.dossier_data).
// - Claude lit le PDF (page de garde + pièces) et rend un JSON structuré, avec les pages de chaque pièce
// - le PDF est découpé par étape (identité, hébergement, situation pro, ressources, impôt, garant)
// - seules les étapes encore vides sont remplies : rien de ce que le locataire a déjà fourni n'est écrasé
// Statut suivi dans dossier_data.df.extract = { status: 'en_cours' | 'ok' | 'erreur', ... }
// Par défaut : lecture GRATUITE par code (texte des pages extrait avec pdf.js, classé par mots-clés), aucune IA.
// L'IA (payante, plus fiable sur les documents scannés) ne sert que si DOSSIERFACILE_IA=oui est défini dans Netlify.
// Variables : SUPABASE_SERVICE_KEY (+ DOSSIERFACILE_IA=oui, ANTHROPIC_API_KEY, ANTHROPIC_MODEL_DOCS facultatifs).
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

// Lecture sans IA : texte de chaque page (pdf.js via unpdf), classement par mots-clés
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/\s+/g, ' ');
const CATS = [
  ['identite', /piece d ?identite|carte nationale d ?identite|carte d ?identite|passeport|titre de sejour|permis de conduire|france identite/],
  ['hebergement', /justificatif de domicile|situation d ?hebergement|hebergement|quittance|attestation d ?hebergement|taxe fonciere|attestation de bon paiement/],
  ['profession', /situation professionnelle|contrat de travail|attestation (de l ?)?employeur|certificat de scolarite|carte d ?etudiant|kbis|attestation france travail|pole emploi/],
  ['ressources', /justificatifs? de ressources|bulletins? de (salaire|paie)|fiches? de paie|avis de pension|attestation (de la )?caf|bourse|ressources/],
  ['impot', /avis d ?impot|avis d ?imposition|impot sur le revenu|revenu fiscal de reference/],
];
const GARANT = /\bgarant(e|s)?\b|\bcaution\b|visale/;
function detectType(cat, t) {
  if (cat === 'identite') return /passeport/.test(t) ? 'passeport' : /titre de sejour/.test(t) ? 'sejour' : /permis de conduire/.test(t) ? 'permis' : /france identite/.test(t) ? 'france_identite' : 'cni';
  if (cat === 'hebergement') return /quittance/.test(t) ? 'quittances' : /attestation de bon paiement/.test(t) ? 'attestation_paiement' : /attestation d ?hebergement|heberge (a titre gratuit|chez)/.test(t) ? 'attestation_hebergement' : /taxe fonciere/.test(t) ? 'taxe_fonciere' : 'quittances';
  if (cat === 'profession') return /\bcdd\b/.test(t) ? 'cdd' : /\bcdi\b/.test(t) ? 'cdi' : /fonctionnaire/.test(t) ? 'fonctionnaire' : /alternan|apprenti/.test(t) ? 'alternance' : /stage/.test(t) ? 'stage' : /scolarite|etudiant/.test(t) ? 'etudes' : /retraite/.test(t) ? 'retraite' : /france travail|pole emploi|chomage/.test(t) ? 'chomage' : /kbis|independant|auto.?entrepreneur|micro/.test(t) ? 'independant' : 'cdi';
  if (cat === 'ressources') return /pension|retraite/.test(t) ? 'pension_rev' : /bourse/.test(t) ? 'bourse' : /\bcaf\b|rsa|allocation/.test(t) ? 'aide_sociale' : 'salarie_plus3';
  return null;
}
function classer(pages) {
  const P = pages.map(norm), texte = P.join(' ');
  const res = { locataire: { pages: {}, types: {} }, garants: [], resume: {} };
  let cur = null, g = null;
  P.forEach((t, i) => {
    const hits = CATS.filter(([, re]) => re.test(t)).map(([k]) => k);
    if (hits.length >= 3 && i < 3) return; // page de synthèse
    if (GARANT.test(t) && (!hits.length || /^\W*(le |la )?garant/.test(t.trim())) && t.length < 400) { // page d'en-tête d'un garant
      g = { pages: [], nom: null, visale: /visale/.test(t) }; const m = /garant(?:e)?\s*:?\s*([a-z-]+ [a-z-]+)/.exec(t); if (m) g.nom = m[1].replace(/\b\w/g, c => c.toUpperCase());
      res.garants.push(g); cur = null; if (!hits.length) return;
    }
    if (g) { g.pages.push(i + 1); return; }
    if (hits.length) cur = hits[0];
    if (!cur) return;
    (res.locataire.pages[cur] = res.locataire.pages[cur] || []).push(i + 1);
    if (hits.length && !res.locataire.types[cur]) res.locataire.types[cur] = detectType(cur, t);
  });
  const num = s => Number(String(s).replace(/[\s.]/g, '').replace(',', '.')) || null;
  const m = /revenus? (?:mensuels? )?nets?\s*(?:mensuels?)?\s*:?\s*([\d][\d\s.,]*)\s*(?:€|eur)/.exec(texte); if (m) res.resume.revenu = num(m[1]);
  const f = /revenu fiscal de reference\s*:?\s*([\d][\d\s.,]*)/.exec(texte); if (f) res.resume.rfr = num(f[1]);
  const a = /revenus (20\d\d)|avis d ?imp\w* (?:sur les revenus )?(20\d\d)/.exec(texte); if (a) res.resume.annee = Number(a[1] || a[2]);
  const nom = /dossier (?:de location )?de\s+([a-z-]+ [a-z-]+)/.exec(texte); if (nom) res.resume.nom = nom[1].replace(/\b\w/g, c => c.toUpperCase());
  res.lisible = texte.replace(/\s/g, '').length > 40;
  return res;
}

// ── Lecture d'un PDF DossierFacile, sans IA ──
// Structure du PDF (code source officiel : github.com/MTES-MCT/dossierfacile-backend, module dossierfacile-pdf-generator) :
//  • pages d'index : « Le dossier en un clin d'oeil », « Type de dossier » (Dossier seul / en couple / en colocation),
//    « Revenus mensuels nets cumulés » puis « 2150 € », « Leur(s) garant(s) » ;
//  • chaque page de pièce porte un en-tête texte « Le dossier de <Noms> » suivi d'une phrase qui dit exactement ce qu'est la pièce :
//    « La pièce d'identité de <Prénom> », « Le justificatif de situation d'hébergement de <Prénom> »,
//    « Le justificatif de situation professionnelle de <Prénom> », « Le justificatif de ressources n° 1 de <Prénom> »,
//    « L'avis d'imposition de <Prénom> », et pour les garants « … du garant [n° 2] de <Prénom> »,
//    « L'attestation de l'organisme qui se porte garant pour <Prénom> », « Identité de la personne morale qui se porte garant pour <Prénom> » ;
//  • signets (outline) : <Nom du locataire> → catégories, puis <Prénom Nom du garant> → catégories.
const nz = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const CAP = s => String(s || '').replace(/\b\p{L}/gu, c => c.toUpperCase());
const RE = [
  // garants (à tester avant le locataire : les phrases se ressemblent)
  [/l attestation de l organisme qui se porte garant pour ([\p{L}-]+)/u, 'g', 'organisme'],
  [/identite de la personne morale qui se porte garant pour ([\p{L}-]+)/u, 'g', 'moral'],
  [/justificatif d identite du representant de la personne morale qui se porte garant pour ([\p{L}-]+)/u, 'g', 'moral'],
  [/la piece d identite du garant (?:n° ?(\d+) )?de ([\p{L}-]+)/u, 'g', 'identite'],
  [/le justificatif de situation d hebergement du garant (?:n° ?(\d+) )?de ([\p{L}-]+)/u, 'g', 'hebergement'],
  [/le justificatif de situation professionnelle du garant (?:n° ?(\d+) )?de ([\p{L}-]+)/u, 'g', 'profession'],
  [/le justificatif de ressources n° ?\d+ du garant (?:n° ?(\d+) )?de ([\p{L}-]+)/u, 'g', 'ressources'],
  [/l avis d imposition du garant (?:n° ?(\d+) )?de ([\p{L}-]+)/u, 'g', 'impot'],
  // locataire
  [/la piece d identite de ([\p{L}-]+)/u, 't', 'identite'],
  [/le justificatif de situation d hebergement de ([\p{L}-]+)/u, 't', 'hebergement'],
  [/le justificatif de situation professionnelle de ([\p{L}-]+)/u, 't', 'profession'],
  [/le justificatif de ressources n° ?\d+ de ([\p{L}-]+)/u, 't', 'ressources'],
  [/l avis d imposition de ([\p{L}-]+)/u, 't', 'impot'],
];
function lirePage(t) {
  for (const [re, qui, cat] of RE) {
    const m = re.exec(t); if (!m) continue;
    if (qui === 'g' && (cat === 'organisme' || cat === 'moral')) return { qui, cat, n: 1, prenom: m[1] };
    if (qui === 'g') return { qui, cat, n: Number(m[1]) || 1, prenom: m[2] };
    return { qui, cat, prenom: m[1] };
  }
  return null;
}
// pages: texte de chaque page ; outline: [{titre, page, enfants:[...]}] (facultatif) ; monPrenom: prénom du locataire qui importe
function lireDossierFacile(pages, outline, monPrenom) {
  const P = pages.map(nz), texte = P.join(' ');
  const res = { estDF: /le dossier en un clin d oeil|le dossier de |dossierfacile|documents exclusivement destines a la location/.test(texte), locataire: { pages: {} }, garants: [], resume: {} };
  const lus = P.map(lirePage);
  const prenoms = [...new Set(lus.filter(Boolean).map(x => x.prenom))];
  const cible = (monPrenom && prenoms.find(p => p === nz(monPrenom).split(' ')[0])) || prenoms[0] || null;
  res.resume.prenoms = prenoms.map(CAP);
  let der = null;
  lus.forEach((x, i) => {
    // une pièce de plusieurs pages : les pages suivantes sans en-tête reconnu appartiennent à la même pièce
    if (!x) { if (der && P[i].includes('le dossier de')) x = der; else return; }
    der = x;
    if (x.prenom !== cible) return; // dossier en couple / colocation : seulement les pièces du locataire qui importe
    if (x.qui === 't') { (res.locataire.pages[x.cat] = res.locataire.pages[x.cat] || []).push(i + 1); return; }
    let g = res.garants.find(y => y.n === x.n && (y.type === 'personne') === !['organisme', 'moral'].includes(x.cat));
    if (!g) { g = { n: x.n, type: x.cat === 'organisme' ? 'organisme' : x.cat === 'moral' ? 'moral' : 'personne', nom: null, pages: [], cats: {} }; res.garants.push(g); }
    g.pages.push(i + 1); (g.cats[x.cat] = g.cats[x.cat] || []).push(i + 1);
  });
  // Noms des garants : signets « Prénom Nom » sous le locataire
  if (Array.isArray(outline) && cible) {
    const loc = outline.find(o => nz(o.titre).split(' ')[0] === cible) || outline.find(o => (o.enfants || []).length);
    const gs = [];
    const parcours = arr => (arr || []).forEach(o => { const t = nz(o.titre); if (!/piece d identite|justificatif|avis d imposition|attestation|identification|certificat|clin d oeil|explication|mot du locataire/.test(t) && (o.enfants || []).length && o !== loc) gs.push(o.titre); parcours(o.enfants); });
    parcours(loc ? loc.enfants : outline);
    res.garants.filter(g => g.type === 'personne').forEach((g, k) => { if (gs[k] && !/garant personne morale|organisme garant/i.test(gs[k])) g.nom = String(gs[k]).trim(); });
  }
  const seul = /type de dossier\s*dossier seul|dossier seul/.test(texte);
  const rv = /revenus mensuels nets cumules\D{0,80}?(\d[\d\s]*)\s*€/.exec(texte);
  if (rv && seul) res.resume.revenu = Number(rv[1].replace(/\s/g, '')) || null;
  res.resume.type = /dossier en couple/.test(texte) ? 'couple' : /dossier en colocation/.test(texte) ? 'colocation' : seul ? 'seul' : null;
  res.resume.valide = res.estDF;
  res.resume.prenom = cible ? CAP(cible) : null;
  return res;
}
async function lireOutline(pdf) {
  try {
    const raw = await pdf.getOutline(); if (!raw) return null;
    const page = async it => { try { let d = it.dest; if (typeof d === 'string') d = await pdf.getDestination(d); if (!d) return null; return (await pdf.getPageIndex(d[0])) + 1; } catch (e) { return null; } };
    const conv = async arr => Promise.all((arr || []).map(async it => ({ titre: it.title, page: await page(it), enfants: await conv(it.items) })));
    return await conv(raw);
  } catch (e) { return null; }
}

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
    const IA = process.env.DOSSIERFACILE_IA === 'oui' && !!process.env.ANTHROPIC_API_KEY;
    await setStatut(clerk, { status: 'en_cours', at: t0, path });
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { headers: H });
    if (!res.ok) throw new Error('Fichier introuvable (' + res.status + ')');
    const buf = Buffer.from(await res.arrayBuffer());
    let src; try { src = await PDFDocument.load(buf, { ignoreEncryption: true }); } catch (e) { throw new Error('Ce fichier n’est pas un PDF lisible.'); }
    const n = src.getPageCount();
    if (n > 100) throw new Error('PDF trop long (' + n + ' pages, 100 au maximum).');

    let ex;
    if (IA) {
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
    } else {
      // Lecture gratuite : texte de chaque page + signets. D'abord le format DossierFacile (en-têtes exacts), sinon mots-clés.
      const { extractText, getDocumentProxy } = require('unpdf');
      let pagesTxt = [], outline = null;
      try { const pdf = await getDocumentProxy(new Uint8Array(buf)); ({ text: pagesTxt } = await extractText(pdf, { mergePages: false })); outline = await lireOutline(pdf); } catch (e) { pagesTxt = []; }
      let monNom = '';
      try { const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?clerk_id=eq.${encodeURIComponent(clerk)}&select=full_name`, { headers: H }); monNom = (await pr.json())?.[0]?.full_name || ''; } catch (e) {}
      const dfr = lireDossierFacile(pagesTxt || [], outline, monNom);
      const PP = dfr.locataire.pages;
      const txtDe = pg => (pg || []).map(k => nz(pagesTxt[k - 1])).join(' ');
      if (dfr.estDF && Object.keys(PP).length) {
        const ty = (cat, def) => detectType(cat, txtDe(PP[cat])) || def;
        const idT = /passeport|titre de sejour|permis de conduire|france identite|carte nationale/.test(txtDe(PP.identite)) ? detectType('identite', txtDe(PP.identite)) : 'autre_id';
        const [gpren, ...gnom] = String(dfr.resume.prenom || '').split(' ');
        ex = {
          locataire: { prenom: gpren || '', nom: gnom.join(' ') }, dossier_valide: true,
          identite: PP.identite ? { type: idT, pages: PP.identite } : null,
          hebergement: PP.hebergement ? { type: /quittance|attestation d ?hebergement|taxe fonciere|bon paiement/.test(txtDe(PP.hebergement)) ? ty('hebergement') : 'autre_heberg', pages: PP.hebergement } : null,
          profession: PP.profession ? { type: /\bcdi\b|\bcdd\b|fonctionnaire|alternan|stage|scolarite|etudiant|retraite|chomage|france travail|kbis|independant/.test(txtDe(PP.profession)) ? ty('profession') : 'autre_pro', employeur: null, pages: PP.profession } : null,
          ressources: PP.ressources ? { type: /bulletin|fiche de paie|pension|bourse|\bcaf\b|rsa|allocation/.test(txtDe(PP.ressources)) ? ty('ressources') : 'autre_ressources', montant_mensuel_net: dfr.resume.revenu || null, pages: PP.ressources } : null,
          impot: PP.impot ? { present: true, annee_revenus: null, revenu_fiscal: null, rattache_parents: false, pages: PP.impot } : null,
          garants: dfr.garants.map(g => { const [p0, ...p1] = String(g.nom || '').split(' '); const vis = /visale/.test(txtDe(g.pages));
            return { type: g.type === 'personne' ? 'garant_personne' : g.type === 'moral' ? 'garant_moral' : vis ? 'garant_visale' : 'garant_organisme', prenom: p0 || '', nom: p1.join(' '), email: null, numero_visa: null, revenu_mensuel_net: null, pages: g.pages, cats: g.cats, textes: Object.fromEntries(Object.entries(g.cats || {}).map(([k, v]) => [k, txtDe(v)])) }; }),
          remarques: dfr.resume.type && dfr.resume.type !== 'seul' ? `Dossier DossierFacile ${dfr.resume.type === 'couple' ? 'en couple' : 'en colocation'} : seules vos pièces (${dfr.resume.prenom || ''}) ont été reprises.` : '',
          _mode: 'code-df', _lisible: true,
        };
      } else {
        const c = classer(pagesTxt || []);
        const L = c.locataire, bloc = k => L.pages[k] ? { type: L.types[k] || null, pages: L.pages[k] } : null;
        const [prenom, ...nomR] = String(c.resume.nom || '').split(' ');
        ex = {
          locataire: { prenom: prenom || '', nom: nomR.join(' ') }, dossier_valide: null,
          identite: bloc('identite'), hebergement: bloc('hebergement'),
          profession: L.pages.profession ? { type: L.types.profession || 'autre_pro', employeur: null, pages: L.pages.profession } : null,
          ressources: L.pages.ressources ? { type: L.types.ressources || 'autre_ressources', montant_mensuel_net: c.resume.revenu || null, pages: L.pages.ressources } : null,
          impot: L.pages.impot ? { present: true, annee_revenus: c.resume.annee || null, revenu_fiscal: c.resume.rfr || null, rattache_parents: false, pages: L.pages.impot } : null,
          garants: c.garants.map(g => { const [gp, ...gn] = String(g.nom || '').split(' '); return { type: g.visale ? 'garant_visale' : 'garant_personne', prenom: gp || '', nom: gn.join(' '), email: null, numero_visa: null, revenu_mensuel_net: null, pages: g.pages }; }),
          remarques: c.lisible ? '' : 'PDF sans texte lisible : le PDF complet reste joint au dossier, déposez les pièces étape par étape si besoin.',
          _mode: 'code', _lisible: c.lisible,
        };
      }
    }

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
            const subs = {};
            if (g.cats && Object.keys(g.cats).length) {
              const T = g.textes || {}, cut = async (cat, i) => (g.cats[cat] ? await decoupe(src, pagesOk(g.cats[cat], n), clerk, `garant${k + 1}_${cat}`, ts + 20 + k * 10 + i) : null);
              const fId = await cut('identite', 0), fHe = await cut('hebergement', 1), fPr = await cut('profession', 2), fRe = await cut('ressources', 3), fIm = await cut('impot', 4);
              const idDoc = detectType('identite', T.identite || '');
              const ID = { cni: 'g_cni', passeport: 'g_passeport', sejour: 'g_sejour', permis: 'g_permis', france_identite: 'g_france_id' };
              if (fId) subs[0] = { type: /passeport|titre de sejour|permis|france identite|carte nationale/.test(T.identite || '') ? (ID[idDoc] || 'g_autre_id') : 'g_autre_id', files: [fId], fromDF: true };
              if (fHe) { const t = T.hebergement || ''; subs[1] = { type: /attestation de bon paiement/.test(t) ? 'g_attest_paiement' : /attestation d ?hebergement/.test(t) ? 'g_attest_heberg' : /taxe fonciere/.test(t) ? 'g_taxe_fonciere' : 'g_quittances', files: [fHe], fromDF: true }; }
              if (fPr) { const t = T.profession || '', pt = detectType('profession', t); const PR = { cdi: 'g_cdi', cdd: 'g_cdd', fonctionnaire: 'g_fonctionnaire', independant: 'g_independant', retraite: 'g_retraite', chomage: 'g_chomage', etudes: 'g_etudiant', alternance: 'g_alternance', stage: 'g_stage' };
                subs[2] = { type: /\bcdi\b|\bcdd\b|fonctionnaire|independant|kbis|retraite|chomage|france travail|scolarite|etudiant|alternan|stage/.test(t) ? (PR[pt] || 'g_autre_pro') : 'g_autre_pro', files: [fPr], fromDF: true }; }
              if (fRe) { const t = T.ressources || ''; const rt = /pension|retraite/.test(t) ? 'g_retraite_pension' : /bourse/.test(t) ? 'g_bourse' : /\bcaf\b|rsa|allocation|chomage|\bare\b/.test(t) ? 'g_aide_sociale' : 'g_travail';
                const net = /net a payer\s*:?\s*([\d\s]+[,.]?\d*)/.exec(t);
                subs[3] = { revenues: [{ type: rt, subType: rt === 'g_travail' ? 'g_trav_salarie' : null, anciennete: null, montant: net ? String(Math.round(Number(net[1].replace(/\s/g, '').replace(',', '.')))) : null, label: { g_travail: 'Revenus du travail — salarié', g_retraite_pension: 'Retraite ou pension', g_bourse: 'Bourse', g_aide_sociale: 'Aide sociale' }[rt], files: [fRe], fromDF: true }] }; }
              if (fIm) subs[4] = { type: 'g_avec_impot', files: [fIm], fromDF: true };
              garants.push({ garant_name: { prenom: g.prenom || '', nom: g.nom || '', email: g.email || '' }, garant_subs: subs, files: [], fromDF: true, revenu_df: Number(g.revenu_mensuel_net) || null });
            } else {
              const f = await decoupe(src, pagesOk(g.pages, n), clerk, 'garant' + (k + 1), ts + 10 + k);
              garants.push({ garant_name: { prenom: g.prenom || '', nom: g.nom || '', email: g.email || '' }, garant_subs: {}, files: f ? [f] : [], fromDF: true, revenu_df: Number(g.revenu_mensuel_net) || null });
            }
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
        valide: ex.dossier_valide ?? null, remarques: ex.remarques || null, mode: ex._mode || 'ia',
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
