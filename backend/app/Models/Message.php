<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $table = 'messages';

    protected $fillable = [
        'client_id', 'sender_type', 'sender_admin_id', 'is_bot', 'body', 'read_at',
        'attachment_path', 'attachment_type', 'attachment_name', 'attachment_mime', 'attachment_size',
    ];

    protected $casts = ['read_at' => 'datetime', 'is_bot' => 'boolean'];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function senderAdmin()
    {
        return $this->belongsTo(Administrateur::class, 'sender_admin_id');
    }
}
