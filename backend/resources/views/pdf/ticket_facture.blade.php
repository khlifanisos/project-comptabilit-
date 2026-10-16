@php
    $n = fn ($v) => number_format((float) $v, 3, ',', ' ');
    $pct = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, ',', ''), '0'), ',');
    $qte = fn ($v) => rtrim(rtrim(number_format((float) $v, 3, ',', ' '), '0'), ',');

    $statuts = ['en_instance' => 'En instance', 'facture' => 'Facturée', 'reg_client' => 'Réglée'];
    $societe = $f->societe ?: ($f->creator?->entreprise ?: $f->creator?->nom);

    $hasRemise      = collect($f->lignes)->contains(fn ($l) => ($l['remise'] ?? 0) > 0);
    $basesUtilisees = collect($f->bases_tva)->filter(fn ($b) => $b > 0);
    $nbCols         = $hasRemise ? 7 : 6;

    // The lines table is stretched with an empty filler row so the totals
    // land at the bottom of the A4 page, as on a classic printed invoice.
    // Optional blocks below the table (remise/débours rows, stamp) eat into that space.
    $hauteurLignes = ($f->sans_en_tete ? 470 : 555)
        - ($f->remise_acc > 0 ? 27 : 0)
        - ($f->montant_debours > 0 ? 27 : 0)
        - ($f->tampon ? 84 : 0);
    $filler        = max(30, $hauteurLignes - count($f->lignes) * 27);

    $enLettres = \App\Support\MontantEnLettres::convertir($f->net_facture, $devise);
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
    @page { margin: 40px 46px 56px; }
    /* No universal reset: dompdf applies the @page margins to the root element. */
    body, div, table, th, td { margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9.5px; color: #334155; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; }
    .r { text-align: right; }
    .c { text-align: center; }
    .soft { color: #64748B; }
    .lbl { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; color: #7A889A; margin-bottom: 4px; }

    .societe { font-size: 17px; font-weight: bold; color: #2C4A68; }
    .titre { font-size: 22px; letter-spacing: 3px; color: #4F7FA8; }
    .rule { border-top: 2px solid #A9C4DC; margin: 18px 0 20px; }

    .lines { border: 1px solid #D3DDE7; }
    .lines th { background: #E6EEF6; color: #3F5B78; font-size: 7.5px; font-weight: normal; text-transform: uppercase;
                letter-spacing: .8px; padding: 8px 8px; text-align: left; border-bottom: 1px solid #D3DDE7; }
    .lines th.r { text-align: right; }
    .lines th.c { text-align: center; }
    .lines td { padding: 7px 8px; height: 13px; border-left: 1px solid #E1E8EF; }
    .lines td:first-child { border-left: none; }
    .lines tr.row td { border-bottom: 1px solid #E6ECF2; }

    .tot td { padding: 5px 10px; }
    .net td { background: #DCE8F3; color: #2C4A68; font-weight: bold; padding: 9px 10px; border-top: 1px solid #A9C4DC; }

    .tva th { font-size: 7.5px; font-weight: normal; text-transform: uppercase; letter-spacing: .8px; color: #7A889A;
              padding: 4px 6px; text-align: right; border-bottom: 1px solid #D3DDE7; }
    .tva th:first-child, .tva td:first-child { text-align: left; }
    .tva td { padding: 4px 6px; text-align: right; }

    .stamp { border: 1px dashed #A9B8C8; height: 70px; text-align: center; color: #8A97A8; font-size: 8px; padding-top: 6px; }
    .watermark { position: fixed; top: 360px; left: 60px; font-size: 90px; color: #4F7FA8; opacity: .10;
                 transform: rotate(-30deg); letter-spacing: 6px; }
    .footer { position: fixed; bottom: 22px; left: 0; right: 0; text-align: center; font-size: 7.5px; color: #8A97A8; }
</style>
</head>
<body>
@if ($f->duplicata)
    <div class="watermark">DUPLICATA</div>
@endif

{{-- ── En-tête ──────────────────────────────────────────────────────── --}}
@if ($f->sans_en_tete)
    <div style="height: 90px;"></div>
@endif
<table>
    <tr>
        <td style="width: 55%;">
            @unless ($f->sans_en_tete)
                <div class="societe">{{ $societe }}</div>
                <div class="soft" style="margin-top: 3px;">Cabinet d'expertise comptable</div>
                @if ($f->creator?->email)<div class="soft">{{ $f->creator->email }}</div>@endif
            @endunless
        </td>
        <td class="r">
            <div class="titre">FACTURE{{ $f->duplicata ? ' · DUPLICATA' : '' }}</div>
            <table style="margin-top: 8px;">
                <tr><td class="r soft" style="width: 70%;">N°</td><td class="r" style="padding-left: 10px;"><b>{{ $f->numero }}</b></td></tr>
                <tr><td class="r soft">Date</td><td class="r">{{ $f->date_facture->format('d/m/Y') }}</td></tr>
                @if ($f->exercice)
                    <tr><td class="r soft">Exercice</td><td class="r">{{ $f->exercice }}</td></tr>
                @endif
                <tr><td class="r soft">Statut</td><td class="r">{{ $statuts[$f->statut] ?? $f->statut }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="rule"></div>

{{-- ── Client / objet ───────────────────────────────────────────────── --}}
<table>
    <tr>
        <td style="width: 50%; padding-right: 20px;">
            <div class="lbl">Facturé à</div>
            <div style="font-size: 12px; font-weight: bold; color: #1E293B;">{{ $f->client_nom }}</div>
            @if ($f->client_code)<div class="soft" style="margin-top: 2px;">Code client : {{ $f->client_code }}</div>@endif
            @if ($client?->adresse)<div>{{ $client->adresse }}</div>@endif
            @if ($client?->email)<div class="soft">{{ $client->email }}</div>@endif
        </td>
        <td style="width: 50%;">
            <div class="lbl">Objet</div>
            <div>{{ $f->observation ?: $ticket->titre }}</div>
            <div class="soft" style="margin-top: 2px;">Réf. ticket #{{ $ticket->id }}</div>
        </td>
    </tr>
</table>

{{-- ── Lignes ───────────────────────────────────────────────────────── --}}
<table class="lines" style="margin-top: 22px;">
    <thead>
        <tr>
            <th class="c" style="width: 24px;">N°</th>
            <th>Désignation</th>
            <th class="r" style="width: 40px;">Qté</th>
            <th class="r" style="width: 74px;">PU HT</th>
            <th class="r" style="width: 40px;">TVA</th>
            @if ($hasRemise)<th class="r" style="width: 46px;">Remise</th>@endif
            <th class="r" style="width: 86px;">Total HT</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($f->lignes as $i => $l)
            @php $net = $l['qt'] * $l['pu_ht'] * (1 - ($l['remise'] ?? 0) / 100); @endphp
            <tr class="row">
                <td class="c soft">{{ $i + 1 }}</td>
                <td>{{ $l['designation'] }}@if ($l['debours'])<span class="soft"> (débours)</span>@endif</td>
                <td class="r">{{ $qte($l['qt']) }}</td>
                <td class="r">{{ $n($l['pu_ht']) }}</td>
                <td class="r">{{ $l['debours'] ? '—' : $l['tva'] . ' %' }}</td>
                @if ($hasRemise)<td class="r">{{ ($l['remise'] ?? 0) > 0 ? $pct($l['remise']) . ' %' : '' }}</td>@endif
                <td class="r">{{ $n($net) }}</td>
            </tr>
        @endforeach
        <tr>
            @for ($c = 0; $c < $nbCols; $c++)
                <td style="height: {{ $filler }}px;"></td>
            @endfor
        </tr>
    </tbody>
</table>

{{-- ── Totaux ───────────────────────────────────────────────────────── --}}
<table style="margin-top: 18px;">
    <tr>
        <td style="width: 52%; padding-right: 26px;">
            @if ($basesUtilisees->isNotEmpty())
                <table class="tva">
                    <tr><th>TVA</th><th>Base HT</th><th>Montant</th></tr>
                    @foreach ($basesUtilisees as $taux => $base)
                        <tr>
                            <td>{{ $taux == 0 ? 'Exonéré' : $taux . ' %' }}</td>
                            <td>{{ $n($base) }}</td>
                            <td>{{ $n($base * $taux / 100) }}</td>
                        </tr>
                    @endforeach
                </table>
            @endif

            <div style="margin-top: 14px;">
                <div class="lbl">Arrêtée la présente facture à la somme de</div>
                <div style="color: #1E293B;">{{ ucfirst($enLettres) }}</div>
            </div>

            @if ($f->mode_paiement)
                <div style="margin-top: 10px;"><span class="soft">Mode de paiement :</span> {{ $f->mode_paiement }}</div>
            @endif
        </td>
        <td style="width: 48%;">
            <table class="tot">
                <tr><td class="soft">Montant brut</td><td class="r">{{ $n($f->montant_brut) }}</td></tr>
                @if ($f->remise_acc > 0)
                    <tr><td class="soft">Remise ({{ $pct($f->remise_acc_taux) }} %)</td><td class="r">− {{ $n($f->remise_acc) }}</td></tr>
                @endif
                <tr><td class="soft">Total HT</td><td class="r">{{ $n($f->montant_ht) }}</td></tr>
                <tr><td class="soft">TVA</td><td class="r">{{ $n($f->montant_tva) }}</td></tr>
                @if ($f->montant_debours > 0)
                    <tr><td class="soft">Débours</td><td class="r">{{ $n($f->montant_debours) }}</td></tr>
                @endif
                <tr><td class="soft">Timbre fiscal</td><td class="r">{{ $n($f->timbre) }}</td></tr>
                <tr class="net"><td>Net à payer</td><td class="r">{{ $n($f->net_facture) }} {{ $devise }}</td></tr>
            </table>

            @if ($f->tampon)
                <div class="stamp" style="margin-top: 14px;">Cachet et signature</div>
            @endif
        </td>
    </tr>
</table>

<div class="footer">{{ $societe }} — Facture {{ $f->numero }} — Merci pour votre confiance</div>
</body>
</html>
