// Alertes « nouvelles annonces » des locataires — fonction planifiée Netlify (toutes les heures).
// À déclarer dans netlify.toml :
//   [functions."alertes-annonces"]
//     schedule = "@hourly"
// Variables : SUPABASE_SERVICE_KEY ; e-mail facultatif (BREVO_API_KEY + BREVO_SENDER, voir _shared/mailer.js).
// Pour chaque alerte active : les annonces publiées depuis le dernier envoi qui correspondent aux critères
// sont envoyées au locataire (message dans son espace + e-mail si configuré). Même règle que sxCorrespond (tenant-dashboard).
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const { sendMail } = require('./_shared/mailer');
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';
const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const typeDe = l => { const m = l['meublé'] ?? l.furnished; if (l.type === 'room_rental') return 'room_rental'; if (l.type === 'parking') return 'parking'; return m === true ? 'meuble' : m === false ? 'vide' : ''; };
function correspond(l, c) {
  if (c.zone && !norm([l.zone, l.full_address, l.title].join(' ')).includes(norm(c.zone))) return false;
  if (c.max_budget && Number(l.price) > Number(c.max_budget)) return false;
  if (c.type) { const t = typeDe(l); if (['vide', 'meuble'].includes(c.type) ? t !== c.type : l.type !== c.type) return false; }
  if (c.min_rooms && l.type !== 'parking' && (Number(l.spots) || 1) < Number(c.min_rooms)) return false;
  return true;
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  const now = new Date();
  let alertes = [];
  try { alertes = (await api('alerts?select=*') || []).filter(a => a.actif ?? a.active); } catch (e) { return { statusCode: 200, body: 'Table alerts : ' + e.message }; }
  if (!alertes.length) return { statusCode: 200, body: 'Aucune alerte active' };
  const depuis = new Date(now.getTime() - 3 * 864e5).toISOString();
  let annonces = [];
  try { annonces = await api(`listings?select=*&active=eq.true&type=neq.for_sale&created_at=gte.${depuis}&order=created_at.desc`) || []; } catch (e) { return { statusCode: 200, body: e.message }; }
  annonces = annonces.filter(l => !['reserved', 'rented'].includes(l.status));
  const ids = [...new Set(alertes.map(a => a.locataire_id).filter(Boolean))];
  const profils = {}; if (ids.length) try { (await api(`profiles?select=clerk_id,full_name,email&clerk_id=in.(${ids.map(x => `"${x}"`).join(',')})`) || []).forEach(p => profils[p.clerk_id] = p); } catch (e) {}
  let envois = 0;
  for (const a of alertes) {
    try {
      // Première exécution sans date : on part de maintenant (pas de rafale d'anciennes annonces)
      if (!a.dernier_envoi_at) { await api(`alerts?locataire_id=eq.${encodeURIComponent(a.locataire_id)}`, { method: 'PATCH', body: JSON.stringify({ dernier_envoi_at: now.toISOString() }) }); continue; }
      const nouvelles = annonces.filter(l => new Date(l.created_at) > new Date(a.dernier_envoi_at) && l.landlord_id !== a.locataire_id && correspond(l, a));
      if (!nouvelles.length) continue;
      const liste = nouvelles.slice(0, 5);
      const lignes = liste.map(l => `• ${l.title || 'Logement'} — ${l.zone || ''} — ${Number(l.price || 0).toLocaleString('fr-FR')} €/mois : ${SITE}/?annonce=${l.id}`).join('\n');
      const txt = `${nouvelles.length > 1 ? nouvelles.length + ' nouvelles annonces correspondent' : 'Une nouvelle annonce correspond'} à votre alerte :\n${lignes}${nouvelles.length > 5 ? `\n… et ${nouvelles.length - 5} autre(s) dans « Chercher un logement ».` : ''}`;
      await api('messages', { method: 'POST', body: JSON.stringify({ sender_id: 'system', receiver_id: a.locataire_id, type: 'message', content: txt, listing_id: liste[0].id }) });
      const p = profils[a.locataire_id];
      if (p?.email) await sendMail({ to: p.email, subject: nouvelles.length > 1 ? `${nouvelles.length} nouvelles annonces pour vous` : `Nouvelle annonce : ${liste[0].title || 'logement'}`,
        html: `<p>Bonjour ${esc(p.full_name || '')},</p><p>${nouvelles.length > 1 ? 'De nouvelles annonces correspondent' : 'Une nouvelle annonce correspond'} à votre alerte :</p><ul>${liste.map(l => `<li><a href="${SITE}/?annonce=${l.id}">${esc(l.title || 'Logement')}</a> — ${esc(l.zone || '')} — ${Number(l.price || 0).toLocaleString('fr-FR')} €/mois</li>`).join('')}</ul><p style="color:#6b7280;font-size:13px">Modifier ou désactiver l'alerte : espace locataire → Chercher un logement.</p>` }).catch(() => {});
      await api(`alerts?locataire_id=eq.${encodeURIComponent(a.locataire_id)}`, { method: 'PATCH', body: JSON.stringify({ dernier_envoi_at: now.toISOString() }) });
      envois++;
    } catch (e) { console.error('alerte', a.locataire_id, e.message); }
  }
  return { statusCode: 200, body: JSON.stringify({ alertes: alertes.length, envois }) };
};
