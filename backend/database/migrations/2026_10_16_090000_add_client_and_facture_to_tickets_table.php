<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('assigned_to')
                ->constrained('clients')->nullOnDelete();
            $table->boolean('facture')->default(false)->after('statut');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn('facture');
        });
    }
};
