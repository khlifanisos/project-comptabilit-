<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reglement extends Model
{
    protected $table = 'reglements';

    public const MODES = ['virement', 'cheque', 'especes', 'traite', 'carte'];

    protected $fillable = [
        'facture_id', 'created_by', 'mode', 'banque', 'reference', 'montant', 'date_reglement', 'observation',
    ];

    protected $casts = [
        'montant'        => 'float',
        'date_reglement' => 'date:Y-m-d',
    ];

    public function facture()
    {
        return $this->belongsTo(TicketFacture::class, 'facture_id');
    }
}
