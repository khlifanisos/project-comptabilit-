<?php

namespace Database\Seeders;

use App\Models\Administrateur;
use App\Models\Client;
use App\Models\FactureAchat;
use App\Models\FactureVente;
use App\Models\Notification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = Administrateur::firstOrCreate(
            ['email' => 'admin@comptabilite.ma'],
            [
                'nom'          => 'Super Admin',
                'mot_de_passe' => Hash::make('Admin123!'),
            ]
        );

        $client = Client::firstOrCreate(
            ['email' => 'client@exemple.ma'],
            [
                'nom'          => 'Ahmed Benali',
                'mot_de_passe' => Hash::make('Client123!'),
                'entreprise'   => 'Alpha SARL',
            ]
        );

        FactureAchat::firstOrCreate(
            ['numero' => 'ACH-001'],
            [
                'client_id'   => $client->id,
                'fournisseur' => 'Fournitures Pro',
                'date'        => '2026-06-01',
                'montant_ht'  => 10000,
                'tva'         => 2000,
                'montant_ttc' => 12000,
                'statut'      => 'validee',
            ]
        );

        FactureVente::firstOrCreate(
            ['numero' => 'VTE-001'],
            [
                'client_id'        => $client->id,
                'client_nom'       => 'Beta Corp',
                'date'             => '2026-06-01',
                'echeance'         => '2026-07-01',
                'montant_ht'       => 12500,
                'tva'              => 2500,
                'montant_ttc'      => 15000,
                'statut_reglement' => 'regle',
            ]
        );

        Notification::firstOrCreate(
            ['titre' => 'Bienvenue sur Intelligence Comptabilité'],
            [
                'client_id' => $client->id,
                'message'   => 'Votre compte a été créé avec succès. Bonne gestion !',
                'type'      => 'info',
            ]
        );

        Notification::firstOrCreate(
            ['titre' => 'Échéance TVA T2 2026'],
            [
                'client_id' => $client->id,
                'message'   => 'Votre déclaration TVA T2 est due le 31 juillet 2026.',
                'type'      => 'echeance',
            ]
        );
    }
}
