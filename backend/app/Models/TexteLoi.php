<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TexteLoi extends Model
{
    protected $table = 'textes_lois';

    protected $fillable = ['titre', 'description', 'fichier', 'taille', 'admin_id'];

    public function admin()
    {
        return $this->belongsTo(Administrateur::class, 'admin_id');
    }
}
