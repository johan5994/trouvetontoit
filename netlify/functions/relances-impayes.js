// Relances automatiques de loyers impayés — fonction planifiée Netlify (tous les jours).
// À déclarer dans netlify.toml :
//   [functions."relances-impayes"]
//     schedule = "@daily"
// Variables d'environnement : SUPABASE_SERVICE_KEY, RESEND_API_KEY (+ RESEND_FROM).
//
// • J+5 après l'échéance sans paiement : relance amiable au locataire (message + e-mail), une seule fois.
// • J+15 : rappel au propriétaire qu'une mise en demeure (LRAR) est à envoyer (une seule fois).
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const FROM = process.env.RESEND_FROM || 'Trouve Ton Toit <onboarding@resend.dev>';
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });

const eur = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('fr-FR') + ' €';
const fr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const iso = d => d.toISOString().slice(0, 10);

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  const today = new Date();
  const j5 = iso(new Date(today.getTime() - 5 * 864e5));
  const j15 = iso(new Date(today.getTime() - 15 * 864e5));
  let relances = 0, alertes = 0;

  // 1) Relance amiable J+5
  const aRelancer = await api(`payments?select=*&type=in.(rent,first_rent)&status=in.(pending,late)&due_date=lte.${j5}&relance_at=is.null`);
  for (const p of aRelancer || []) {
    try {
      const [prof] = await api(`profiles?select=full_name,email&clerk_id=eq.${encodeURIComponent(p.tenant_id)}`) || [];
      const [li] = p.listing_id ? (await api(`listings?select=title&id=eq.${p.listing_id}`) || []) : [];
      const logement = li?.title || 'votre logement';
      await api('messages', { method: 'POST', body: JSON.stringify({ listing_id: p.listing_id || null, sender_id: 'system', receiver_id: p.tenant_id, type: 'message',
        content: `Rappel : le loyer de ${eur(p.amount)} dû le ${fr(p.due_date)} pour « ${logement} » n'a pas encore été reçu. Merci de régulariser rapidement ou de contacter votre propriétaire en cas de difficulté.` }) });
      if (prof?.email && process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: prof.email, subject: `Rappel : loyer du ${fr(p.due_date)} non reçu — ${logement}`,
            html: `<p>Bonjour ${prof.full_name || ''},</p><p>Sauf erreur, le loyer de <strong>${eur(p.amount)}</strong> dû le <strong>${fr(p.due_date)}</strong> pour <strong>${logement}</strong> n'a pas encore été reçu.</p><p>Merci de régulariser rapidement ou de contacter votre propriétaire depuis <a href="${SITE}/tenant-dashboard.html">votre espace</a>.</p>` }) });
      }
      await api(`payments?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ relance_at: new Date().toISOString(), status: 'late' }) });
      if (p.landlord_id) await api('messages', { method: 'POST', body: JSON.stringify({ listing_id: p.listing_id || null, sender_id: 'system', receiver_id: p.landlord_id, type: 'message',
        content: `Relance automatique envoyée à ${prof?.full_name || 'votre locataire'} : loyer de ${eur(p.amount)} du ${fr(p.due_date)} non reçu. Suivi dans « Gestion locative ».` }) });
      relances++;
    } catch (e) { console.error('relance', p.id, e.message); }
  }

  // 2) J+15 : rappeler au propriétaire la mise en demeure
  const aMettreEnDemeure = await api(`payments?select=*&type=in.(rent,first_rent)&status=in.(pending,late)&due_date=lte.${j15}&mise_en_demeure_at=is.null&alerte_mise_en_demeure_at=is.null`);
  for (const p of aMettreEnDemeure || []) {
    try {
      if (p.landlord_id) await api('messages', { method: 'POST', body: JSON.stringify({ listing_id: p.listing_id || null, sender_id: 'system', receiver_id: p.landlord_id, type: 'message',
        content: `Loyer du ${fr(p.due_date)} (${eur(p.amount)}) toujours impayé après 15 jours. Envoyez une mise en demeure en recommandé : la lettre est prête dans « Gestion locative ». Si le locataire a un garant ou Visale, vérifiez les délais affichés.` }) });
      await api(`payments?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ alerte_mise_en_demeure_at: new Date().toISOString() }) });
      alertes++;
    } catch (e) { console.error('alerte', p.id, e.message); }
  }
  console.log({ relances, alertes });
  return { statusCode: 200, body: JSON.stringify({ relances, alertes }) };
};
