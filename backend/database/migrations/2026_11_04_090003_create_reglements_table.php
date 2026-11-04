<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /** Payments imputed on an invoice; several partial payments are allowed. */
    public function up(): void
    {
        Schema::create('reglements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facture_id')->constrained('ticket_factures')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('administrateurs')->cascadeOnDelete();

            $table->enum('mode', ['virement', 'cheque', 'especes', 'traite', 'carte']);
            $table->string('banque', 100)->nullable();
            $table->string('reference', 100)->nullable();   // n° chèque / virement / traite
            $table->decimal('montant', 18, 3);
            $table->date('date_reglement');
            $table->string('observation', 255)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reglements');
    }
};
