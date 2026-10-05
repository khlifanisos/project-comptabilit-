<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Archives every invoice analyzed by IA and converted to Excel, so
        // admins can find them again later from a client's dossier instead of
        // relying on the client having kept their own downloaded copy.
        Schema::create('excel_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('source', ['achat', 'vente']);
            $table->string('reference');
            $table->string('devise', 10)->nullable();
            $table->string('fichier');
            $table->unsignedBigInteger('taille')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('excel_exports');
    }
};
