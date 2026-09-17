<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE factures_ventes MODIFY COLUMN statut_reglement ENUM('non_regle','partiel','regle','exportee') NOT NULL DEFAULT 'non_regle'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE factures_ventes MODIFY COLUMN statut_reglement ENUM('non_regle','partiel','regle') NOT NULL DEFAULT 'non_regle'");
    }
};
