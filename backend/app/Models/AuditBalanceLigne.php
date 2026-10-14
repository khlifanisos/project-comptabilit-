<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditBalanceLigne extends Model
{
    protected $table = 'audit_balance_lignes';

    protected $fillable = ['import_id', 'compte', 'libelle', 'solde', 'date_operation', 'debit', 'credit'];

    protected $casts = [
        'solde'          => 'decimal:3',
        'debit'          => 'decimal:3',
        'credit'         => 'decimal:3',
        'date_operation' => 'date',
    ];

    public function import()
    {
        return $this->belongsTo(AuditBalanceImport::class, 'import_id');
    }
}
