<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE factures_ventes MODIFY COLUMN statut_reglement ENUM('non_regle','partiel','regle','exportee','rejetee') NOT NULL DEFAULT 'non_regle'");
        DB::statement("ALTER TABLE declarations_fiscales MODIFY COLUMN statut ENUM('a_declarer','deposee','validee','rejetee') NOT NULL DEFAULT 'a_declarer'");
        DB::statement("ALTER TABLE declarations_sociales MODIFY COLUMN statut ENUM('a_declarer','deposee','validee','rejetee') NOT NULL DEFAULT 'a_declarer'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE factures_ventes MODIFY COLUMN statut_reglement ENUM('non_regle','partiel','regle','exportee') NOT NULL DEFAULT 'non_regle'");
        DB::statement("ALTER TABLE declarations_fiscales MODIFY COLUMN statut ENUM('a_declarer','deposee','validee') NOT NULL DEFAULT 'a_declarer'");
        DB::statement("ALTER TABLE declarations_sociales MODIFY COLUMN statut ENUM('a_declarer','deposee','validee') NOT NULL DEFAULT 'a_declarer'");
    }
};
