// Envoi d'e-mails, sans dépendance npm (fetch natif).
//
// 1) Brevo, si BREVO_API_KEY est défini : fonctionne SANS nom de domaine.
//    On vérifie une simple adresse expéditrice (ex. une adresse Gmail) dans Brevo → Expéditeurs,
//    puis on la renseigne dans BREVO_SENDER (ex. « jojo@gmail.com » ou « Trouve Ton Toit <jojo@gmail.com> »).
// 2) Sinon Resend (RESEND_API_KEY + RESEND_FROM sur un domaine vérifié).
//
// Renvoie { ok: true } ou { ok: false, error: 'message lisible' }.

function parseSender(s) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s || '');
  if (m) return { name: m[1] || 'Trouve Ton Toit', email: m[2].trim() };
  return { name: 'Trouve Ton Toit', email: String(s || '').trim() };
}

async function sendMail({ to, subject, html, replyTo }) {
  const dest = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!dest.length) return { ok: false, error: 'Adresse du destinataire manquante' };

  if (process.env.BREVO_API_KEY) {
    if (!process.env.BREVO_SENDER) return { ok: false, error: 'BREVO_SENDER manquant dans les variables d\'environnement Netlify (adresse expéditrice vérifiée dans Brevo)' };
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: parseSender(process.env.BREVO_SENDER),
        to: dest.map(email => ({ email })),
        subject, htmlContent: html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
    });
    if (r.ok) return { ok: true };
    let msg = 'Brevo HTTP ' + r.status;
    try { const j = await r.json(); if (j && j.message) msg = 'Brevo : ' + j.message; } catch (e) {}
    console.error(msg);
    return { ok: false, error: msg };
  }

  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM || 'Trouve Ton Toit <onboarding@resend.dev>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: dest, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (r.ok) return { ok: true };
    let msg = 'Resend HTTP ' + r.status;
    try { const j = await r.json(); if (j && j.message) msg = 'Resend : ' + j.message; } catch (e) {}
    console.error(msg);
    return { ok: false, error: msg };
  }

  return { ok: false, error: 'Aucun service d\'e-mail configuré : ajoutez BREVO_API_KEY et BREVO_SENDER dans les variables d\'environnement Netlify' };
}

module.exports = { sendMail };
