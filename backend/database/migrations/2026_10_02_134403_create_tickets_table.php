<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('titre');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('administrateurs')->cascadeOnDelete();
            $table->foreignId('assigned_to')->constrained('administrateurs')->cascadeOnDelete();
            $table->enum('statut', ['a_faire', 'en_cours', 'en_attente_validation', 'valide', 'rejete'])
                ->default('a_faire');
            $table->enum('priorite', ['basse', 'normale', 'haute', 'urgente'])->default('normale');
            $table->date('date_echeance')->nullable();
            $table->text('commentaire_validation')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
