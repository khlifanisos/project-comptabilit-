<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentFiscal extends Model
{
    protected $table = 'documents_fiscaux';

    public const CATEGORIES = ['lois_finances', 'notes_communes', 'conventions', 'recueils', 'autre'];

    protected $fillable = ['categorie', 'annee', 'sous_categorie', 'titre', 'description', 'fichier', 'nom_original', 'taille', 'source_url', 'admin_id'];

    // Storage path is internal: files are only served through the controller
    protected $hidden = ['fichier', 'admin_id', 'source_url', 'nb_caracteres', 'indexe_le'];

    protected $casts = ['annee' => 'integer', 'taille' => 'integer', 'nb_caracteres' => 'integer', 'indexe_le' => 'datetime'];

    public const CATEGORIE_LABELS = [
        'lois_finances'  => 'Loi de finances',
        'notes_communes' => 'Note commune',
        'conventions'    => 'Convention de non double imposition',
        'recueils'       => 'Recueil de textes fiscaux',
        'autre'          => 'Autre texte',
    ];

    public function chunks(): HasMany
    {
        return $this->hasMany(DocumentFiscalChunk::class);
    }
}
