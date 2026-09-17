<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Client extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'clients';

    protected $fillable = [
        'nom', 'email', 'mot_de_passe', 'entreprise',
        'telephone', 'adresse', 'avatar', 'is_actif', 'is_approved',
        'last_login_at', 'notif_email', 'notif_platform',
    ];

    protected $hidden = ['mot_de_passe', 'remember_token'];

    protected $casts = [
        'is_actif'      => 'boolean',
        'is_approved'   => 'boolean',
        'notif_email'   => 'boolean',
        'notif_platform'=> 'boolean',
        'last_login_at' => 'datetime',
    ];

    public function getAuthPassword(): string
    {
        return $this->mot_de_passe;
    }

    public function facturesAchats()
    {
        return $this->hasMany(FactureAchat::class, 'client_id');
    }

    public function facturesVentes()
    {
        return $this->hasMany(FactureVente::class, 'client_id');
    }

    public function relevesBancaires()
    {
        return $this->hasMany(ReleveBancaire::class, 'client_id');
    }

    public function declarationsFiscales()
    {
        return $this->hasMany(DeclarationFiscale::class, 'client_id');
    }

    public function declarationsSociales()
    {
        return $this->hasMany(DeclarationSociale::class, 'client_id');
    }

    public function echeanciers()
    {
        return $this->hasMany(EcheancierLeasing::class, 'client_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'client_id');
    }
}
