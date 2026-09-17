<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeclarationFiscale extends Model
{
    protected $table = 'declarations_fiscales';

    protected $fillable = [
        'client_id', 'type', 'periode', 'date_limite', 'montant', 'statut', 'fichier', 'notes',
    ];

    protected $casts = ['date_limite' => 'date', 'montant' => 'float'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}