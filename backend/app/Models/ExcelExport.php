<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExcelExport extends Model
{
    protected $table = 'excel_exports';

    protected $fillable = ['client_id', 'source', 'reference', 'devise', 'fichier', 'taille'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
