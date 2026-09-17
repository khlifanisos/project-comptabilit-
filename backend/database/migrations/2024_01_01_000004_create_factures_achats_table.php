<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('factures_achats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('numero');
            $table->string('fournisseur');
            $table->date('date');
            $table->decimal('montant_ht', 15, 2)->default(0);
            $table->decimal('tva', 15, 2)->default(0);
            $table->decimal('montant_ttc', 15, 2)->default(0);
            $table->enum('statut', ['en_attente', 'validee', 'rejetee'])->default('en_attente');
            $table->string('fichier')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factures_achats');
    }
};
