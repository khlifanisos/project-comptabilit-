<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Administrateur extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'administrateurs';

    protected $fillable = ['nom', 'entreprise', 'email', 'mot_de_passe', 'avatar', 'notif_email', 'notif_platform'];

    protected $hidden = ['mot_de_passe', 'remember_token'];

    protected $casts = [
        'notif_email'    => 'boolean',
        'notif_platform' => 'boolean',
    ];

    public function getAuthPassword(): string
    {
        return $this->mot_de_passe;
    }
}
