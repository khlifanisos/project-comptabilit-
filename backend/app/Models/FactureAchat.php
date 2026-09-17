<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactureAchat extends Model
{
    protected $table = 'factures_achats';

    protected $fillable = [
        'client_id', 'numero', 'fournisseur', 'date',
        'montant_ht', 'tva', 'montant_ttc', 'statut', 'fichier', 'notes',
    ];

    protected $casts = ['date' => 'date', 'montant_ht' => 'float', 'tva' => 'float', 'montant_ttc' => 'float'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
