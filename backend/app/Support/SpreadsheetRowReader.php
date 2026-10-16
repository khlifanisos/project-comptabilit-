<?php

namespace App\Support;

use Generator;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;
use XMLReader;
use ZipArchive;

/**
 * Streams the rows of an uploaded balance / grand livre as plain arrays
 * (0-based column index => cell value), one row at a time.
 *
 * PhpSpreadsheet loads a whole workbook into memory — a 14 MB grand livre
 * (≈300 000 lines) took 90 s and 1.5 GB — so .xlsx files are read straight
 * from their XML with XMLReader, and CSV with fgetcsv. Only legacy .xls
 * files still go through PhpSpreadsheet (read-data-only).
 *
 * For .xlsx the sheet read is the one that was active when the file was
 * saved, like PhpSpreadsheet's getActiveSheet(). Formula cells yield their
 * cached result; numbers are yielded as their raw text ("1010010300",
 * "-826889.803") so long account numbers never go through a float.
 */
class SpreadsheetRowReader
{
    private const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const NS_REL  = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    /**
     * @param callable|null $keepColumns fn(array $headerRow): int[] — 0-based columns
     *        actually needed. Only used for legacy .xls, where loading every
     *        column of a large grand livre is what costs time and memory.
     */
    public static function rows(string $path, ?callable $keepColumns = null): Generator
    {
        $handle = fopen($path, 'rb');
        $magic  = $handle ? fread($handle, 4) : '';
        if ($handle) fclose($handle);

        if (str_starts_with($magic, "PK\x03\x04")) {
            return self::xlsxRows($path);
        }
        if (str_starts_with($magic, "\xD0\xCF\x11\xE0")) {
            return self::legacyRows($path, $keepColumns);
        }
        return self::csvRows($path);
    }

