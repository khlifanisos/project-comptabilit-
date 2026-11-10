<?php

/*
 * Identity of the cabinet printed on the invoices (header, footer, stamp).
 * Every value can be overridden from .env.
 *
 * Images: drop the logo and the scanned stamp at the paths below (PNG/JPG).
 * When a file is missing the invoice falls back to the cabinet's name in text
 * and to an empty "Signature et Cachet" space.
 */
return [
    'sigle'    => env('CABINET_SIGLE', 'CEC'),
    'nom'      => env('CABINET_NOM', 'CEC SARL'),
    'activite' => env('CABINET_ACTIVITE', "CABINET D'EXPERTISE COMPTABLE"),
    'qualites' => array_filter(explode('|', env('CABINET_QUALITES', 'Expert Comptable - OECT|Commissaire Aux Comptes'))),
    'mention'  => env('CABINET_MENTION', "Inscrite au tableau de l'O.E.C.T"),

    'siege'     => env('CABINET_SIEGE', "Résidence Les Jardins Avenue des Violettes Bureau A31 Jardins d'El Manzah 2"),
    'mf'        => env('CABINET_MF', '1272305H/A/M/000'),
    'telephone' => env('CABINET_TELEPHONE', '31 508 637'),
    'email'     => env('CABINET_EMAIL', 'cec@cec-expert.tn'),
    'rib'       => env('CABINET_RIB', '25118000000109201370'),
    'banque'    => env('CABINET_BANQUE', "BANQUE ZITOUNA AGENCE JARDIN D'EL MANZAH"),

    'logo'   => env('CABINET_LOGO', public_path('images/cabinet/logo.png')),
    'cachet' => env('CABINET_CACHET', public_path('images/cabinet/cachet.png')),
];
