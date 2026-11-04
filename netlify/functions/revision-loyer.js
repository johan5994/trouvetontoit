// Révision annuelle du loyer (IRL) — fonction planifiée Netlify (tous les jours).
// À déclarer dans netlify.toml :
//   [functions."revision-loyer"]
//     schedule = "@daily"
// Variables : SUPABASE_SERVICE_KEY ; e-mail facultatif (BREVO_API_KEY + BREVO_SENDER, voir _shared/mailer.js).
//
// 1) Met à jour les indices IRL (table irl_indices) depuis l'INSEE, si l'INSEE répond ; sinon garde la table intégrée.
// 2) Pour chaque bail signé géré en direct par un propriétaire : le jour de la date anniversaire
//    (ou dès la publication de l'indice s'il sort après), envoie au propriétaire un message avec le nouveau loyer
//    et le lien pour l'appliquer. Une seule fois par année de révision (leases.irl_notif_annee).
// Règles : art. 17-1 loi du 6 juillet 1989 ; pas de révision si DPE F ou G.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const { sendMail } = require('./_shared/mailer');
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });

// IRL publiés par l'INSEE (base 100 au 4e trimestre 1998) — secours si l'INSEE ne répond pas. Même table que landlord-dashboard.html.
const IRL_BASE = { '2022-1': 133.93, '2022-2': 135.84, '2022-3': 136.27, '2022-4': 137.26, '2023-1': 138.61, '2023-2': 140.59, '2023-3': 141.03, '2023-4': 142.06, '2024-1': 143.46, '2024-2': 145.17, '2024-3': 144.51, '2024-4': 144.64, '2025-1': 145.47, '2025-2': 146.68, '2025-3': 145.77, '2025-4': 145.78, '2026-1': 146.60, '2026-2': 148.37, '2026-3': 148.06 };
const IDBANK_IRL = '001515333';

const eur = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const nb = v => Number(v).toLocaleString('fr-FR');
const trim = q => ['1er', '2e', '3e', '4e'][q - 1] + ' trimestre';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Indices INSEE (série BDM de l'IRL), contrôlés contre les valeurs connues avant d'être enregistrés
async function majIndices() {
  const urls = [`https://api.insee.fr/series/BDM/data/SERIES_BDM/${IDBANK_IRL}`, `https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/${IDBANK_IRL}`];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { Accept: 'application/xml' } });
      if (!r.ok) continue;
      const xml = await r.text(), vals = {};
      for (const m of xml.matchAll(/<Obs\b[^>]*>/g)) {
        const t = /TIME_PERIOD="(\d{4})-Q([1-4])"/.exec(m[0]), v = /OBS_VALUE="([\d.]+)"/.exec(m[0]);
        if (t && v) vals[`${t[1]}-${t[2]}`] = Number(v[1]);
      }
      const verif = ['2024-4', '2025-3', '2026-1'].every(k => vals[k] && Math.abs(vals[k] - IRL_BASE[k]) < 0.015);
      if (!verif) { console.error('IRL INSEE : valeurs incohérentes, ignorées', u); continue; }
      const rows = Object.entries(vals).filter(([k]) => k >= '2015').map(([trimestre, valeur]) => ({ trimestre, valeur, source: 'insee', updated_at: new Date().toISOString() }));
      await api('irl_indices?on_conflict=trimestre', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      return vals;
    } catch (e) { console.error('IRL INSEE', u, e.message); }
  }
  return null;
}

