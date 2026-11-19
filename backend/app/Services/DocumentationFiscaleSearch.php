<?php

namespace App\Services;

use App\Models\DocumentFiscal;
use App\Models\DocumentFiscalChunk;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Gives the chatbot access to the documentation fiscale:
 *  - index(): extracts the text of a PDF (pdftotext) and stores it as full-text indexed passages;
 *  - search(): finds the passages that best match a question.
 */
class DocumentationFiscaleSearch
{
    private const DISK = 'local';
    private const CHUNK_CHARS   = 1500;
    private const CHUNK_OVERLAP = 200;

    /** Below this many extracted letters a PDF is treated as scanned (image only). */
    public const SCANNED_THRESHOLD = 300;

    public static function available(): bool
    {
        try {
            $r = Process::run(['pdftotext', '-v']); // prints "pdftotext version x.y" (exit code varies by version)
            return str_contains($r->output() . $r->errorOutput(), 'pdftotext version');
        } catch (\Throwable) {
            return false;
        }
    }

    /** (Re)builds the passages of one document. Returns the number of characters extracted. */
    public function index(DocumentFiscal $doc): int
    {
        $path = Storage::disk(self::DISK)->path($doc->fichier);
        if (!is_file($path)) {
            throw new RuntimeException("Fichier introuvable : {$doc->fichier}");
        }

        $result = Process::timeout(180)->run(['pdftotext', '-enc', 'UTF-8', '-q', $path, '-']);
        if (!$result->successful()) {
            throw new RuntimeException('pdftotext a échoué : ' . trim($result->errorOutput()));
        }

        $pages = explode("\f", $result->output());
        $rows  = [];
        $letters = 0;

        foreach ($pages as $i => $raw) {
            $text = $this->clean($raw);
            if ($text === '') continue;
            $letters += preg_match_all('/\pL/u', $text);
            foreach ($this->split($text) as $piece) {
                $rows[] = ['page' => $i + 1, 'contenu' => $piece];
            }
        }

        // Scanned PDFs have no usable text: keep only the description card
        if ($letters < self::SCANNED_THRESHOLD) {
            $rows = [];
        }

        $titre = mb_substr($doc->titre, 0, 400);
        array_unshift($rows, ['page' => 0, 'contenu' => $this->card($doc)]);

        DB::transaction(function () use ($doc, $rows, $titre, $letters) {
            DocumentFiscalChunk::where('document_fiscal_id', $doc->id)->delete();
            foreach (array_chunk($rows, 200) as $batch) {
                DocumentFiscalChunk::insert(array_map(fn ($r) => $r + [
                    'document_fiscal_id' => $doc->id,
                    'titre' => $titre,
                ], $batch));
            }
            $doc->forceFill(['nb_caracteres' => $letters, 'indexe_le' => now()])->saveQuietly();
        });
        Cache::forget('docfiscal:titles'); // titles may have changed

        return $letters;
    }

