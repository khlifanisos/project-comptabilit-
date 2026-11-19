<?php

namespace App\Console\Commands;

use App\Models\DocumentFiscal;
use App\Services\DocumentationFiscaleSearch;
use Illuminate\Console\Command;
use Throwable;

/**
 * Extracts the text of the documentation fiscale PDFs so the chatbot can search them.
 * Already indexed documents are skipped unless --force is given.
 */
class IndexDocumentsFiscaux extends Command
{
    protected $signature = 'documents-fiscaux:index {--force : Ré-indexer aussi les documents déjà indexés} {--id=* : Seulement ces documents}';

    protected $description = 'Extrait le texte des PDF de la documentation fiscale pour l\'assistant IA';

    public function handle(DocumentationFiscaleSearch $search): int
    {
        if (!DocumentationFiscaleSearch::available()) {
            $this->error('pdftotext est introuvable (paquet poppler-utils). Lancez la commande dans le conteneur Docker « backend ».');
            return self::FAILURE;
        }

        $query = DocumentFiscal::query()->orderBy('id');
        if ($ids = $this->option('id')) $query->whereIn('id', $ids);
        elseif (!$this->option('force')) $query->whereNull('indexe_le');

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('Rien à indexer : tous les documents sont déjà indexés (utilisez --force pour recommencer).');
            return self::SUCCESS;
        }

        $this->info("Indexation de {$total} document(s)…");
        $bar = $this->output->createProgressBar($total);
        $ok = $scanned = 0;
        $failed = [];

        $query->chunkById(50, function ($docs) use ($search, $bar, &$ok, &$scanned, &$failed) {
            foreach ($docs as $doc) {
                try {
                    $letters = $search->index($doc);
                    $ok++;
                    if ($letters < DocumentationFiscaleSearch::SCANNED_THRESHOLD) $scanned++;
                } catch (Throwable $e) {
                    $failed[] = "#{$doc->id} {$doc->titre} : " . $e->getMessage();
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("Indexés : {$ok} (dont {$scanned} PDF scannés sans texte, trouvables seulement par leur titre).");
        if ($failed) {
            $this->warn('Échecs : ' . count($failed));
            foreach ($failed as $f) $this->line("  - {$f}");
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
