<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeclarationSociale extends Model
{
    protected $table = 'declarations_sociales';

    protected $fillable = [
        'client_id', 'admin_id', 'type', 'periode', 'periode_type', 'date_limite',
        'nombre_employes', 'masse_salariale', 'taux_cotisation',
        'part_patronale', 'part_salariale', 'montant',
        'statut', 'fichier', 'notes', 'viewed_at',
    ];

    protected $casts = [
        'date_limite'     => 'date',
        'montant'         => 'float',
        'masse_salariale' => 'float',
        'taux_cotisation' => 'float',
        'part_patronale'  => 'float',
        'part_salariale'  => 'float',
        'viewed_at'       => 'datetime',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function admin()
    {
        return $this->belongsTo(Administrateur::class, 'admin_id');
    }
}
