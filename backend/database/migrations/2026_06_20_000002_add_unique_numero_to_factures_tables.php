<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    public function up(): void
    {
        // Fix existing duplicates before adding the constraint
        $this->fixDuplicates('factures_achats', 'ACH-');
        $this->fixDuplicates('factures_ventes', 'VTE-');

        Schema::table('factures_achats', function (Blueprint $table) {
            $table->unique(['client_id', 'numero'], 'factures_achats_client_numero_unique');
        });

        Schema::table('factures_ventes', function (Blueprint $table) {
            $table->unique(['client_id', 'numero'], 'factures_ventes_client_numero_unique');
        });
    }

    public function down(): void
    {
        // Add a temporary index on client_id so MySQL doesn't refuse to drop the composite unique key
        DB::statement('ALTER TABLE factures_achats ADD INDEX idx_ach_client_tmp (client_id)');
        DB::statement('ALTER TABLE factures_achats DROP INDEX factures_achats_client_numero_unique');
        DB::statement('ALTER TABLE factures_achats DROP INDEX idx_ach_client_tmp');

        DB::statement('ALTER TABLE factures_ventes ADD INDEX idx_vte_client_tmp (client_id)');
        DB::statement('ALTER TABLE factures_ventes DROP INDEX factures_ventes_client_numero_unique');
        DB::statement('ALTER TABLE factures_ventes DROP INDEX idx_vte_client_tmp');
    }

    private function fixDuplicates(string $table, string $prefix): void
    {
        $duplicates = DB::table($table)
            ->select('client_id', 'numero', DB::raw('COUNT(*) as cnt'))
            ->groupBy('client_id', 'numero')
            ->having('cnt', '>', 1)
            ->get();

        foreach ($duplicates as $dup) {
            $rows = DB::table($table)
                ->where('client_id', $dup->client_id)
                ->where('numero', $dup->numero)
                ->orderBy('id')
                ->get();

            // Find current max number for this client and assign next sequential numbers to duplicates
            $maxNumero = DB::table($table)
                ->where('client_id', $dup->client_id)
                ->where('numero', 'NOT LIKE', '%-DUP%')
                ->max('numero');
            $next = $maxNumero ? (intval(substr($maxNumero, strlen($prefix))) + 1) : 1;

            foreach ($rows->skip(1)->values() as $row) {
                $newNumero = $prefix . str_pad($next, 3, '0', STR_PAD_LEFT);
                DB::table($table)->where('id', $row->id)->update(['numero' => $newNumero]);
                $next++;
            }
        }
    }
};
