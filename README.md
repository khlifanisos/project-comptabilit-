<div align="center">

<img alt="Laravel" src="https://img.shields.io/badge/Laravel-10-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" />
<img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img alt="MUI" src="https://img.shields.io/badge/MUI-5-007FFF?style=for-the-badge&logo=mui&logoColor=white" />
<img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479A1?style=for-the-badge&logo=mysql&logoColor=white" />

# Intelligence Comptabilité

## Plateforme full-stack de gestion comptable intelligente

*Centralisez, automatisez et analysez vos documents comptables, fiscaux et sociaux — avec un assistant IA intégré et une gestion clients complète.*

</div>

---

## Fonctionnalités

### Espace Client

| Module | Description |
| --- | --- |
| **Tableau de bord** | StatCards, graphiques Recharts, indicateurs clés en temps réel |
| **Factures Achats & Ventes** | Création, suivi des statuts (réglé / partiel / non réglé), export Excel |
| **Relevés Bancaires** | Upload de relevés, rapprochement automatique |
| **Déclarations Fiscales** | TVA, IS, IR — préparation, archivage et suivi des échéances |
| **Déclarations Sociales** | CNSS — calendrier et suivi des paiements |
| **Leasing** | Contrats, mensualités, avancement des remboursements |
| **Audit Intelligent** | Analyse automatique des documents avec détection d'anomalies |
| **Rapports & Exports** | Génération de rapports PDF / Excel multi-modules |
| **Assistant IA** | Chatbot comptable 24h/24 (Gemini API) — TVA, IS, IR, CNSS |
| **Profil & Photo** | Modification des informations, photo de profil, changement de mot de passe |

### Espace Administrateur

| Module | Description |
| --- | --- |
| **Gestion des clients** | CRUD complet (modifier, supprimer, filtrage par entreprise) |
| **Photos de profil clients** | Upload et modification via base64 → fichier serveur |
| **Statut client** | Activer / Suspendre un compte en un clic |
| **Invitation de clients** | Vérification d'email, détection d'entreprise, envoi de liens d'inscription |
| **Email direct** | Composition et envoi d'emails directement depuis l'interface |
| **Audit global** | Vue d'ensemble des activités clients |
| **Rapports globaux** | Agrégation multi-clients |

### Système Transversal

| Module | Description |
| --- | --- |
| **Authentification** | Double rôle (Client / Admin), vérification email (code 6 chiffres), reset mot de passe |
| **Notifications** | Cloche en temps réel, badge unread, marquer lu, supprimer tout, notifications par action |
| **Emails automatiques** | Invitation, inscription, welcome — via SMTP (Brevo / Gmail) |

---

## Stack Technique

### Frontend

| Outil | Rôle |
| --- | --- |
| React 18 + TypeScript | UI réactive, typage statique |
| Vite 5 | Build tool & dev server ultra-rapide |
| Material UI (MUI) 5 | Composants, thème & icônes |
| React Router 6 | Navigation SPA |
| Axios | Client HTTP + intercepteurs auth |
| Recharts | Graphiques & visualisations |
| React Hot Toast | Toasts de feedback utilisateur |

### Backend

| Outil | Rôle |
| --- | --- |
| PHP 8.3 + Laravel 10 | Framework MVC REST API |
| Laravel Sanctum | Authentification API par tokens |
| MySQL 8 | Base de données relationnelle |
| Brevo / SMTP Gmail | Envoi d'emails transactionnels |
| Google Gemini API | Assistant IA comptable |

---

## Architecture du Projet

```text
stage-contabiliter/
├── frontend/                    # React + TypeScript (Vite)
│   └── src/
│       ├── api/                 # axios.ts — client HTTP configuré
│       ├── components/
│       │   ├── common/          # StatCard, Chatbot IA
│       │   └── layout/          # Sidebar, Topbar, NotificationBell
│       ├── contexts/            # AuthContext (état utilisateur global)
│       ├── pages/
│       │   ├── auth/            # Landing, Login, Register, ForgotPassword
│       │   ├── client/          # Dashboard, Factures, Relevés, Déclarations…
│       │   └── admin/           # AdminDashboard, Clients, Documents, Rapports
│       ├── utils/               # notifyRefresh, useProfilePhoto
│       └── theme.ts             # Thème MUI (dark navy #0A1628)
│
├── backend/                     # Laravel 10 API REST
│   ├── app/
│   │   ├── Http/Controllers/    # Auth, Factures, Profile, Notifications, Clients…
│   │   ├── Models/              # Client, Administrateur, Notification, ClientInvitation…
│   │   └── Mail/                # VerificationCodeMail
│   ├── routes/
│   │   └── api.php              # Tous les endpoints REST
│   └── database/
│       ├── migrations/          # Migrations Laravel
│       └── comptabilite.sql     # Schéma + données de démo
│
├── use case/                    # Diagrammes UML (StarUML .mdj)
├── setup-database.bat           # Script d'initialisation BDD
├── start-backend.bat            # Démarrage Laravel (php artisan serve)
└── start-frontend.bat           # Démarrage Vite (npm run dev)
```

