<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('documents_fiscaux', function (Blueprint $table) {
            // Grouping when there is no year (e.g. a country for conventions, a code for recueils)
            $table->string('sous_categorie', 150)->nullable()->after('annee');
            // Where an imported document came from — makes the import command re-runnable without duplicates
            $table->string('source_url', 500)->nullable()->unique()->after('taille');
        });
    }

    public function down(): void
    {
        Schema::table('documents_fiscaux', function (Blueprint $table) {
            $table->dropUnique(['source_url']);
            $table->dropColumn(['sous_categorie', 'source_url']);
        });
    }
};
