# Trouve Ton Toit — Plateforme locative France

Dépôt front-end statique (Vanilla HTML/CSS/JS) déployable sur Netlify.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil — listings, recherche |
| `tenant-dashboard.html` | Espace locataire — bail, paiements, quittances |
| `landlord-dashboard.html` | Espace bailleur — gestion des biens |
| `agency-dashboard-fr.html` | Portail agence — dossiers, agenda, conformité France |
| `agency-dashboard.html` | Portail agence — base RestMalta (à fusionner) |
| `reservation-visite.html` | Système de plages de visite |
| `honoraires-france.html` | Calculateur honoraires loi Alur, DPE, encadrement |
| `dossier-locataire.html` | Dossier numérique locataire (style DossierFacile) |
| `ttt-brand.html` | Charte graphique Trouve Ton Toit |
| `admin.html` | Back-office admin |
| `how-it-works.html` | Page fonctionnement |

## Stack
- Front : Vanilla HTML/CSS/JS — zéro dépendance
- Auth : Clerk (Google OAuth)
- DB/Storage : Supabase
- E-sign : DocuSeal
- Paiements : Stripe
- Email : Resend
- Déploiement : Netlify

## Lois françaises couvertes
- Loi du 6 juillet 1989 (baux d'habitation)
- Loi Alur 2014 (honoraires, encadrement)
- Loi Élan 2018 (bail mobilité)
- Loi Climat 2021 (DPE, passoires thermiques)
- Encadrement des loyers : Paris, Lille, Lyon, Bordeaux, Montpellier, Grenoble
- Révision IRL — indice de référence des loyers

## Domaine cible
`trouvetonoit.fr`
