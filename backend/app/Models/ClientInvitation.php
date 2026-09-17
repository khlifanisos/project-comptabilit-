<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientInvitation extends Model
{
    protected $table = 'client_invitations';

    protected $fillable = ['admin_id', 'invited_email'];

    public function admin()
    {
        return $this->belongsTo(Administrateur::class, 'admin_id');
    }
}