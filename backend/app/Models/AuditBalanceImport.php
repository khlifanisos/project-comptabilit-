<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditBalanceImport extends Model
{
    protected $table = 'audit_balance_imports';

    protected $fillable = ['client_id', 'type', 'nom_fichier', 'fichier', 'nb_lignes'];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function lignes()
    {
        return $this->hasMany(AuditBalanceLigne::class, 'import_id');
    }
}
