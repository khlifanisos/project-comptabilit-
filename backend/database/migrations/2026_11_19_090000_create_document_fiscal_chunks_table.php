<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Text extracted from the documentation fiscale PDFs, cut into passages and
 * full-text indexed, so the chatbot can find the passages that answer a question.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_fiscal_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_fiscal_id')->constrained('documents_fiscaux')->cascadeOnDelete();
            $table->unsignedSmallInteger('page')->default(0); // 0 = the document's description card
            $table->string('titre', 400);                     // document title, repeated so it counts in the search
            $table->text('contenu');
            $table->index(['document_fiscal_id', 'page']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            Schema::table('document_fiscal_chunks', fn (Blueprint $t) => $t->fullText(['titre', 'contenu']));
        }

        Schema::table('documents_fiscaux', function (Blueprint $table) {
            $table->unsignedInteger('nb_caracteres')->nullable()->after('taille'); // extracted text length (≈0 = scanned PDF)
            $table->timestamp('indexe_le')->nullable()->after('nb_caracteres');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_fiscal_chunks');
        Schema::table('documents_fiscaux', function (Blueprint $table) {
            $table->dropColumn(['nb_caracteres', 'indexe_le']);
        });
    }
};
