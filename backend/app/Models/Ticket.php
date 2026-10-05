<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    protected $table = 'tickets';

    protected $fillable = [
        'titre', 'description', 'created_by', 'assigned_to',
        'statut', 'priorite', 'date_echeance',
        'commentaire_validation', 'submitted_at', 'reviewed_at',
    ];

    protected $casts = [
        'date_echeance' => 'date',
        'submitted_at'  => 'datetime',
        'reviewed_at'   => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(Administrateur::class, 'created_by');
    }

    public function assignee()
    {
        return $this->belongsTo(Administrateur::class, 'assigned_to');
    }

    public function attachments()
    {
        return $this->hasMany(TicketAttachment::class);
    }
}
