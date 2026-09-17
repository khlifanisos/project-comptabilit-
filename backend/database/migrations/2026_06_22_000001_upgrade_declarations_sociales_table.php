<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('declarations_sociales', function (Blueprint $table) {
            $table->unsignedBigInteger('admin_id')->nullable()->after('client_id');
            $table->string('periode_type')->default('mensuelle')->after('periode');
            $table->integer('nombre_employes')->default(0)->after('periode_type');
            $table->decimal('masse_salariale', 15, 2)->default(0)->after('nombre_employes');
            $table->decimal('taux_cotisation', 8, 4)->default(0)->after('masse_salariale');
            $table->decimal('part_patronale', 15, 2)->default(0)->after('taux_cotisation');
            $table->decimal('part_salariale', 15, 2)->default(0)->after('part_patronale');
            $table->text('notes')->nullable()->after('fichier');
            $table->timestamp('viewed_at')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('declarations_sociales', function (Blueprint $table) {
            $table->dropColumn([
                'admin_id', 'periode_type', 'nombre_employes', 'masse_salariale',
                'taux_cotisation', 'part_patronale', 'part_salariale', 'notes', 'viewed_at',
            ]);
        });
    }
};
