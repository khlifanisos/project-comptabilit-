<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Administrateur extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'administrateurs';

    // is_super_admin deliberately excluded from $fillable — it must never be
    // settable through a mass-assigned request (e.g. the profile update
    // endpoint). It's only ever changed via forceFill() by a trusted process.
    protected $fillable = ['nom', 'entreprise', 'email', 'mot_de_passe', 'avatar', 'notif_email', 'notif_platform'];

    protected $hidden = ['mot_de_passe', 'remember_token'];

    protected $casts = [
        'notif_email'    => 'boolean',
        'notif_platform' => 'boolean',
        'is_super_admin' => 'boolean',
    ];

    public function ticketsAssigned()
    {
        return $this->hasMany(Ticket::class, 'assigned_to');
    }

    public function ticketsCreated()
    {
        return $this->hasMany(Ticket::class, 'created_by');
    }

    public function getAuthPassword(): string
    {
        return $this->mot_de_passe;
    }
}
