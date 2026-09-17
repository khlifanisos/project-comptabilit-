<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReleveBancaire extends Model
{
    protected $table = 'releves_bancaires';

    protected $fillable = [
        'client_id', 'banque', 'compte', 'date', 'libelle',
        'debit', 'credit', 'solde', 'rapproche',
    ];

    protected $casts = ['date' => 'date', 'rapproche' => 'boolean'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
