<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A passage of a documentation fiscale PDF, used by the chatbot search. */
class DocumentFiscalChunk extends Model
{
    protected $table = 'document_fiscal_chunks';

    public $timestamps = false;

    protected $fillable = ['document_fiscal_id', 'page', 'titre', 'contenu'];

    public function document(): BelongsTo
    {
        return $this->belongsTo(DocumentFiscal::class, 'document_fiscal_id');
    }
}
