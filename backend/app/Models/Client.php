<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Client extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'clients';

    /**
     * Clients an admin may see or act on — the single source of truth for
     * multi-cabinet isolation. A super admin sees every cabinet; a regular
     * admin only the clients of their own entreprise; an admin with no
     * entreprise sees nobody (never "everybody").
     */
    public function scopeVisibleTo(\Illuminate\Database\Eloquent\Builder $query, Administrateur $admin): \Illuminate\Database\Eloquent\Builder
    {
        if ($admin->is_super_admin) {
            return $query;
        }

        $entreprise = $admin->normalizedEntreprise();
        if ($entreprise === '') {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereRaw('LOWER(TRIM(entreprise)) = ?', [$entreprise]);
    }

    protected $fillable = [
        'nom', 'email', 'mot_de_passe', 'entreprise', 'raison_sociale', 'matricule_fiscale', 'gerant', 'contact',
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

    public function contrats()
    {
        return $this->hasMany(Contrat::class, 'client_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'client_id');
    }
}
