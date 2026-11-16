<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    // URLs are case- and accent-sensitive (".../Note-Commune-n°10.pdf" ≠ ".../Note-Commune-N°10.pdf"),
    // but the default *_ci collation made the unique index treat them as duplicates.
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') return;
        DB::statement('ALTER TABLE documents_fiscaux MODIFY source_url VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') return;
        DB::statement('ALTER TABLE documents_fiscaux MODIFY source_url VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
    }
};
