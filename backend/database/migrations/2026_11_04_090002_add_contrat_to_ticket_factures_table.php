<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * ticket_factures becomes the cabinet's single invoice list: an invoice comes
     * either from a validated ticket or from a contract period (préfacture).
     */
    public function up(): void
    {
        Schema::table('ticket_factures', function (Blueprint $table) {
            $table->unsignedBigInteger('ticket_id')->nullable()->change();
            $table->foreignId('client_id')->nullable()->after('ticket_id')->constrained('clients')->nullOnDelete();
            $table->foreignId('contrat_id')->nullable()->after('client_id')->constrained('contrats')->nullOnDelete();
            $table->date('periode_debut')->nullable()->after('contrat_id');
            $table->date('periode_fin')->nullable()->after('periode_debut');
            // A contract period is billed once.
            $table->unique(['contrat_id', 'periode_debut']);
        });

        DB::statement('UPDATE ticket_factures f JOIN tickets t ON t.id = f.ticket_id SET f.client_id = t.client_id');
    }

    public function down(): void
    {
        Schema::table('ticket_factures', function (Blueprint $table) {
            // The foreign key uses the unique index: drop it first.
            $table->dropForeign(['contrat_id']);
            $table->dropUnique(['contrat_id', 'periode_debut']);
            $table->dropColumn('contrat_id');
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn(['periode_debut', 'periode_fin']);
        });
    }
};
