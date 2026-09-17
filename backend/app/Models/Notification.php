<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';

    protected $fillable = ['client_id', 'admin_id', 'titre', 'message', 'type', 'lu'];

    protected $casts = ['lu' => 'boolean'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
