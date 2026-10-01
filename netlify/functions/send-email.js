const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Trouve Ton Toit <noreply@trouvetonoit.fr>';

// ─── Templates ───────────────────────────────────────────────────────────────

const templates = {

  // Invitation co-locataire à créer un compte
  co_locataire_invite: ({ mainLocataireNom, listingTitle, address, signupUrl }) => ({
    subject: `🏠 Vous avez été ajouté(e) comme co-locataire — ${listingTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1B4FD8;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="color:#fff;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Trouve Ton Toit</p>
          <h1 style="color:#fff;font-size:22px;margin:0">Vous êtes co-locataire</h1>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Bonjour,</p>
          <p><strong>${mainLocataireNom}</strong> vous a ajouté(e) comme co-locataire pour le logement :</p>
          <div style="background:#f8f7f4;border-radius:8px;padding:14px 18px;margin:16px 0">
            <strong>${listingTitle}</strong><br>
            <span style="color:#6b7280;font-size:.9em">${address}</span>
          </div>
          <p>Créez votre compte pour accéder au bail et le signer :</p>
          <a href="${signupUrl}" style="display:inline-block;background:#1B4FD8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:8px">Créer mon compte →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="color:#9ca3af;font-size:.8em">Trouve Ton Toit — Location meublée en France</p>
        </div>
      </div>`
  }),

  // Refus date de visite
  visit_date_refusé: ({ locataireNom, listingTitle, dashboardUrl }) => ({
    subject: `📅 Date de visite non disponible — ${listingTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1B4FD8;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="color:#fff;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Trouve Ton Toit</p>
          <h1 style="color:#fff;font-size:22px;margin:0">Date non disponible</h1>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Bonjour ${locataireNom},</p>
          <p>La date de visite que vous avez proposée pour <strong>${listingTitle}</strong> n'est malheureusement pas disponible.</p>
          <p>Connectez-vous à votre espace pour proposer une nouvelle date :</p>
          <a href="${dashboardUrl}" style="display:inline-block;background:#1B4FD8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:8px">Mon espace locataire →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="color:#9ca3af;font-size:.8em">Trouve Ton Toit — Location meublée en France</p>
        </div>
      </div>`
  }),

  // Invitation garant à signer l'acte de caution solidaire
  garant_invite: ({ garantNom, locataireNom, listingTitle, listingAddress, bailUrl }) => ({
    subject: `📄 Acte de caution solidaire à signer — ${listingTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0F2D7A;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="color:rgba(255,255,255,.7);font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Trouve Ton Toit</p>
          <h1 style="color:#fff;font-size:22px;margin:0">Acte de caution solidaire</h1>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Bonjour <strong>${garantNom}</strong>,</p>
          <p>Vous avez été désigné(e) comme garant(e) pour <strong>${locataireNom}</strong> dans le cadre de la location du logement suivant :</p>
          <div style="background:#f8f7f4;border-radius:8px;padding:14px 18px;margin:16px 0">
            <strong>${listingTitle}</strong><br>
            <span style="color:#6b7280;font-size:.9em">${listingAddress||''}</span>
          </div>
          <p>Le bail a été accepté par toutes les parties. Vous devez maintenant signer l'<strong>acte de caution solidaire</strong> joint au bail.</p>
          <p>Cliquez sur le bouton ci-dessous pour accéder au bail et apposer votre signature :</p>
          <a href="${bailUrl}" style="display:inline-block;background:#B45309;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:800;font-size:1em;margin-top:8px">✍️ Signer l'acte de caution →</a>
          <p style="color:#6b7280;font-size:.85em;margin-top:20px">Ce lien vous donne accès au contrat de location en lecture seule, ainsi qu'au formulaire de signature de l'acte de caution solidaire en bas de page.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="color:#9ca3af;font-size:.8em">Trouve Ton Toit — Location meublée en France · <a href="https://trouvetonoit.fr" style="color:#9ca3af">trouvetonoit.fr</a></p>
        </div>
      </div>`
  }),

  // Confirmation au garant + notification bailleur/locataire que le garant a signé
  garant_signed: ({ garantNom, locataireNom, listingTitle, bailUrl, recipientRole }) => ({
    subject: `✅ Acte de caution solidaire signé — ${listingTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="color:rgba(255,255,255,.8);font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Trouve Ton Toit</p>
          <h1 style="color:#fff;font-size:22px;margin:0">Caution signée ✅</h1>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          ${recipientRole === 'garant'
            ? `<p>Bonjour <strong>${garantNom}</strong>,</p>
               <p>Votre signature de l'acte de caution solidaire pour le bail de <strong>${locataireNom}</strong> a bien été enregistrée.</p>`
            : `<p>Bonjour,</p>
               <p><strong>${garantNom}</strong> vient de signer l'acte de caution solidaire pour le bail de <strong>${locataireNom}</strong>.</p>`
          }
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:16px 0">
            <strong>${listingTitle}</strong>
          </div>
          <a href="${bailUrl}" style="display:inline-block;background:#1B4FD8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:8px">Consulter le bail →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
          <p style="color:#9ca3af;font-size:.8em">Trouve Ton Toit — Location meublée en France · <a href="https://trouvetonoit.fr" style="color:#9ca3af">trouvetonoit.fr</a></p>
        </div>
      </div>`
  }),

};

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { template, to, data } = JSON.parse(event.body);

    if (!templates[template]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown template: ' + template }) };
    }
    if (!to) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing "to" address' }) };
    }

    const { subject, html } = templates[template](data || {});

    const { error } = await resend.emails.send({ from: FROM, to, subject, html });

    if (error) {
      console.error('Resend error:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('send-email handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
