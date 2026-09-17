<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationCode extends Model
{
    protected $table = 'verification_codes';

    protected $fillable = ['email', 'code', 'expires_at'];

    protected $casts = ['expires_at' => 'datetime'];
}