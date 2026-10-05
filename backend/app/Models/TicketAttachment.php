<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketAttachment extends Model
{
    protected $table = 'ticket_attachments';

    protected $fillable = ['ticket_id', 'uploaded_by', 'nom_original', 'fichier', 'mime_type', 'taille'];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function uploader()
    {
        return $this->belongsTo(Administrateur::class, 'uploaded_by');
    }
}