    /**
     * Best passages for a question, grouped by document (best document first).
     *
     * @return array<int, array{doc: DocumentFiscal, score: float, passages: array<int, array{page:int, contenu:string}>}>
     */
    public function search(string $question, int $maxPassages = 8, int $maxChars = 18000): array
    {
        $query = $this->toQuery($question);
        if ($query === '' || DB::getDriverName() !== 'mysql') return [];

        $rows = DB::table('document_fiscal_chunks')
            ->select('id', 'document_fiscal_id', 'page', 'contenu')
            ->selectRaw('MATCH(titre, contenu) AGAINST (? IN NATURAL LANGUAGE MODE) AS score', [$query])
            ->whereRaw('MATCH(titre, contenu) AGAINST (? IN NATURAL LANGUAGE MODE)', [$query])
            ->orderByDesc('score')
            ->limit(60)
            ->get();

        $docs = DocumentFiscal::whereIn('id', $rows->pluck('document_fiscal_id')->unique())->get()->keyBy('id');

        // A year in the question ("loi de finances 2026") strongly favours documents of that year
        preg_match_all('/\b(19[5-9]\d|20\d\d)\b/', $question, $m);
        $years = array_map('intval', $m[1]);

        $scored = $rows->map(function ($r) use ($docs, $years) {
            $doc = $docs[$r->document_fiscal_id] ?? null;
            $score = (float) $r->score;
            if ($doc && $years && ($doc->annee && in_array($doc->annee, $years, true)
                    || array_filter($years, fn ($y) => str_contains($doc->titre, (string) $y)))) {
                $score *= 2;
            }
            // The description card matching means the question names this document (title, type, year)
            if ((int) $r->page === 0) $score *= 1.5;
            return (object) ['doc' => $doc, 'page' => (int) $r->page, 'contenu' => $r->contenu, 'score' => $score];
        })->filter(fn ($r) => $r->doc !== null)->sortByDesc('score')->values();

        // Documents named in the question come first, with their most relevant passages
        $groups = [];
        $perDoc = [];
        $count = 0;
        $chars = 0;
        foreach ($this->titleHits($question) as $doc) {
            $passages = $this->passagesOf($doc, $query);
            $groups[$doc->id] = ['doc' => $doc, 'score' => INF, 'passages' => $passages];
            $perDoc[$doc->id] = 3;
            $count += count($passages);
            $chars += array_sum(array_map(fn ($p) => mb_strlen($p['contenu']), $passages));
        }
        $maxPassages += $count; // title hits do not eat the budget of the general search

        foreach ($scored as $r) {
            $id = $r->doc->id;
            if (($perDoc[$id] ?? 0) >= 3) continue;
            $len = mb_strlen($r->contenu);
            if ($count >= $maxPassages || $chars + $len > $maxChars) break;
            $groups[$id] ??= ['doc' => $r->doc, 'score' => $r->score, 'passages' => []];
            $groups[$id]['passages'][] = ['page' => $r->page, 'contenu' => $r->contenu];
            $perDoc[$id] = ($perDoc[$id] ?? 0) + 1;
            $count++;
            $chars += $len;
        }

        // Document found only by its title (e.g. a text in Arabic for a French question):
        // add its first passages so the assistant can read the actual text
        foreach ($groups as $id => &$g) {
            $pages = array_column($g['passages'], 'page');
            if (array_filter($pages) || ($g['doc']->nb_caracteres ?? 0) < self::SCANNED_THRESHOLD) continue;
            $first = DocumentFiscalChunk::where('document_fiscal_id', $id)->where('page', '>', 0)
                ->orderBy('page')->orderBy('id')->limit(3)->get(['page', 'contenu']);
            foreach ($first as $c) {
                $g['passages'][] = ['page' => $c->page, 'contenu' => $c->contenu];
            }
        }
        unset($g);

        return array_values($groups);
    }

    /**
     * Documents the question names explicitly:
     *  - a title (almost) fully contained in it: "la loi des finances 2026" → « Loi des Finances 2026 »;
     *  - a note commune by number (and year): "note commune 9 de 2026";
     *  - a convention by country: "convention avec la France".
     *
     * @return DocumentFiscal[]
     */
    private function titleHits(string $question): array
    {
        $qTokens = $this->tokens($question);
        $q = array_flip($qTokens);
        preg_match_all('/\b(19[5-9]\d|20\d\d)\b/', $question, $m);
        $years = array_map('intval', $m[1]);
        $noteNumber = preg_match('/notes?\s*communes?\s*(?:n\s*°?|num[eé]ro|no\.?)?\s*(\d{1,3})\b/iu', $question, $nm)
            ? (int) $nm[1] : null;

        $index = Cache::remember('docfiscal:titles', 600, fn () => DocumentFiscal::query()
            ->get(['id', 'titre', 'categorie', 'sous_categorie', 'annee'])
            ->mapWithKeys(fn ($d) => [$d->id => [
                't' => $this->tokens($d->titre),
                'c' => $d->categorie,
                's' => $d->sous_categorie ? $this->tokens($d->sous_categorie) : [],
                'a' => $d->annee,
                'n' => preg_match('/note\s*commune\s*(?:n\s*°?|num[eé]ro)?\s*(\d{1,3})/iu', $d->titre, $x) ? (int) $x[1] : null,
            ]])->all());

        $hits = [];
        foreach ($index as $id => $d) {
            $score = 0;
            if ($noteNumber !== null && $d['c'] === 'notes_communes' && $d['n'] === $noteNumber) {
                if ($years && !in_array($d['a'], $years, true)) continue;
                $score = 3 + ($d['a'] ?? 0) / 10000; // most recent first when no year is given
            } elseif ($d['c'] === 'conventions' && $d['s'] && !array_diff($d['s'], $qTokens)) {
                $score = 2.5;
            } elseif (count($d['t']) >= 2 && count($d['t']) <= 12) {
                $common = count(array_filter($d['t'], fn ($t) => isset($q[$t])));
                $coverage = $common / count($d['t']);
                if ($common >= 2 && $coverage >= 0.75) $score = 1 + $coverage;
            }
            if ($score > 0) $hits[$id] = $score;
        }
        arsort($hits);

        $ids = array_slice(array_keys($hits), 0, 2);
        if (!$ids) return [];
        $docs = DocumentFiscal::whereIn('id', $ids)->get()->keyBy('id');
        return array_values(array_filter(array_map(fn ($id) => $docs[$id] ?? null, $ids)));
    }

