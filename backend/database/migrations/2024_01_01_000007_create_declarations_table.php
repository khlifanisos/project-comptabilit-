<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('declarations_fiscales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['TVA', 'IS', 'IR', 'autre']);
            $table->string('periode');
            $table->date('date_limite');
            $table->decimal('montant', 15, 2)->default(0);
            $table->enum('statut', ['a_declarer', 'deposee', 'validee'])->default('a_declarer');
            $table->string('fichier')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('declarations_sociales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['CNSS', 'CIMR', 'AMO', 'autre']);
            $table->string('periode');
            $table->date('date_limite');
            $table->decimal('montant', 15, 2)->default(0);
            $table->enum('statut', ['a_declarer', 'deposee', 'validee'])->default('a_declarer');
            $table->string('fichier')->nullable();
            $table->timestamps();
        });

        Schema::create('echeanciers_leasing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('contrat_ref');
            $table->string('bien');
            $table->string('bailleur');
            $table->date('date_debut');
            $table->date('date_fin');
            $table->decimal('mensualite', 15, 2);
            $table->decimal('option_achat', 15, 2)->default(0);
            $table->date('prochaine_echeance');
            $table->enum('statut', ['actif', 'solde', 'en_retard'])->default('actif');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('echeanciers_leasing');
        Schema::dropIfExists('declarations_sociales');
        Schema::dropIfExists('declarations_fiscales');
    }
};
