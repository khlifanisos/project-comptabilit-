<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_balance_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['n', 'n_1', 'grand_livre']);
            $table->string('nom_fichier');
            $table->string('fichier');
            $table->unsignedInteger('nb_lignes')->default(0);
            $table->timestamps();

            // One current import per type per client — re-uploading replaces it.
            $table->unique(['client_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_balance_imports');
    }
};
