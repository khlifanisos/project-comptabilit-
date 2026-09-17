-- ============================================================
--  Intelligence Comptabilité — Schéma de base de données
--  À importer dans phpMyAdmin (MySQL 8.0+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `comptabilite_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `comptabilite_db`;

-- -----------------------------------------------------------
-- 0. Migrations (Laravel internal tracking table)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `migrations` (
  `id`        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255)    NOT NULL,
  `batch`     INT             NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`) VALUES
('0001_01_01_000000_create_users_table',                     1),
('0001_01_01_000001_create_cache_table',                     1),
('0001_01_01_000002_create_jobs_table',                      1),
('2024_01_01_000001_create_administrateurs_table',           1),
('2024_01_01_000002_create_clients_table',                   1),
('2024_01_01_000003_create_notifications_table',             1),
('2024_01_01_000004_create_factures_achats_table',           1),
('2024_01_01_000005_create_factures_ventes_table',           1),
('2024_01_01_000006_create_releves_bancaires_table',         1),
('2024_01_01_000007_create_declarations_table',              1),
('2026_06_08_141133_create_personal_access_tokens_table',   1),
('2026_06_09_000001_create_verification_codes_table',        1);

-- -----------------------------------------------------------
-- 1. Administrateurs
-- -----------------------------------------------------------
CREATE TABLE `administrateurs` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom`           VARCHAR(100)    NOT NULL,
  `email`         VARCHAR(150)    NOT NULL UNIQUE,
  `mot_de_passe`  VARCHAR(255)    NOT NULL,
  `avatar`        VARCHAR(255)    DEFAULT NULL,
  `remember_token`VARCHAR(100)    DEFAULT NULL,
  `created_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 2. Clients
-- -----------------------------------------------------------
CREATE TABLE `clients` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom`           VARCHAR(100)    NOT NULL,
  `email`         VARCHAR(150)    NOT NULL UNIQUE,
  `mot_de_passe`  VARCHAR(255)    NOT NULL,
  `entreprise`    VARCHAR(150)    DEFAULT NULL,
  `telephone`     VARCHAR(20)     DEFAULT NULL,
  `adresse`       TEXT            DEFAULT NULL,
  `avatar`        VARCHAR(255)    DEFAULT NULL,
  `is_actif`      TINYINT(1)      NOT NULL DEFAULT 1,
  `remember_token`VARCHAR(100)    DEFAULT NULL,
  `created_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 3. Tokens (Laravel Sanctum)
-- -----------------------------------------------------------
CREATE TABLE `personal_access_tokens` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(255)    NOT NULL,
  `tokenable_id`   BIGINT UNSIGNED NOT NULL,
  `name`           VARCHAR(255)    NOT NULL,
  `token`          VARCHAR(64)     NOT NULL UNIQUE,
  `abilities`      TEXT            DEFAULT NULL,
  `last_used_at`   TIMESTAMP NULL  DEFAULT NULL,
  `expires_at`     TIMESTAMP NULL  DEFAULT NULL,
  `created_at`     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 4. Notifications
