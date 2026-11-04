<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Fiche client used for invoicing: téléphone and adresse already exist.
     * "entreprise" is the cabinet the client belongs to (it scopes the admins),
     * so the client's own company name gets its own column.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('raison_sociale', 150)->nullable()->after('entreprise');
            $table->string('matricule_fiscale', 50)->nullable()->after('raison_sociale');
            $table->string('gerant', 150)->nullable()->after('matricule_fiscale');
            // Day-to-day contact person (name / phone / email, free text).
            $table->string('contact', 255)->nullable()->after('gerant');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['raison_sociale', 'matricule_fiscale', 'gerant', 'contact']);
        });
    }
};
