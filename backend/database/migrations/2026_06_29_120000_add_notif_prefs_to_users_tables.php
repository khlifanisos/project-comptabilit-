<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->boolean('notif_email')->default(true)->after('avatar');
            $table->boolean('notif_platform')->default(true)->after('notif_email');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->boolean('notif_email')->default(true)->after('avatar');
            $table->boolean('notif_platform')->default(true)->after('notif_email');
        });
    }

    public function down(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->dropColumn(['notif_email', 'notif_platform']);
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['notif_email', 'notif_platform']);
        });
    }
};