<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            // Distinguishes a cabinet's super admin (assigns & validates tickets)
            // from regular admins (who only work the tickets assigned to them).
            $table->boolean('is_super_admin')->default(false)->after('entreprise');
        });
    }

    public function down(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->dropColumn('is_super_admin');
        });
    }
};