    /** Passages of one document matching the question, or its first pages when none match. */
    private function passagesOf(DocumentFiscal $doc, string $query): array
    {
        $rows = DB::table('document_fiscal_chunks')
            ->where('document_fiscal_id', $doc->id)->where('page', '>', 0)
            ->whereRaw('MATCH(titre, contenu) AGAINST (? IN NATURAL LANGUAGE MODE)', [$query])
            ->orderByRaw('MATCH(titre, contenu) AGAINST (? IN NATURAL LANGUAGE MODE) DESC', [$query])
            ->limit(3)->get(['page', 'contenu']);
        if ($rows->isEmpty()) {
            $rows = DocumentFiscalChunk::where('document_fiscal_id', $doc->id)
                ->orderBy('page')->orderBy('id')->limit(3)->get(['page', 'contenu']);
        }
        return $rows->map(fn ($r) => ['page' => (int) $r->page, 'contenu' => $r->contenu])->all();
    }

    /** Lower-case, accent-free words; numbers without leading zeros ("N°09" → "n", "9"). */
    private function tokens(string $text): array
    {
        $ascii = mb_strtolower(Str::ascii($text));
        preg_match_all('/[a-z]+|\d+/', $ascii, $m);
        return array_values(array_unique(array_map(fn ($t) => ctype_digit($t) ? (ltrim($t, '0') ?: '0') : $t, $m[0])));
    }

    /** Short text describing the document, so it can be found by its title, type and year. */
    private function card(DocumentFiscal $doc): string
    {
        return trim(implode('. ', array_filter([
            DocumentFiscal::CATEGORIE_LABELS[$doc->categorie] ?? $doc->categorie,
            $doc->titre,
            $doc->annee ? "Année {$doc->annee}" : null,
            $doc->sous_categorie,
            $doc->description,
        ])));
    }

    private function clean(string $text): string
    {
        $text = preg_replace('/(\pL)-\n(\pL)/u', '$1$2', $text) ?? $text; // re-join hyphenated words
        $text = preg_replace('/[^\S\n]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\n{2,}/', "\n", $text) ?? $text;
        return trim($text);
    }

    /** Cuts a page into overlapping passages, breaking on whitespace. */
    private function split(string $text): array
    {
        $out = [];
        $len = mb_strlen($text);
        $start = 0;
        while ($start < $len) {
            $piece = mb_substr($text, $start, self::CHUNK_CHARS);
            $last = $start + self::CHUNK_CHARS >= $len;
            if (!$last) {
                $cut = max(mb_strrpos($piece, "\n") ?: 0, mb_strrpos($piece, ' ') ?: 0);
                if ($cut > self::CHUNK_CHARS * 0.6) $piece = mb_substr($piece, 0, $cut);
            }
            $piece = trim($piece);
            if (mb_strlen($piece) > 40) $out[] = $piece;
            if ($last) break;
            $step = max(mb_strlen($piece) - self::CHUNK_OVERLAP, 200);
            $start += $step;
        }
        return $out;
    }

    /** Keeps only words: full-text operators and punctuation removed. */
    private function toQuery(string $question): string
    {
        $q = preg_replace('/[^\pL\pN]+/u', ' ', mb_strtolower($question)) ?? '';
        return trim(preg_replace('/\s+/', ' ', $q) ?? '');
    }
}
