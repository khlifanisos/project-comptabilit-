<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('echeanciers_leasing', function (Blueprint $table) {
            $table->string('description_bien')->nullable()->after('bien');
            $table->decimal('valeur_achat', 15, 2)->nullable()->after('description_bien');
            $table->integer('nombre_mensualites')->default(0)->after('mensualite');
            $table->decimal('capital_restant_du', 15, 2)->nullable()->after('nombre_mensualites');
            $table->decimal('taux_interet', 8, 4)->nullable()->after('capital_restant_du');
            $table->decimal('tva_loyers', 15, 2)->nullable()->after('taux_interet');
            $table->decimal('total_loyers', 15, 2)->nullable()->after('tva_loyers');
            $table->text('notes')->nullable()->after('statut');
            $table->string('fichier')->nullable()->after('notes');
        });

        // Add a_venir to the statut enum
        DB::statement("ALTER TABLE echeanciers_leasing MODIFY statut ENUM('actif', 'solde', 'en_retard', 'a_venir') NOT NULL DEFAULT 'actif'");
    }

    public function down(): void
    {
        Schema::table('echeanciers_leasing', function (Blueprint $table) {
            $table->dropColumn([
                'description_bien', 'valeur_achat', 'nombre_mensualites',
                'capital_restant_du', 'taux_interet', 'tva_loyers',
                'total_loyers', 'notes', 'fichier',
            ]);
        });

        DB::statement("ALTER TABLE echeanciers_leasing MODIFY statut ENUM('actif', 'solde', 'en_retard') NOT NULL DEFAULT 'actif'");
    }
};
