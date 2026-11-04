<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contrat extends Model
{
    protected $table = 'contrats';

    /** Billing period length in months; a mission is billed once. */
    public const MOIS = ['mensuelle' => 1, 'trimestrielle' => 3, 'semestrielle' => 6, 'annuelle' => 12];

    public const LIBELLES = [
        'mensuelle'     => 'mensuels',
        'trimestrielle' => 'trimestriels',
        'semestrielle'  => 'semestriels',
        'annuelle'      => 'annuels',
        'mission'       => 'de mission',
    ];

    protected $fillable = [
        'client_id', 'created_by', 'societe', 'designation',
        'type', 'montant_ht', 'taux_tva', 'date_debut', 'date_fin', 'actif',
    ];

    protected $casts = [
        'montant_ht' => 'float',
        'taux_tva'   => 'integer',
        'date_debut' => 'date:Y-m-d',
        'date_fin'   => 'date:Y-m-d',
        'actif'      => 'boolean',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function creator()
    {
        return $this->belongsTo(Administrateur::class, 'created_by');
    }

    public function factures()
    {
        return $this->hasMany(TicketFacture::class);
    }
}
