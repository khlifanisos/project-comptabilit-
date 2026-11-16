<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('documents_fiscaux', function (Blueprint $table) {
            $table->id();
            // lois_finances | notes_communes | conventions | recueils | autre
            $table->string('categorie', 30)->index();
            $table->unsignedSmallInteger('annee')->nullable()->index();
            $table->string('titre');
            $table->text('description')->nullable();
            $table->string('fichier');
            $table->string('nom_original')->nullable();
            $table->unsignedBigInteger('taille')->nullable();
            $table->unsignedBigInteger('admin_id')->nullable();
            $table->timestamps();

            $table->foreign('admin_id')->references('id')->on('administrateurs')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents_fiscaux');
    }
};