---

## Installation & Démarrage

### Prérequis

- PHP 8.2+, Composer
- Node.js 18+, npm
- MySQL 8.x
- Git

### 1. Cloner le projet

```bash
git clone https://github.com/LOORDyassin/stage-contabiliter.git
cd stage-contabiliter
```

### 2. Backend — Laravel

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Configurer `.env` :

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=comptabilite
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=votre@email.com
MAIL_PASSWORD=votre_mot_de_passe_app
MAIL_FROM_ADDRESS=votre@email.com
MAIL_FROM_NAME="Intelligence Comptabilité"

GEMINI_API_KEY=votre_cle_gemini
```

```bash
# Importer la base de données
mysql -u root -p comptabilite < database/comptabilite.sql

# (optionnel) Lancer les migrations
php artisan migrate

# Démarrer le serveur
php artisan serve
```

### 3. Frontend — React

```bash
cd frontend
npm install
npm run dev
```

L'application est accessible sur **http://localhost:5173**

### Démarrage rapide (Windows)

```bash
setup-database.bat   # Initialise la BDD (une seule fois)
start-backend.bat    # php artisan serve sur :8000
start-frontend.bat   # npm run dev sur :5173
```

---

## API — Endpoints Principaux

### Authentification (public)

```text
POST  /api/auth/send-verification     Envoyer code email (6 chiffres)
POST  /api/auth/verify-code           Vérifier le code
POST  /api/auth/register              Créer un compte (client ou admin)
POST  /api/auth/login                 Connexion
POST  /api/auth/forgot-password       Envoyer lien de réinitialisation
POST  /api/auth/reset-password        Réinitialiser le mot de passe
```

### Protégés — Sanctum Bearer Token

```text
GET    /api/auth/me                        Profil utilisateur connecté
POST   /api/auth/logout                    Déconnexion

PUT    /api/profile                        Modifier le profil
PUT    /api/profile/password               Changer le mot de passe
POST   /api/profile/photo                  Mettre à jour la photo de profil

GET    /api/factures-achats                Liste factures achats
POST   /api/factures-achats                Créer une facture achat
PUT    /api/factures-achats/{id}           Modifier
DELETE /api/factures-achats/{id}           Supprimer
GET    /api/factures-achats/export         Export Excel

GET    /api/factures-ventes                Liste factures ventes
POST   /api/factures-ventes                Créer
PUT    /api/factures-ventes/{id}           Modifier
DELETE /api/factures-ventes/{id}           Supprimer

GET    /api/notifications                  Notifications de l'utilisateur
POST   /api/notifications/mark-all-read   Tout marquer comme lu
PATCH  /api/notifications/{id}/read        Marquer une notification lue
DELETE /api/notifications/all              Supprimer toutes les notifications
DELETE /api/notifications/{id}             Supprimer une notification

GET    /api/admin/clients                  Liste des clients (filtrés par entreprise)
PUT    /api/admin/clients/{id}             Modifier un client (+ photo)
DELETE /api/admin/clients/{id}             Supprimer un client
PATCH  /api/admin/clients/{id}/toggle      Activer / Suspendre
POST   /api/admin/clients/{id}/send-email  Envoyer un email direct
POST   /api/admin/clients/invite           Inviter par email
```

---

## Modèle de Données

| Table | Description |
| --- | --- |
| `clients` | Comptes clients (email, nom, entreprise, téléphone, adresse, avatar, is_actif) |
| `administrateurs` | Comptes admin (email, nom, entreprise, avatar) |
| `factures_achats` | Factures fournisseurs |
| `factures_ventes` | Factures clients |
| `releves_bancaires` | Relevés bancaires uploadés |
| `declarations_fiscales` | TVA, IS, IR |
| `declarations_sociales` | CNSS |
| `notifications` | Cloche (admin_id ou client_id, titre, message, type, lu) |
| `client_invitations` | Invitations en attente (admin_id, invited_email) |
| `personal_access_tokens` | Tokens Sanctum |

---

## Design & Thème

- **Couleur principale** — `#0A1628` (dark navy) — sidebar, topbar, pages auth
- **Accent** — `#1565C0` / `#0D47A1` (bleu professionnel)
- **Background dashboard** — `#F0F4F8`
- **Typographie** — Inter (Google Fonts)
- **Composants** — thème MUI personnalisé avec `borderRadius`, transitions et shadows optimisés

---

## Auteur

**Yassine Souissi** — Stage de fin d'études, Développement Full Stack

[![GitHub](https://img.shields.io/badge/GitHub-LOORDyassin-181717?style=flat-square&logo=github)](https://github.com/LOORDyassin)
[![Email](https://img.shields.io/badge/Email-yaassinesouissii%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:yaassinesouissii@gmail.com)

---

<div align="center">
  <sub>© 2026 Intelligence Comptabilité — Tous droits réservés.</sub>
</div>