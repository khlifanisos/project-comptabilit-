<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;

/** Keeps the first $maxRow rows and/or only the given column letters. */
class LegacyReadFilter implements IReadFilter
{
    public function __construct(private ?int $maxRow = null, private ?array $columns = null) {}

    public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
    {
        return ($this->maxRow === null || $row <= $this->maxRow)
            && ($this->columns === null || in_array($columnAddress, $this->columns, true));
    }
}
