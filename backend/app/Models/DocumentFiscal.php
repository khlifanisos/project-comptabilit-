<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentFiscal extends Model
{
    protected $table = 'documents_fiscaux';

    public const CATEGORIES = ['lois_finances', 'notes_communes', 'conventions', 'recueils', 'autre'];

    protected $fillable = ['categorie', 'annee', 'sous_categorie', 'titre', 'description', 'fichier', 'nom_original', 'taille', 'source_url', 'admin_id'];

    // Storage path is internal: files are only served through the controller
    protected $hidden = ['fichier', 'admin_id', 'source_url'];

    protected $casts = ['annee' => 'integer', 'taille' => 'integer'];
}
