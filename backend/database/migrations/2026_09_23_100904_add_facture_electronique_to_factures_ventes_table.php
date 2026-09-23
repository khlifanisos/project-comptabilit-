<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('factures_ventes', function (Blueprint $table) {
            // Conformité à l'obligation de facturation électronique (El Fatoora /
            // format TEIF) en vigueur en Tunisie depuis le 1er janvier 2026.
            // null = non renseigné (facture antérieure à l'obligation, ou pas
            // encore vérifiée) — true/false = statut explicitement déclaré.
            $table->boolean('facture_electronique')->nullable()->after('statut_reglement');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('factures_ventes', function (Blueprint $table) {
            $table->dropColumn('facture_electronique');
        });
    }
};