function refTrim(start) {
  const d = new Date(start), y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const after = mm => m > mm || (m === mm && day >= 15);
  if (after(10)) return [y, 3]; if (after(7)) return [y, 2]; if (after(4)) return [y, 1]; if (after(1)) return [y - 1, 4]; return [y - 1, 3];
}
// Même calcul que _gRevision dans landlord-dashboard.html
function revision(l, IRL, now) {
  if (!l.start_date) return null;
  const [ry, rq] = l.irl_ref_annee && l.irl_ref_trimestre ? [+l.irl_ref_annee, +l.irl_ref_trimestre] : refTrim(l.start_date);
  let last = l.irl_last_revision; try { if (typeof last === 'string') last = JSON.parse(last); } catch (e) { last = null; }
  const s = new Date(String(l.start_date).slice(0, 10) + 'T00:00:00');
  const anniv = n => { const d = new Date(s); d.setFullYear(s.getFullYear() + n); return d; };
  let n = 0; while (anniv(n + 1) <= now) n++;
  const faite = k => !!last && Number(last.annee_indice) >= ry + k;
  let k = n >= 1 && !faite(n) ? n : n + 1; while (faite(k)) k++;
  const targetY = ry + k, oldI = IRL[`${targetY - 1}-${rq}`], newI = IRL[`${targetY}-${rq}`], rent = Number(l.rent) || 0;
  const nouveau = oldI && newI ? Math.round(rent * newI / oldI * 100) / 100 : null;
  return { rq, targetY, anniv: anniv(k), limite: anniv(k + 1), oldI, newI, rent, nouveau, echu: now >= anniv(k) };
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  const IRL = { ...IRL_BASE };
  const insee = await majIndices(); if (insee) Object.assign(IRL, insee);
  try { (await api('irl_indices?select=trimestre,valeur') || []).forEach(x => { if (+x.valeur > 100) IRL[x.trimestre] = +x.valeur; }); } catch (e) {}

  const now = new Date();
  let leases = [];
  try { leases = await api('leases?select=*&landlord_signed_at=not.is.null&tenant_signed_at=not.is.null') || []; }
  catch (e) { return { statusCode: 200, body: 'Lecture des baux impossible : ' + e.message }; }
  // Baux confiés à une agence : la révision est gérée par l'agence
  let sousMandat = new Set(); try { sousMandat = new Set((await api('gestion_mandats?select=lease_id&statut=neq.resilie') || []).map(m => m.lease_id).filter(Boolean)); } catch (e) {}
  const bids = [...new Set(leases.map(l => l.booking_id).filter(Boolean))];
  const finis = new Set(); if (bids.length) try { (await api(`bookings?select=id,tenancy_ended_at&id=in.(${bids.join(',')})`) || []).forEach(b => { if (b.tenancy_ended_at) finis.add(b.id); }); } catch (e) {}
  const lids = [...new Set(leases.map(l => l.listing_id).filter(Boolean))];
  const listings = {}; if (lids.length) try { (await api(`listings?select=*&id=in.(${lids.join(',')})`) || []).forEach(x => listings[x.id] = x); } catch (e) {}
  const profils = {}; const pids = [...new Set(leases.flatMap(l => [l.landlord_id, l.tenant_id]).filter(Boolean))];
  if (pids.length) try { (await api(`profiles?select=clerk_id,full_name,email&clerk_id=in.(${pids.map(x => `"${x}"`).join(',')})`) || []).forEach(p => profils[p.clerk_id] = p); } catch (e) {}

  let envoyes = 0;
  for (const l of leases) {
    try {
      if (sousMandat.has(l.id) || (l.booking_id && finis.has(l.booking_id))) continue;
      const li = listings[l.listing_id] || {};
      const dpe = String(l.dpe_energy_rating || li.dpe || li.epc_rating || '').toUpperCase().trim();
      if (['F', 'G'].includes(dpe)) continue;
      const r = revision(l, IRL, now);
      if (!r || !r.echu || r.nouveau == null || r.nouveau <= r.rent) continue;
      if (Number(l.irl_notif_annee) >= r.targetY) continue;
      const loc = profils[l.tenant_id]?.full_name || l.tenant_name || 'votre locataire';
      const logement = li.title || 'votre logement';
      const lien = `${SITE}/landlord-dashboard.html?revision=${l.id}`;
      const txt = `Date anniversaire du bail de ${loc} (« ${logement} ») le ${fr(r.anniv)} : vous pouvez réviser le loyer hors charges de ${eur(r.rent)} à ${eur(r.nouveau)} (+${eur(r.nouveau - r.rent)}/mois). Calcul : ${eur(r.rent)} × ${nb(r.newI)} (IRL ${trim(r.rq)} ${r.targetY}) ÷ ${nb(r.oldI)} (IRL ${trim(r.rq)} ${r.targetY - 1}). <a href='/landlord-dashboard.html?revision=${l.id}'>Appliquer la révision</a> (ou Gestion locative → « ${logement} » → Révision du loyer). À demander avant le ${fr(r.limite)}, sinon la hausse de cette année est perdue.`;
      await api('messages', { method: 'POST', body: JSON.stringify({ listing_id: l.listing_id || null, sender_id: 'system', receiver_id: l.landlord_id, type: 'message', content: txt }) });
      const em = profils[l.landlord_id]?.email;
      if (em) await sendMail({ to: em, subject: `Révision du loyer possible — ${logement}`,
        html: `<p>Bonjour ${esc(profils[l.landlord_id]?.full_name || '')},</p><p>C'est la date anniversaire du bail de <strong>${esc(loc)}</strong> pour <strong>${esc(logement)}</strong>.</p><p>Nouveau loyer hors charges possible : <strong>${eur(r.rent)} → ${eur(r.nouveau)}</strong> (+${eur(r.nouveau - r.rent)}/mois).<br><span style="color:#6b7280">${eur(r.rent)} × ${nb(r.newI)} (IRL ${trim(r.rq)} ${r.targetY}) ÷ ${nb(r.oldI)} (IRL ${trim(r.rq)} ${r.targetY - 1})</span></p><p><a href="${lien}" style="display:inline-block;background:#1B4FD8;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700">Appliquer la révision</a></p><p style="color:#6b7280;font-size:13px">À demander avant le ${fr(r.limite)} : passé ce délai, la hausse de cette année est perdue. Elle compte à partir du jour où vous l'appliquez.</p>` }).catch(() => {});
      await api(`leases?id=eq.${l.id}`, { method: 'PATCH', body: JSON.stringify({ irl_notif_annee: r.targetY }) });
      envoyes++;
    } catch (e) { console.error('revision', l.id, e.message); }
  }
  return { statusCode: 200, body: JSON.stringify({ indices_insee: !!insee, notifications: envoyes }) };
};
