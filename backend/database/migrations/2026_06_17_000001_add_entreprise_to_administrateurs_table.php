<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->string('entreprise')->nullable()->after('nom');
        });
    }

    public function down(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->dropColumn('entreprise');
        });
    }
};