<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contrats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('administrateurs')->cascadeOnDelete();

            // Billing company of the cabinet that issues the invoices.
            $table->string('societe')->nullable();
            $table->string('designation')->nullable();     // e.g. "Tenue de comptabilité"

            // Rémunération: one préfacture per period, or a single one for a mission.
            $table->enum('type', ['mensuelle', 'trimestrielle', 'semestrielle', 'annuelle', 'mission']);
            $table->decimal('montant_ht', 18, 3);          // per period (or for the whole mission)
            $table->unsignedTinyInteger('taux_tva')->default(19);

            $table->date('date_debut');
            $table->date('date_fin')->nullable();          // open-ended when null
            $table->boolean('actif')->default(true);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contrats');
    }
};