-- -----------------------------------------------------------
CREATE TABLE `notifications` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`   BIGINT UNSIGNED DEFAULT NULL,
  `admin_id`    BIGINT UNSIGNED DEFAULT NULL,
  `titre`       VARCHAR(200)    NOT NULL,
  `message`     TEXT            NOT NULL,
  `type`        ENUM('facture','echeance','info','alert') NOT NULL DEFAULT 'info',
  `lu`          TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`admin_id`)  REFERENCES `administrateurs`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 5. Factures d'achats
-- -----------------------------------------------------------
CREATE TABLE `factures_achats` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`    BIGINT UNSIGNED NOT NULL,
  `numero`       VARCHAR(50)     NOT NULL,
  `fournisseur`  VARCHAR(150)    NOT NULL,
  `date`         DATE            NOT NULL,
  `montant_ht`   DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `tva`          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `montant_ttc`  DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `statut`       ENUM('en_attente','validee','rejetee') NOT NULL DEFAULT 'en_attente',
  `fichier`      VARCHAR(255)    DEFAULT NULL,
  `notes`        TEXT            DEFAULT NULL,
  `created_at`   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `factures_achats_client_id_idx` (`client_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 6. Factures de ventes
-- -----------------------------------------------------------
CREATE TABLE `factures_ventes` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`        BIGINT UNSIGNED NOT NULL,
  `numero`           VARCHAR(50)     NOT NULL,
  `client_nom`       VARCHAR(150)    NOT NULL,
  `date`             DATE            NOT NULL,
  `echeance`         DATE            NOT NULL,
  `montant_ht`       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `tva`              DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `montant_ttc`      DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `statut_reglement` ENUM('non_regle','partiel','regle') NOT NULL DEFAULT 'non_regle',
  `fichier`          VARCHAR(255)    DEFAULT NULL,
  `notes`            TEXT            DEFAULT NULL,
  `created_at`       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `factures_ventes_client_id_idx` (`client_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 7. Relevés bancaires
-- -----------------------------------------------------------
CREATE TABLE `releves_bancaires` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`   BIGINT UNSIGNED NOT NULL,
  `banque`      VARCHAR(100)    NOT NULL,
  `compte`      VARCHAR(50)     DEFAULT NULL,
  `date`        DATE            NOT NULL,
  `libelle`     VARCHAR(255)    NOT NULL,
  `debit`       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `credit`      DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `solde`       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `rapproche`   TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `releves_bancaires_client_id_idx` (`client_id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 8. Déclarations fiscales
-- -----------------------------------------------------------
CREATE TABLE `declarations_fiscales` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`   BIGINT UNSIGNED NOT NULL,
  `type`        ENUM('TVA','IS','IR','autre') NOT NULL,
  `periode`     VARCHAR(50)     NOT NULL,
  `date_limite` DATE            NOT NULL,
  `montant`     DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `statut`      ENUM('a_declarer','deposee','validee') NOT NULL DEFAULT 'a_declarer',
  `fichier`     VARCHAR(255)    DEFAULT NULL,
  `notes`       TEXT            DEFAULT NULL,
  `created_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 9. Déclarations sociales
-- -----------------------------------------------------------
CREATE TABLE `declarations_sociales` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`   BIGINT UNSIGNED NOT NULL,
  `type`        ENUM('CNSS','CIMR','AMO','autre') NOT NULL,
  `periode`     VARCHAR(50)     NOT NULL,
  `date_limite` DATE            NOT NULL,
  `montant`     DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `statut`      ENUM('a_declarer','deposee','validee') NOT NULL DEFAULT 'a_declarer',
  `fichier`     VARCHAR(255)    DEFAULT NULL,
  `created_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 10. Échéancier leasing
-- -----------------------------------------------------------
CREATE TABLE `echeanciers_leasing` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id`          BIGINT UNSIGNED NOT NULL,
  `contrat_ref`        VARCHAR(50)     NOT NULL,
  `bien`               VARCHAR(200)    NOT NULL,
  `bailleur`           VARCHAR(150)    NOT NULL,
  `date_debut`         DATE            NOT NULL,
  `date_fin`           DATE            NOT NULL,
  `mensualite`         DECIMAL(15,2)   NOT NULL,
  `option_achat`       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `prochaine_echeance` DATE            NOT NULL,
  `statut`             ENUM('actif','solde','en_retard') NOT NULL DEFAULT 'actif',
  `created_at`         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 11. Codes de vérification (OTP email — register & reset)
-- -----------------------------------------------------------
CREATE TABLE `verification_codes` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`      VARCHAR(255)    NOT NULL,
  `code`       VARCHAR(6)      NOT NULL,
  `expires_at` TIMESTAMP       NOT NULL,
  `created_at` TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `verification_codes_email_index` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- 12. Données de démo
-- -----------------------------------------------------------

-- Admin par défaut  (mot de passe : Admin123!)
INSERT INTO `administrateurs` (`nom`, `email`, `mot_de_passe`) VALUES
('Super Admin', 'admin@comptabilite.ma', '$2y$12$TZFZRmOuVGsUb2TixI96Ueq7dhlkjkWR4r4Oq1FrH/KnBXFi7x/Jm');

-- Client demo  (mot de passe : Client123!)
INSERT INTO `clients` (`nom`, `email`, `mot_de_passe`, `entreprise`) VALUES
('Ahmed Benali', 'client@exemple.ma', '$2y$12$LZFZRmOuVGsUb2TixI96Ue7dhlkjkWR4r4Oq1FrH/KnBXFi7x/La', 'Alpha SARL');

-- Quelques factures demo
INSERT INTO `factures_achats` (`client_id`,`numero`,`fournisseur`,`date`,`montant_ht`,`tva`,`montant_ttc`,`statut`) VALUES
(1,'ACH-001','Fournitures Pro','2026-06-01',10000.00,2000.00,12000.00,'validee'),
(1,'ACH-002','Tech Supplies','2026-06-03',5500.00,1100.00,6600.00,'en_attente');

INSERT INTO `factures_ventes` (`client_id`,`numero`,`client_nom`,`date`,`echeance`,`montant_ht`,`tva`,`montant_ttc`,`statut_reglement`) VALUES
(1,'VTE-001','Beta Corp','2026-06-01','2026-07-01',12500.00,2500.00,15000.00,'regle'),
(1,'VTE-002','Gamma Ltd','2026-06-04','2026-07-04',8166.67,1633.33,9800.00,'partiel');

INSERT INTO `notifications` (`client_id`,`titre`,`message`,`type`,`lu`) VALUES
(1,'Facture validée','Votre facture ACH-001 a été validée par l\'administrateur.','facture',0),
(1,'Échéance TVA','Déclaration TVA T2 due dans 7 jours (31 juillet 2026).','echeance',0);

-- Relevés bancaires demo
INSERT INTO `releves_bancaires` (`client_id`,`banque`,`compte`,`date`,`libelle`,`debit`,`credit`,`solde`,`rapproche`) VALUES
(1,'CIH Bank','007 810 0001234','2026-06-01','Virement client Alpha SARL',0.00,15000.00,85000.00,1),
(1,'CIH Bank','007 810 0001234','2026-06-02','Loyer bureau juin',8000.00,0.00,77000.00,1),
(1,'CIH Bank','007 810 0001234','2026-06-03','Facture fournisseur Tech',6600.00,0.00,70400.00,0),
(1,'CIH Bank','007 810 0001234','2026-06-05','Virement client Beta Corp',0.00,9800.00,80200.00,0),
(1,'CIH Bank','007 810 0001234','2026-06-07','Frais bancaires',250.00,0.00,79950.00,1);

-- Déclarations fiscales demo
INSERT INTO `declarations_fiscales` (`client_id`,`type`,`periode`,`date_limite`,`montant`,`statut`,`notes`) VALUES
(1,'TVA','T1 2026','2026-04-30',18500.00,'validee','Déclaration TVA trimestrielle T1'),
(1,'TVA','T2 2026','2026-07-31',0.00,'a_declarer',NULL),
(1,'IS','Acompte 2026','2026-06-30',24000.00,'deposee','Acompte IS — 2ème versement'),
(1,'IR','Mai 2026','2026-06-15',8200.00,'validee','IR salaires mai 2026');

-- Déclarations sociales demo
INSERT INTO `declarations_sociales` (`client_id`,`type`,`periode`,`date_limite`,`montant`,`statut`) VALUES
(1,'CNSS','Juin 2026','2026-06-25',12400.00,'a_declarer'),
(1,'CIMR','Juin 2026','2026-06-30',3200.00,'a_declarer'),
(1,'AMO','Mai 2026','2026-05-25',4800.00,'validee'),
(1,'CNSS','Mai 2026','2026-05-25',11900.00,'validee');

-- Échéanciers leasing demo
INSERT INTO `echeanciers_leasing` (`client_id`,`contrat_ref`,`bien`,`bailleur`,`date_debut`,`date_fin`,`mensualite`,`option_achat`,`prochaine_echeance`,`statut`) VALUES
(1,'LEA-001','Véhicule Dacia Duster','CIH Leasing','2024-01-01','2029-01-01',3200.00,28000.00,'2026-07-01','actif'),
(1,'LEA-002','Matériel informatique','Wafabail','2023-06-01','2026-06-01',1800.00,5000.00,'2026-07-01','actif'),
(1,'LEA-003','Local commercial','BMCE Leasing','2022-01-01','2032-01-01',12000.00,480000.00,'2026-07-01','actif');
