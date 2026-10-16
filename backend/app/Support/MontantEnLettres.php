<?php

namespace App\Support;

/**
 * Spells an invoice amount out in French for the "Arrêtée la présente facture
 * à la somme de …" line, e.g. 184.26 TND → "cent quatre-vingt-quatre dinars
 * et deux cent soixante millimes".
 */
class MontantEnLettres
{
    private const UNITES = [
        'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    ];

    private const DIZAINES = [2 => 'vingt', 3 => 'trente', 4 => 'quarante', 5 => 'cinquante', 6 => 'soixante'];

    /** [unité principale, sous-unité, nombre de décimales] par devise. */
    private const DEVISES = [
        'TND' => ['dinar', 'millime', 3],
        'DT'  => ['dinar', 'millime', 3],
        'MAD' => ['dirham', 'centime', 2],
        'EUR' => ['euro', 'centime', 2],
        'USD' => ['dollar', 'cent', 2],
    ];

    public static function convertir(float $montant, string $devise = 'TND'): string
    {
        [$unite, $sousUnite, $decimales] = self::DEVISES[strtoupper($devise)] ?? [strtolower($devise), 'centime', 2];

        $factor = 10 ** $decimales;
        $total  = (int) round(abs($montant) * $factor);
        $entier = intdiv($total, $factor);
        $reste  = $total % $factor;

        // "un million de dinars": round millions/milliards take "de" before the unit.
        $de    = $entier > 0 && $entier % 1_000_000 === 0 ? ' de ' : ' ';
        $texte = self::nombre($entier) . $de . $unite . ($entier > 1 ? 's' : '');
        if ($reste > 0) {
            $texte .= ' et ' . self::nombre($reste) . ' ' . $sousUnite . ($reste > 1 ? 's' : '');
        }

        return $texte;
    }

    public static function nombre(int $n): string
    {
        if ($n === 0) {
            return self::UNITES[0];
        }

        $parts = [];
        foreach ([[1_000_000_000, 'milliard'], [1_000_000, 'million']] as [$valeur, $nom]) {
            if ($n >= $valeur) {
                $q = intdiv($n, $valeur);
                $parts[] = self::moinsDeMille($q) . ' ' . $nom . ($q > 1 ? 's' : '');
                $n %= $valeur;
            }
        }
        if ($n >= 1000) {
            $q = intdiv($n, 1000);
            // "mille" is invariable, and "cent"/"vingt" lose their plural s before it.
            $parts[] = $q === 1 ? 'mille' : self::moinsDeMille($q, false) . ' mille';
            $n %= 1000;
        }
        if ($n > 0) {
            $parts[] = self::moinsDeMille($n);
        }

        return implode(' ', $parts);
    }

    private static function moinsDeMille(int $n, bool $pluriel = true): string
    {
        $centaines = intdiv($n, 100);
        $reste     = $n % 100;

        if ($centaines === 0) {
            return self::moinsDeCent($reste, $pluriel);
        }

        $txt = $centaines === 1 ? 'cent' : self::UNITES[$centaines] . ' cent';
        if ($reste === 0) {
            return $txt . ($centaines > 1 && $pluriel ? 's' : '');
        }

        return $txt . ' ' . self::moinsDeCent($reste, $pluriel);
    }

    private static function moinsDeCent(int $n, bool $pluriel = true): string
    {
        if ($n <= 16) {
            return self::UNITES[$n];
        }
        if ($n < 20) {
            return 'dix-' . self::UNITES[$n - 10];
        }

        $d = intdiv($n, 10);
        $u = $n % 10;

        // 70–79 and 90–99 are built on 60 + 10..19 and 80 + 10..19.
        if ($d === 7) {
            return $n === 71 ? 'soixante et onze' : 'soixante-' . self::moinsDeCent($n - 60);
        }
        if ($d === 9) {
            return 'quatre-vingt-' . self::moinsDeCent($n - 80);
        }
        if ($d === 8) {
            return $u === 0 ? 'quatre-vingt' . ($pluriel ? 's' : '') : 'quatre-vingt-' . self::UNITES[$u];
        }

        $dizaine = self::DIZAINES[$d];
        if ($u === 0) {
            return $dizaine;
        }

        return $dizaine . ($u === 1 ? ' et un' : '-' . self::UNITES[$u]);
    }
}
