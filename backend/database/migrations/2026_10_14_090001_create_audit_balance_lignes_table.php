<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_balance_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_id')->constrained('audit_balance_imports')->cascadeOnDelete();
            $table->string('compte');
            $table->string('libelle')->nullable();
            // Used for 'n' / 'n_1' balance imports.
            $table->decimal('solde', 18, 3)->nullable();
            // Used for 'grand_livre' imports (journal-entry style rows).
            $table->date('date_operation')->nullable();
            $table->decimal('debit', 18, 3)->nullable();
            $table->decimal('credit', 18, 3)->nullable();
            $table->timestamps();

            $table->index('compte');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_balance_lignes');
    }
};
