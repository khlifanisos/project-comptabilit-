<?php

namespace App\Console\Commands;

use App\Models\DocumentFiscal;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Imports the documentation fiscale library from a JSON manifest:
 *   [{ "categorie": "lois_finances", "annee": 2025, "sous_categorie": null,
 *      "titre": "Loi de finances 2025", "source_url": "https://…/x.pdf" }, …]
 *
 * Each PDF is downloaded and stored on the private disk. Documents whose source_url
 * is already in the database are skipped, so the command can be re-run safely
 * (e.g. after an interruption, or on the production server).
 */
class ImportDocumentsFiscaux extends Command
{
    protected $signature = 'documents-fiscaux:import
        {manifest=database/data/documents_fiscaux.json : JSON manifest path (relative to the backend folder)}
        {--categorie= : Only import this category}
        {--limit=0 : Stop after importing this many documents (0 = all)}
        {--delay=500 : Pause between downloads, in milliseconds}';

    protected $description = 'Download and import the documentation fiscale PDFs listed in a manifest';

    public function handle(): int
    {
        $path = base_path($this->argument('manifest'));
        if (!is_file($path)) {
            $this->error("Manifest introuvable : $path");
            return self::FAILURE;
        }

        $items = json_decode(file_get_contents($path), true);
        if (!is_array($items)) {
            $this->error('Manifest JSON invalide.');
            return self::FAILURE;
        }

        if ($cat = $this->option('categorie')) {
            $items = array_values(array_filter($items, fn ($i) => ($i['categorie'] ?? null) === $cat));
        }

        $existing = DocumentFiscal::whereNotNull('source_url')->pluck('source_url')->flip();
        $limit    = (int) $this->option('limit');
        $delayUs  = max(0, (int) $this->option('delay')) * 1000;
        $disk     = Storage::disk('local');

        $imported = $skipped = 0;
        $failed   = [];

        $bar = $this->output->createProgressBar(count($items));
        $bar->start();

        foreach ($items as $item) {
            $bar->advance();
            $url = $item['source_url'] ?? null;

            if (!$url || !in_array($item['categorie'] ?? null, DocumentFiscal::CATEGORIES, true) || empty($item['titre'])) {
                $failed[] = [$item['titre'] ?? '?', 'entrée invalide'];
                continue;
            }
            if (isset($existing[$url])) {
                $skipped++;
                continue;
            }

            try {
                $response = Http::timeout(180)->retry(2, 3000)
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; doc-importer)'])
                    ->get($url);
                $body = $response->body();

                if (!$response->successful() || !str_starts_with($body, '%PDF')) {
                    $failed[] = [$item['titre'], 'pas un PDF (HTTP ' . $response->status() . ')'];
                    continue;
                }

                $stored = 'documents_fiscaux/' . Str::random(40) . '.pdf';
                $disk->put($stored, $body);

                DocumentFiscal::create([
                    'categorie'      => $item['categorie'],
                    'annee'          => $item['annee'] ?? null,
                    'sous_categorie' => isset($item['sous_categorie']) ? Str::limit($item['sous_categorie'], 147) : null,
                    'titre'          => Str::limit($item['titre'], 197),
                    'description'    => $item['description'] ?? null,
                    'fichier'        => $stored,
                    'nom_original'   => Str::limit(basename(parse_url($url, PHP_URL_PATH) ?: 'document.pdf'), 250),
                    'taille'         => strlen($body),
                    'source_url'     => $url,
                ]);

                $existing[$url] = true;
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = [$item['titre'], Str::limit($e->getMessage(), 80)];
            }

            if ($limit > 0 && $imported >= $limit) break;
            usleep($delayUs);
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Importés : $imported — déjà présents : $skipped — échecs : " . count($failed));
        if ($failed) {
            $this->table(['Document', 'Erreur'], $failed);
        }

        return self::SUCCESS;
    }
}