    private static function xlsxRows(string $path): Generator
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('Fichier Excel illisible.');
        }

        $sheetPath = self::activeSheetPath($zip);
        $shared    = self::sharedStrings($zip);
        $zip->close();

        $reader = new XMLReader();
        if (!$reader->open('zip://' . $path . '#' . $sheetPath)) {
            throw new RuntimeException('Feuille introuvable dans le fichier Excel.');
        }

        try {
            // Position on the first <row>, then hop from row to row with next('row'),
            // which skips each row's subtree once we've expanded it.
            while ($reader->read() && !($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'row')) {
            }
            for ($ok = $reader->localName === 'row'; $ok; $ok = $reader->next('row')) {
                $row = $reader->expand();
                if (!$row) continue;

                $cells = [];
                $next  = 0;
                foreach ($row->childNodes as $c) {
                    if ($c->nodeType !== XML_ELEMENT_NODE || $c->localName !== 'c') continue;

                    $ref = $c->getAttribute('r');
                    $col = $ref !== '' ? self::columnIndex($ref) : $next;
                    $next = $col + 1;
                    $cells[$col] = self::cellValue($c, $shared);
                }

                if ($cells) {
                    $max = max(array_keys($cells));
                    yield array_replace(array_fill(0, $max + 1, null), $cells);
                } else {
                    yield [];
                }
            }
        } finally {
            $reader->close();
        }
    }

    /** Path inside the zip of the sheet that was active when the workbook was saved. */
    private static function activeSheetPath(ZipArchive $zip): string
    {
        $workbook = simplexml_load_string((string) $zip->getFromName('xl/workbook.xml'));
        $rels     = simplexml_load_string((string) $zip->getFromName('xl/_rels/workbook.xml.rels'));
        if (!$workbook || !$rels) {
            throw new RuntimeException('Structure du fichier Excel invalide.');
        }

        $main  = $workbook->children(self::NS_MAIN);
        $view  = $main->bookViews->workbookView ?? null;
        $active = $view ? (int) ($view->attributes()['activeTab'] ?? 0) : 0;

        $sheets = [];
        foreach ($main->sheets->sheet as $sheet) {
            $sheets[] = (string) $sheet->attributes(self::NS_REL)['id'];
        }
        $rid = $sheets[$active] ?? $sheets[0] ?? null;

        foreach ($rels->Relationship as $rel) {
            if ((string) $rel['Id'] === $rid) {
                $target = ltrim((string) $rel['Target'], '/');
                return str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
            }
        }

        throw new RuntimeException('Feuille introuvable dans le fichier Excel.');
    }

    /** @return string[] shared string table, by index */
    private static function sharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getStream('xl/sharedStrings.xml');
        if (!$xml) return [];
        fclose($xml);

        $strings = [];
        $reader = new XMLReader();
        $reader->open('zip://' . $zip->filename . '#xl/sharedStrings.xml');
        while ($reader->read() && !($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'si')) {
        }
        for ($ok = $reader->localName === 'si'; $ok; $ok = $reader->next('si')) {
            $si = $reader->expand();
            $strings[] = $si ? self::text($si) : '';
        }
        $reader->close();

        return $strings;
    }

    private static function cellValue(\DOMElement $c, array $shared): mixed
    {
        $type = $c->getAttribute('t');

        if ($type === 'inlineStr') {
            foreach ($c->childNodes as $n) {
                if ($n->localName === 'is') return self::text($n);
            }
            return null;
        }

        $v = null;
        foreach ($c->childNodes as $n) {
            if ($n->localName === 'v') { $v = $n->textContent; break; }
        }
        if ($v === null) return null;

        return match ($type) {
            's'     => $shared[(int) $v] ?? '',
            'b'     => $v === '1',
            default => $v, // numbers, formula strings ('str') and errors ('e') as raw text
        };
    }

    /** Text of an <si>/<is> node: every <t>, ignoring phonetic runs (<rPh>). */
    private static function text(\DOMNode $node): string
    {
        $out = '';
        foreach ($node->childNodes as $n) {
            if ($n->localName === 't') {
                $out .= $n->textContent;
            } elseif ($n->localName === 'r') {
                $out .= self::text($n);
            }
        }
        return $out;
    }

    /** "AB12" → 27 (0-based). */
    private static function columnIndex(string $ref): int
    {
        $letters = strtoupper(preg_replace('/\d+/', '', $ref));
        $index = 0;
        foreach (str_split($letters) as $ch) {
            $index = $index * 26 + (ord($ch) - 64);
        }
        return $index - 1;
    }

    private static function csvRows(string $path): Generator
    {
        $handle = fopen($path, 'rb');
        if (!$handle) {
            throw new RuntimeException('Fichier CSV illisible.');
        }

        try {
            $first = (string) fgets($handle);
            $first = preg_replace('/^\xEF\xBB\xBF/', '', $first); // UTF-8 BOM
            $delimiter = self::guessDelimiter($first);
            rewind($handle);
            if (str_starts_with((string) fread($handle, 3), "\xEF\xBB\xBF") === false) {
                rewind($handle);
            }

            while (($line = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
                if ($line === [null]) { yield []; continue; }
                // Exports from Excel FR are often Windows-1252, not UTF-8.
                yield array_map(
                    fn ($v) => $v !== null && !mb_check_encoding($v, 'UTF-8') ? mb_convert_encoding($v, 'UTF-8', 'Windows-1252') : $v,
                    $line
                );
            }
        } finally {
            fclose($handle);
        }
    }

    private static function guessDelimiter(string $line): string
    {
        $counts = [';' => substr_count($line, ';'), ',' => substr_count($line, ','), "\t" => substr_count($line, "\t")];
        arsort($counts);
        return array_key_first($counts);
    }

    private static function legacyRows(string $path, ?callable $keepColumns): Generator
    {
        // A 14 MB grand livre needs ~85 MB even column-filtered; give the import room.
        if (self::bytes((string) ini_get('memory_limit')) < 512 * 1048576) {
            ini_set('memory_limit', '512M');
        }

        // Pass 1: header row only, to know which columns matter.
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter(new LegacyReadFilter(maxRow: 1));
        $sheet  = $reader->load($path)->getActiveSheet();
        $lastCol = $sheet->getHighestColumn();
        $header = $sheet->rangeToArray("A1:{$lastCol}1", null, true, false, false)[0];
        $sheet->getParent()->disconnectWorksheets();
        unset($sheet);

        yield $header;

        $keep = $keepColumns ? $keepColumns($header) : array_keys($header);
        if (!$keep) {
            return;
        }

        // Pass 2: only the kept columns, from row 2.
        $letters = array_map(fn ($i) => Coordinate::stringFromColumnIndex($i + 1), $keep);
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter(new LegacyReadFilter(columns: $letters));
        $sheet = $reader->load($path)->getActiveSheet();

        $lastRow = $sheet->getHighestRow();
        $lastCol = Coordinate::stringFromColumnIndex(max($keep) + 1);
        for ($start = 2; $start <= $lastRow; $start += 1000) {
            $end = min($lastRow, $start + 999);
            foreach ($sheet->rangeToArray("A{$start}:{$lastCol}{$end}", null, true, false, false) as $row) {
                yield $row;
            }
        }
        $sheet->getParent()->disconnectWorksheets();
    }

    /** "512M" → bytes; -1 (unlimited) → PHP_INT_MAX. */
    private static function bytes(string $limit): int
    {
        if ($limit === '-1') return PHP_INT_MAX;
        $n = (int) $limit;
        return match (strtolower(substr($limit, -1))) {
            'g' => $n * 1073741824,
            'm' => $n * 1048576,
            'k' => $n * 1024,
            default => $n,
        };
    }
}
