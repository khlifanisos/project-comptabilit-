<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactureVente extends Model
{
    protected $table = 'factures_ventes';

    protected $fillable = [
        'client_id', 'numero', 'client_nom', 'date', 'echeance',
        'montant_ht', 'tva', 'montant_ttc', 'statut_reglement', 'fichier', 'notes',
    ];

    protected $casts = [
        'date' => 'date', 'echeance' => 'date',
        'montant_ht' => 'float', 'tva' => 'float', 'montant_ttc' => 'float',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
