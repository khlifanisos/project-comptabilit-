<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_invitations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->string('invited_email');
            $table->timestamps();

            $table->foreign('admin_id')->references('id')->on('administrateurs')->onDelete('cascade');
            $table->unique(['admin_id', 'invited_email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_invitations');
    }
};