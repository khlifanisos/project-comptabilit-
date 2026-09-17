<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE factures_achats MODIFY COLUMN statut ENUM('en_attente','validee','rejetee','exportee') NOT NULL DEFAULT 'en_attente'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE factures_achats MODIFY COLUMN statut ENUM('en_attente','validee','rejetee') NOT NULL DEFAULT 'en_attente'");
    }
};
