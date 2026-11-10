<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Retenue à la source (3 %) withheld by the client on the honoraires TTC:
     * the invoice keeps its TTC, the net to pay is TTC − retenue.
     */
    public function up(): void
    {
        Schema::table('ticket_factures', function (Blueprint $table) {
            $table->boolean('retenue_source')->default(false)->after('timbre');
            $table->decimal('montant_retenue', 18, 3)->default(0)->after('montant_ttc');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_factures', function (Blueprint $table) {
            $table->dropColumn(['retenue_source', 'montant_retenue']);
        });
    }
};
