<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EcheancierLeasing extends Model
{
    protected $table = 'echeanciers_leasing';

    protected $fillable = [
        'client_id', 'contrat_ref', 'bien', 'description_bien', 'bailleur',
        'date_debut', 'date_fin', 'mensualite', 'nombre_mensualites',
        'option_achat', 'valeur_achat', 'capital_restant_du',
        'taux_interet', 'tva_loyers', 'total_loyers',
        'prochaine_echeance', 'statut', 'notes', 'fichier',
    ];

    protected $casts = [
        'date_debut'         => 'date',
        'date_fin'           => 'date',
        'prochaine_echeance' => 'date',
        'mensualite'         => 'float',
        'option_achat'       => 'float',
        'valeur_achat'       => 'float',
        'capital_restant_du' => 'float',
        'taux_interet'       => 'float',
        'tva_loyers'         => 'float',
        'total_loyers'       => 'float',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
