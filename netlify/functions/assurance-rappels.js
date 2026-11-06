// Rappels d'assurance habitation — fonction planifiée Netlify (tous les jours).
// Pour chaque bail en cours, on regarde la dernière attestation validée de chaque locataire :
//  • 30 jours avant la fin : rappel au locataire (message + e-mail) ;
//  • à l'échéance, si aucune nouvelle attestation n'a été déposée : rappel au locataire ET au propriétaire.
// Chaque rappel n'est envoyé qu'une fois (colonnes rappel_30_at / rappel_exp_at).
// Variables : SUPABASE_SERVICE_KEY ; e-mail facultatif (BREVO_API_KEY + BREVO_SENDER, voir _shared/mailer.js).
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const { sendMail } = require('./_shared/mailer');
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';
const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fr = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function notifier(to, profil, sujet, texte) {
  try { await api('messages', { method: 'POST', body: JSON.stringify({ sender_id: 'system', receiver_id: to, type: 'message', content: texte }) }); } catch (e) { console.error('message', e.message); }
  if (profil?.email) await sendMail({ to: profil.email, subject: sujet, html: `<p>Bonjour ${esc(profil.full_name || '')},</p><p>${esc(texte)}</p><p><a href="${SITE}">Ouvrir Trouve Ton Toit</a></p>` }).catch(() => {});
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  let rows = [];
  try { rows = await api('assurances_habitation?select=*&order=deposee_at.desc') || []; } catch (e) { return { statusCode: 200, body: 'Table assurances_habitation : ' + e.message }; }
  const auj = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00');
  // Dernière attestation par (bail, locataire)
  const parCle = {};
  rows.forEach(r => { const k = r.lease_id + ':' + r.tenant_id; (parCle[k] = parCle[k] || []).push(r); });
  const leaseIds = [...new Set(rows.map(r => r.lease_id).filter(Boolean))];
  const baux = {};
  if (leaseIds.length) (await api(`leases?select=id,end_date,booking_id&id=in.(${leaseIds.join(',')})`) || []).forEach(l => baux[l.id] = l);
  const bkIds = [...new Set(Object.values(baux).map(l => l.booking_id).filter(Boolean))];
  const partis = new Set();
  if (bkIds.length) (await api(`bookings?select=id,tenancy_ended_at&id=in.(${bkIds.join(',')})`) || []).forEach(b => { if (b.tenancy_ended_at) partis.add(b.id); });
  const ids = [...new Set(rows.flatMap(r => [r.tenant_id, r.landlord_id]).filter(Boolean))];
  const profils = {};
  if (ids.length) try { (await api(`profiles?select=clerk_id,full_name,email&clerk_id=in.(${ids.map(x => `"${x}"`).join(',')})`) || []).forEach(p => profils[p.clerk_id] = p); } catch (e) {}
  let envois = 0;
  for (const liste of Object.values(parCle)) {
    const val = liste.find(r => r.statut === 'validee');
    if (!val || !val.date_fin) continue;
    const bail = baux[val.lease_id];
    if (bail && (partis.has(bail.booking_id) || (bail.end_date && new Date(bail.end_date) < auj))) continue; // location terminée
    // Une attestation plus récente déposée (en attente ou validée) : rien à rappeler
    if (liste.some(r => r !== val && r.statut !== 'refusee' && new Date(r.deposee_at) > new Date(val.deposee_at))) continue;
    const j = Math.round((new Date(String(val.date_fin).slice(0, 10) + 'T12:00:00') - auj) / 864e5);
    try {
      if (j < 0 && !val.rappel_exp_at) {
        await notifier(val.tenant_id, profils[val.tenant_id], 'Votre assurance habitation a expiré',
          `Votre attestation d'assurance habitation a expiré le ${fr(val.date_fin)}. L'assurance est obligatoire pendant toute la location : déposez la nouvelle attestation dans Mon logement.`);
        if (val.landlord_id) await notifier(val.landlord_id, profils[val.landlord_id], `Assurance habitation expirée — ${val.tenant_name || 'votre locataire'}`,
          `L'attestation d'assurance habitation de ${val.tenant_name || 'votre locataire'} a expiré le ${fr(val.date_fin)} et aucune nouvelle attestation n'a été déposée. Le locataire a été relancé. Suivi : Mes locations → le bien → Assurance habitation.`);
        await api(`assurances_habitation?id=eq.${val.id}`, { method: 'PATCH', body: JSON.stringify({ rappel_exp_at: new Date().toISOString() }) });
        envois++;
      } else if (j >= 0 && j <= 30 && !val.rappel_30_at) {
        await notifier(val.tenant_id, profils[val.tenant_id], 'Votre assurance habitation arrive à échéance',
          `Votre attestation d'assurance habitation expire le ${fr(val.date_fin)}. Pensez à déposer la nouvelle attestation dans Mon logement dès que votre assureur vous l'envoie.`);
        await api(`assurances_habitation?id=eq.${val.id}`, { method: 'PATCH', body: JSON.stringify({ rappel_30_at: new Date().toISOString() }) });
        envois++;
      }
    } catch (e) { console.error('assurance', val.id, e.message); }
  }
  return { statusCode: 200, body: JSON.stringify({ attestations: rows.length, envois }) };
};
