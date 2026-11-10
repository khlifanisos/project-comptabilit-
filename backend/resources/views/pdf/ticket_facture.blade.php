@php
    /*
     * "Note d'honoraire / Facture" in the cabinet's printed layout:
     * header (logo + qualités), N° / Date, "Doit" and "Adresse" boxes, a
     * Prestation table, a Débours table, the totals box (Mnt Remise → NET
     * Facture, with the retenue à la source) and the amount in words of the
     * net, then "Signature et Cachet" and the cabinet's footer (siège, MF, RIB).
     */
    $cab = config('cabinet');
    $n   = fn ($v) => number_format((float) $v, 3, ',', ' ');
    $pct = fn ($v) => number_format((float) $v, 2, ',', ' ') . ' %';
    $qte = fn ($v) => rtrim(rtrim(number_format((float) $v, 3, ',', ' '), '0'), ',');
    $img = fn (?string $path) => $path && is_file($path)
        ? 'data:' . (mime_content_type($path) ?: 'image/png') . ';base64,' . base64_encode(file_get_contents($path))
        : null;

    $logo   = $img($cab['logo'] ?? null);
    $cachet = $f->tampon ? $img($cab['cachet'] ?? null) : null;

    $titre = $f->isPrefacture() ? "PRÉFACTURE / NOTE D'HONORAIRE" : "NOTE D'HONORAIRE / FACTURE";

    // Honoraires (taxable lines) and débours (re-billed at cost) are two rubriques.
    $lignesHono    = collect($f->lignes)->reject(fn ($l) => $l['debours'] ?? false)->values();
    $lignesDebours = collect($f->lignes)->filter(fn ($l) => $l['debours'] ?? false)->values();
    $netLigne      = fn ($l) => $l['qt'] * $l['pu_ht'] * (1 - ($l['remise'] ?? 0) / 100);

    // Mnt Remise = line remises + remise accordée on the total.
    $remiseLignes = $lignesHono->sum(fn ($l) => $l['qt'] * $l['pu_ht'] * ($l['remise'] ?? 0) / 100);
    $totalRemise  = $remiseLignes + $f->remise_acc;

    // A TVA column only when the prestations mix several rates.
    $tauxUtilises = $lignesHono->pluck('tva')->unique();
    $colTva       = $tauxUtilises->count() > 1;
    $basesTva     = collect($f->bases_tva)->filter(fn ($b) => $b > 0);
    if ($basesTva->isEmpty()) {
        $basesTva = collect([(string) ($tauxUtilises->first() ?? 19) => 0]);
    }

    $tauxRetenue = \App\Http\Controllers\TicketFactureController::TAUX_RETENUE;

    // Doit / Adresse: the client's fiche when there is one, else what was typed on the invoice.
    $doitNom = $client?->raison_sociale ?: $f->client_nom;
    $idFiscal = $client?->matricule_fiscale;
    $adresse = $client?->adresse;

    // The amount in words is the net the client pays, as on the paper invoice.
    $enLettres = mb_strtoupper(\App\Support\MontantEnLettres::convertir($f->net_facture, $devise));
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
    @page { margin: 34px 44px 92px; }
    /* No universal reset: dompdf applies the @page margins to the root element. */
    body, div, table, th, td { margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9.5px; color: #334155; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: middle; }
    .r { text-align: right; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .soft { color: #64748B; }
    .lbl { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; color: #7A889A; }

    .logo-txt { font-size: 40px; font-weight: bold; letter-spacing: 3px; color: #2C4A68; line-height: 1; }
    .logo-sub { font-size: 7.5px; color: #7A889A; margin-top: 4px; }
    .activite { font-size: 14px; font-weight: bold; color: #2C4A68; letter-spacing: .5px; }
    .qualite { font-size: 9.5px; color: #4F7FA8; margin-top: 3px; }
    .rule { border-top: 2px solid #A9C4DC; margin: 16px 0 0; }

    .titre { font-size: 17px; letter-spacing: 2px; color: #4F7FA8; }
    .meta td { padding: 2px 0; font-size: 10px; }
    .box { border: 1px solid #D3DDE7; border-radius: 10px; background: #F7FAFD; padding: 10px 12px; height: 46px; text-align: center; }

    .grid { border: 1px solid #D3DDE7; }
    .grid th { background: #E6EEF6; color: #3F5B78; font-size: 7.5px; font-weight: normal; text-transform: uppercase;
               letter-spacing: .8px; padding: 7px 8px; border-bottom: 1px solid #D3DDE7; }
    .grid td { padding: 5px 8px; border-left: 1px solid #E1E8EF; border-bottom: 1px solid #E6ECF2; }
    .grid td:first-child { border-left: none; }

    .tot td { padding: 4px 10px; border-bottom: 1px solid #E6ECF2; }
    .tot td.lab { color: #64748B; width: 55%; }
    .tot td.val { text-align: right; color: #1E293B; }
    .tot tr.sep td { border-top: 1px solid #A9C4DC; }
    .tot tr.ret td { color: #B45309; }
    .tot tr.net td { background: #DCE8F3; color: #2C4A68; font-weight: bold; padding: 9px 10px; border-bottom: none; border-top: 1px solid #A9C4DC; }

    .stamp { border: 1px dashed #A9B8C8; border-radius: 10px; height: 74px; }
    .watermark { position: fixed; top: 360px; left: 60px; font-size: 90px; color: #4F7FA8; opacity: .10;
                 transform: rotate(-30deg); letter-spacing: 6px; }
    .footer { position: fixed; bottom: -64px; left: 0; right: 0; text-align: center; font-size: 7.5px; color: #7A889A;
              border-top: 1px solid #D3DDE7; padding-top: 7px; line-height: 1.5; }
</style>
</head>
<body>
@if ($f->duplicata)
    <div class="watermark">DUPLICATA</div>
@endif

{{-- ── En-tête du cabinet (masqué sur papier à en-tête) ─────────────── --}}
@if ($f->sans_en_tete)
    <div style="height: 120px;"></div>
@else
    <table>
        <tr>
            <td style="width: 40%; vertical-align: top;">
                @if ($logo)
                    <img src="{{ $logo }}" style="max-height: 80px; max-width: 190px;">
                @else
                    <div class="logo-txt">{{ $cab['sigle'] }}</div>
                    <div class="logo-sub">{{ ucfirst(mb_strtolower($cab['activite'])) }}</div>
                    @if ($cab['mention'])<div class="logo-sub" style="margin-top: 0;">{{ $cab['mention'] }}</div>@endif
                @endif
            </td>
            <td class="r" style="vertical-align: middle;">
                <div class="activite">{{ $cab['activite'] }}</div>
                @foreach ($cab['qualites'] as $q)
                    <div class="qualite">{{ $q }}</div>
                @endforeach
            </td>
        </tr>
    </table>
    <div class="rule"></div>
@endif

{{-- ── Titre, N°, date ──────────────────────────────────────────────── --}}
<table style="margin-top: 22px;">
    <tr>
        <td style="width: 62%; vertical-align: top;" class="titre">{{ $titre }}{{ $f->duplicata ? ' · DUPLICATA' : '' }}</td>
        <td style="vertical-align: top;">
            <table class="meta">
                <tr><td class="r soft">N°</td><td class="r b" style="width: 50%; color: #1E293B;">{{ $f->numero }}</td></tr>
                <tr><td class="r soft">Date</td><td class="r">{{ $f->date_facture->format('d/m/Y') }}</td></tr>
            </table>
        </td>
    </tr>
</table>

{{-- ── Doit / Adresse ───────────────────────────────────────────────── --}}
<table style="margin-top: 14px;">
    <tr>
        <td class="lbl" style="width: 50%; padding: 0 6px 5px 4px;">Doit</td>
        <td class="lbl" style="padding: 0 0 5px 10px;">Adresse</td>
    </tr>
    <tr>
        <td style="padding-right: 6px;">
            <div class="box">
                <div class="b" style="font-size: 12px; color: #1E293B;">{{ $doitNom }}</div>
                @if ($idFiscal)
                    <div class="soft" style="margin-top: 8px;">ID. Fiscal : {{ $idFiscal }}</div>
                @elseif ($f->client_code)
                    <div class="soft" style="margin-top: 8px;">Code client : {{ $f->client_code }}</div>
                @endif
            </div>
        </td>
        <td style="padding-left: 6px;">
            <div class="box"><div style="margin-top: 6px;">{{ $adresse ?: ' ' }}</div></div>
        </td>
    </tr>
</table>

@if ($f->observation || $f->exercice || $f->periode_debut)
    <div class="soft" style="margin-top: 10px;">
        @if ($f->observation)<span class="b" style="color: #3F5B78;">Objet :</span> {{ $f->observation }}@endif
        @if ($f->periode_debut) &nbsp;·&nbsp; Période du {{ $f->periode_debut->format('d/m/Y') }} au {{ $f->periode_fin->format('d/m/Y') }}@endif
        @if ($f->exercice) &nbsp;·&nbsp; Exercice {{ $f->exercice }}@endif
    </div>
@endif

{{-- ── Prestations (honoraires) ─────────────────────────────────────── --}}
<table class="grid" style="margin-top: 22px;">
    <thead>
        <tr>
            <th>Prestation</th>
            <th style="width: 82px;">P.U. H.T.</th>
            <th style="width: 58px;">Remise</th>
            @if ($colTva)<th style="width: 44px;">TVA</th>@endif
            <th style="width: 44px;">QT</th>
            <th style="width: 90px;">Mnt H.T</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($lignesHono as $l)
            <tr>
                <td>{{ $l['designation'] }}</td>
                <td class="r">{{ $n($l['pu_ht']) }}</td>
                <td class="r">{{ ($l['remise'] ?? 0) > 0 ? $pct($l['remise']) : '' }}</td>
                @if ($colTva)<td class="r">{{ $l['tva'] }} %</td>@endif
                <td class="r">{{ $qte($l['qt']) }}</td>
                <td class="r">{{ $n($netLigne($l)) }}</td>
            </tr>
        @empty
            <tr><td class="c" colspan="{{ $colTva ? 6 : 5 }}">&nbsp;</td></tr>
        @endforelse
    </tbody>
</table>

{{-- ── Débours (frais avancés pour le client, refacturés au coût, hors TVA) ── --}}
@if ($lignesDebours->isNotEmpty())
    <table class="grid" style="margin-top: 16px;">
        <thead>
            <tr>
                <th>Débours</th>
                <th style="width: 82px;">P.U.</th>
                <th style="width: 58px;"></th>
                @if ($colTva)<th style="width: 44px;"></th>@endif
                <th style="width: 44px;">QT</th>
                <th style="width: 90px;">Montant</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($lignesDebours as $l)
                <tr>
                    <td>{{ $l['designation'] }}</td>
                    <td class="r">{{ $n($l['pu_ht']) }}</td>
                    <td></td>
                    @if ($colTva)<td></td>@endif
                    <td class="r">{{ $qte($l['qt']) }}</td>
                    <td class="r">{{ $n($netLigne($l)) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

{{-- ── Totaux ───────────────────────────────────────────────────────── --}}
<table style="margin-top: 26px;">
    <tr>
        <td style="width: 48%; vertical-align: top; padding-right: 16px;">
            <div class="lbl">Mode de paiement</div>
            <div style="margin-top: 3px; color: #1E293B;">{{ $f->mode_paiement ?: '—' }}</div>

            <div class="lbl" style="margin-top: 22px;">Arrêtée la présente note d'honoraire / facture à la somme de</div>
            <div class="b" style="margin-top: 4px; color: #1E293B;">{{ $enLettres }}</div>
        </td>
        <td style="vertical-align: top;">
            <table class="tot">
                <tr><td class="lab">Mnt Remise</td><td class="val">{{ $totalRemise > 0 ? '− ' : '' }}{{ $n($totalRemise) }}</td></tr>
                <tr><td class="lab">Total H.T.</td><td class="val">{{ $n($f->montant_ht) }}</td></tr>
                @foreach ($basesTva as $taux => $base)
                    <tr><td class="lab">Total TVA [{{ $taux }}%]</td><td class="val">{{ $n($base * $taux / 100) }}</td></tr>
                @endforeach
                <tr><td class="lab">Timbre</td><td class="val">{{ $n($f->timbre) }}</td></tr>
                <tr><td class="lab">Total Débours</td><td class="val">{{ $n($f->montant_debours) }}</td></tr>
                <tr class="sep"><td class="lab b" style="color: #2C4A68;">Total TTC</td><td class="val b">{{ $n($f->montant_ttc) }}</td></tr>
                @if ($f->retenue_source)
                    <tr class="ret"><td class="lab" style="color: #B45309;">Retenue Source {{ $tauxRetenue }} %</td><td class="val" style="color: #B45309;">− {{ $n($f->montant_retenue) }}</td></tr>
                @endif
                <tr class="net"><td>NET Facture</td><td class="r">{{ $n($f->net_facture) }} {{ $devise }}</td></tr>
            </table>
        </td>
    </tr>
</table>

{{-- ── Signature et cachet ──────────────────────────────────────────── --}}
<table style="margin-top: 26px;">
    <tr>
        <td style="width: 52%;"></td>
        <td class="c">
            <div class="lbl" style="margin-bottom: 6px;">Signature et cachet</div>
            @if ($cachet)
                <img src="{{ $cachet }}" style="max-height: 100px; max-width: 240px;">
            @else
                <div class="stamp"></div>
            @endif
        </td>
    </tr>
</table>

@unless ($f->sans_en_tete)
    <div class="footer">
        Siège : {{ $cab['siege'] }}<br>
        MF : {{ $cab['mf'] }} &nbsp;Contact : {{ $cab['telephone'] }} - Email : {{ $cab['email'] }}<br>
        RIB : {{ $cab['rib'] }} {{ $cab['banque'] }}
    </div>
@endunless
</body>
</html>
