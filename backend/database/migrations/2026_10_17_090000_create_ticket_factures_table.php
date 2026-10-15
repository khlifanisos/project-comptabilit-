<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ticket_factures', function (Blueprint $table) {
            $table->id();
            // One invoice ("bon d'intervention") per validated ticket.
            $table->foreignId('ticket_id')->unique()->constrained('tickets')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('administrateurs')->cascadeOnDelete();

            $table->string('numero')->unique();          // e.g. "26-000001"
            $table->date('date_facture');
            $table->string('societe')->nullable();
            $table->string('client_code')->nullable();
            $table->string('client_nom');
            $table->string('observation', 500)->nullable();
            $table->string('exercice', 10)->nullable();
            $table->enum('statut', ['en_instance', 'facture', 'reg_client'])->default('en_instance');
            $table->string('mode_paiement')->nullable();

            // PDF print options, as on the desktop form.
            $table->boolean('duplicata')->default(false);
            $table->boolean('tampon')->default(false);
            $table->boolean('sans_en_tete')->default(false);

            // [{designation, debours, qt, pu_ht, tva, remise}] — totals are recomputed server-side.
            $table->json('lignes');
            $table->decimal('remise_acc_taux', 6, 3)->default(0);
            $table->decimal('timbre', 18, 3)->default(1);

            $table->decimal('montant_brut', 18, 3)->default(0);
            $table->decimal('remise_acc', 18, 3)->default(0);
            $table->decimal('montant_debours', 18, 3)->default(0);
            $table->decimal('montant_ht', 18, 3)->default(0);
            $table->decimal('montant_tva', 18, 3)->default(0);
            $table->decimal('montant_ttc', 18, 3)->default(0);
            $table->decimal('net_facture', 18, 3)->default(0);
            $table->json('bases_tva');                     // {"0": base, "7": base, "13": base, "19": base}

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_factures');
    }
};
