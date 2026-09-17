<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Parametre extends Model
{
    protected $table = 'parametres';

    protected $fillable = ['devise', 'whatsapp'];

    public static function currentDevise(): string
    {
        return static::first()->devise ?? 'TND';
    }
}
