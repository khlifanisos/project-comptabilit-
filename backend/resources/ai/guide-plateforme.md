# Guide de la plateforme Intelligence Comptabilité

Intelligence Comptabilité est une plateforme en ligne qui relie un cabinet comptable tunisien à ses clients (entreprises). Le client dépose ses pièces (relevés, factures, contrats), suit ses déclarations et échange avec son comptable ; le cabinet traite les dossiers, facture ses honoraires et suit la santé comptable de chaque client. Un assistant IA (ce chatbot) est disponible sur toutes les pages, via la bulle en bas à droite.

## Compte et connexion
- **Créer un compte** : depuis la page d'accueil, bouton « Se connecter » puis « Créer un compte ». On choisit le type de compte (client ou administrateur du cabinet), on saisit nom, email et mot de passe (8 caractères minimum), puis on confirme avec le code à 6 chiffres reçu par email. Un client peut aussi être invité directement par le cabinet.
- **Se connecter** : page « Connexion », avec son email et son mot de passe, en choisissant son espace (client ou administrateur).
- **Mot de passe oublié** : lien « Mot de passe oublié » sur la page de connexion : on saisit son email, on reçoit un code de vérification par email, puis on choisit un nouveau mot de passe.
- **Modifier son profil ou son mot de passe** : menu du compte (avatar en haut à droite) → « Mon profil » (client) ou « Paramètres » (administrateur).
- **Se déconnecter** : menu du compte → « Déconnexion ».
- **Mode sombre** : icône lune/soleil dans l'en-tête.
- **Devise** : la devise d'affichage (par défaut TND) est visible dans l'en-tête ; seul un administrateur peut la changer.
- **Support** : bouton WhatsApp en bas de l'écran pour contacter le cabinet, en plus de la Messagerie.

## Navigation
Le menu en haut de l'écran donne accès à toutes les rubriques ; sur téléphone, il s'ouvre avec le bouton ☰. Le logo ramène à l'Accueil. Une cloche affiche les notifications (dépôts, validations, échéances).

## Espace client
- **Accueil** : présentation des services, accès rapides, derniers textes fiscaux publiés.
- **Messagerie** : discussion directe avec le comptable du cabinet, avec envoi de pièces jointes. Un point rouge signale les messages non lus.
- **Comptabilité → Relevés bancaires** : bouton « Importer un relevé » (PDF ou image : JPG, PNG…). Les mouvements (libellé, débit, crédit) sont extraits automatiquement, puis rapprochés avec les factures. Export Excel possible.
- **Comptabilité → Factures d'achats** : bouton « Importer une facture » (PDF ou photo). Fournisseur, numéro, montants HT/TVA/TTC sont lus automatiquement par l'IA. Aperçu du PDF, export Excel.
- **Comptabilité → Factures de ventes** : même fonctionnement pour les factures clients, avec la date d'échéance et le suivi de l'encaissement.
- **Comptabilité → Échéancier leasing** : bouton « Nouveau contrat » pour enregistrer un crédit-bail (bailleur, bien financé, mensualité) ; la plateforme affiche le tableau d'amortissement, la progression du contrat et la prochaine échéance. Export PDF.
- **Déclarations → Déclarations fiscales** : suivi des déclarations TVA, IS, IR par période, avec la date limite et le statut (À déclarer, Déposée, Validée, Rejetée, Échéance proche). Bouton « Nouvelle déclaration », export Excel.
- **Déclarations → Déclarations sociales** : déclarations CNSS et charges du personnel, avec le total à payer et la date limite ; on peut joindre un justificatif (PDF, JPG, PNG, 10 Mo max). Export Excel et PDF.
- **Audit intelligent** : bouton pour lancer une analyse automatique de la comptabilité : score de fiabilité sur 100, anomalies détectées (doublons, incohérences de TVA, écarts…), vérifications effectuées et recommandations.
- **Documentation fiscale** : bibliothèque des lois de finances, notes communes, conventions de non double imposition et codes fiscaux tunisiens, avec recherche, lecture en ligne et bouton « Télécharger ».

## Espace administrateur (cabinet)
- **Cabinet → Messagerie** : conversations avec tous les clients.
- **Cabinet → Tickets** : tâches et demandes, avec priorité, échéance, collaborateur assigné, pièces jointes et remarques du super administrateur ; un ticket peut être marqué comme facturé.
- **Cabinet → Facturation** : contrats d'honoraires par client, génération des préfactures, factures (En instance, Facturé, Réglé par le client) et imputation des règlements.
- **Comptabilité → Clients** : liste des clients, bouton « Ajouter / Inviter un client » (invitation par email), modification, suppression, accès au dossier complet de chaque client (factures, relevés, fichiers Excel, facturation).
- **Comptabilité → Documents** : pièces déposées par les clients, à valider ou rejeter (En attente, Validé, Rejeté).
- **Audit intelligent** : vue d'ensemble de la santé comptable de tous les clients : score de fiabilité, anomalies, alertes, dernière activité.
- **Textes et lois** : bibliothèque interne de textes de référence (PDF, 20 Mo max).
- **Documentation fiscale** : même bibliothèque que les clients ; l'administrateur peut en plus ajouter, modifier ou supprimer des documents (bouton « Ajouter un document »).
- **Changer de profil** : bouton « Admin » dans l'en-tête pour se connecter temporairement en tant qu'un client et voir son espace.
- **Paramètres** : profil, mot de passe, notifications (email et dans l'interface), numéro de support WhatsApp.
- Un **super administrateur** voit tous les tickets du cabinet ; un administrateur simple voit les tickets qui lui sont assignés.

## Sécurité et données
Chaque client ne voit que ses propres données. Les documents fiscaux sont réservés aux utilisateurs connectés. Les échanges passent par une connexion sécurisée (HTTPS).
