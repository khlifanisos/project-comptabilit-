<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A sign-up code must never be usable to reset a password (and vice versa),
 * and a code is burned after a few wrong guesses so the 6-digit space can't
 * be brute-forced.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verification_codes', function (Blueprint $table) {
            $table->string('purpose', 20)->default('register')->after('code');
            $table->unsignedTinyInteger('attempts')->default(0)->after('purpose');
            $table->index(['email', 'purpose']);
        });
    }

    public function down(): void
    {
        Schema::table('verification_codes', function (Blueprint $table) {
            $table->dropIndex(['email', 'purpose']);
            $table->dropColumn(['purpose', 'attempts']);
        });
    }
};
