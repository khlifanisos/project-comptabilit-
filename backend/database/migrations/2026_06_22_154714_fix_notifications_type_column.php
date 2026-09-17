<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE notifications MODIFY type VARCHAR(50) NOT NULL DEFAULT 'info'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE notifications MODIFY type ENUM('facture','echeance','info','alert') NOT NULL DEFAULT 'info'");
    }
};
