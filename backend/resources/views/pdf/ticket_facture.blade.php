@php
    $n = fn ($v) => number_format((float) $v, 3, ',', ' ');
    $statuts = ['en_instance' => 'En instance', 'facture' => 'Facturée', 'reg_client' => 'Réglée par le client'];
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
    @page { margin: 28px 34px; }
    * { margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; color: #1A202C; }
    table { border-collapse: collapse; width: 100%; }
    .hdr td { vertical-align: top; }
    .societe { font-size: 17px; font-weight: bold; color: #1F4E78; }
    .muted { color: #64748B; }
    .title { font-size: 20px; font-weight: bold; color: #1F4E78; text-align: right; letter-spacing: 1px; }
    .meta td { padding: 2px 0; }
    .box { border: 1px solid #CBD5E1; padding: 8px 10px; }
    .box-title { font-size: 8.5px; text-transform: uppercase; color: #64748B; letter-spacing: .5px; margin-bottom: 3px; }
    .lines th { background: #1F4E78; color: #fff; font-size: 9px; padding: 6px 5px; text-align: left; }
    .lines th.r { text-align: right; }
    .lines th.c { text-align: center; }
    .lines td { border-bottom: 1px solid #E2E8F0; padding: 5px; }
    .lines tr:nth-child(even) td { background: #F4F8FC; }
    .r { text-align: right; }
    .c { text-align: center; }
    .tot td { padding: 4px 8px; border: 1px solid #E2E8F0; }
    .tot .lbl { background: #F4F8FC; color: #334155; }
    .net td { background: #1F4E78; color: #fff; font-weight: bold; font-size: 12px; }
    .watermark { position: fixed; top: 330px; left: 70px; font-size: 90px; color: #C62828; opacity: .10;
                 transform: rotate(-30deg); font-weight: bold; }
    .tampon { border: 2px dashed #94A3B8; height: 80px; width: 200px; text-align: center; color: #94A3B8;
              padding-top: 32px; font-size: 9px; }
</style>
</head>
<body>
@if ($f->duplicata)
    <div class="watermark">DUPLICATA</div>
@endif

@unless ($f->sans_en_tete)
<table class="hdr" style="margin-bottom: 14px;">
    <tr>
        <td style="width: 55%;">
            <div class="societe">{{ $f->societe ?: '—' }}</div>
            <div class="muted" style="margin-top: 3px;">Cabinet d'expertise comptable</div>
        </td>
        <td>
            <div class="title">FACTURE{{ $f->duplicata ? ' — DUPLICATA' : '' }}</div>
            <table class="meta" style="margin-top: 6px;">
                <tr><td class="muted r" style="width: 60%;">N° :</td><td class="r"><b>{{ $f->numero }}</b></td></tr>
                <tr><td class="muted r">Date :</td><td class="r">{{ $f->date_facture->format('d/m/Y') }}</td></tr>
                @if ($f->exercice)
                <tr><td class="muted r">Exercice :</td><td class="r">{{ $f->exercice }}</td></tr>
                @endif
                <tr><td class="muted r">Statut :</td><td class="r">{{ $statuts[$f->statut] ?? $f->statut }}</td></tr>
            </table>
        </td>
    </tr>
</table>
@else
<table class="meta" style="margin-bottom: 14px; width: 45%; margin-left: 55%;">
    <tr><td class="muted r" style="width: 60%;">Facture N° :</td><td class="r"><b>{{ $f->numero }}</b></td></tr>
    <tr><td class="muted r">Date :</td><td class="r">{{ $f->date_facture->format('d/m/Y') }}</td></tr>
</table>
@endunless

<table style="margin-bottom: 14px;">
    <tr>
        <td style="width: 50%; padding-right: 8px;">
            <div class="box">
                <div class="box-title">Client</div>
                <div style="font-size: 12px; font-weight: bold;">{{ $f->client_nom }}</div>
                @if ($f->client_code)<div class="muted">Code client : {{ $f->client_code }}</div>@endif
                @if ($client?->adresse)<div>{{ $client->adresse }}</div>@endif
                @if ($client?->email)<div class="muted">{{ $client->email }}</div>@endif
            </div>
        </td>
        <td style="width: 50%; padding-left: 8px;">
            <div class="box">
                <div class="box-title">Objet</div>
                <div>{{ $f->observation ?: $ticket->titre }}</div>
                <div class="muted" style="margin-top: 3px;">Réf. ticket #{{ $ticket->id }}</div>
            </div>
        </td>
    </tr>
</table>

<table class="lines">
    <thead>
        <tr>
            <th class="c" style="width: 26px;">N°</th>
            <th>Désignation</th>
            <th class="c" style="width: 34px;">Déb.</th>
            <th class="r" style="width: 40px;">QT</th>
            <th class="r" style="width: 70px;">PU HT</th>
            <th class="r" style="width: 38px;">TVA</th>
            <th class="r" style="width: 46px;">Remise</th>
            <th class="r" style="width: 82px;">Total Net HT</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($f->lignes as $i => $l)
            @php $net = $l['qt'] * $l['pu_ht'] * (1 - ($l['remise'] ?? 0) / 100); @endphp
            <tr>
                <td class="c">{{ $i + 1 }}</td>
                <td>{{ $l['designation'] }}</td>
                <td class="c">{{ $l['debours'] ? 'Oui' : '' }}</td>
                <td class="r">{{ rtrim(rtrim(number_format($l['qt'], 3, ',', ' '), '0'), ',') }}</td>
                <td class="r">{{ $n($l['pu_ht']) }}</td>
                <td class="r">{{ $l['debours'] ? '—' : $l['tva'] . ' %' }}</td>
                <td class="r">{{ ($l['remise'] ?? 0) > 0 ? rtrim(rtrim(number_format($l['remise'], 2, ',', ''), '0'), ',') . ' %' : '' }}</td>
                <td class="r">{{ $n($net) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top: 16px;">
    <tr>
        <td style="width: 52%; vertical-align: top; padding-right: 12px;">
            <table class="tot">
                <tr>
                    <td class="lbl">Taux TVA</td>
                    @foreach ($f->bases_tva as $taux => $base)
                        <td class="lbl r">{{ $taux == 0 ? 'Exo' : $taux . ' %' }}</td>
                    @endforeach
                </tr>
                <tr>
                    <td class="lbl">Base</td>
                    @foreach ($f->bases_tva as $taux => $base)
                        <td class="r">{{ $n($base) }}</td>
                    @endforeach
                </tr>
                <tr>
                    <td class="lbl">TVA</td>
                    @foreach ($f->bases_tva as $taux => $base)
                        <td class="r">{{ $n($base * $taux / 100) }}</td>
                    @endforeach
                </tr>
            </table>
            @if ($f->mode_paiement)
                <div style="margin-top: 10px;"><span class="muted">Mode de paiement :</span> {{ $f->mode_paiement }}</div>
            @endif
            @if ($f->tampon)
                <div class="tampon" style="margin-top: 16px;">Cachet et signature</div>
            @endif
        </td>
        <td style="width: 48%; vertical-align: top;">
            <table class="tot">
                <tr><td class="lbl">Montant brut</td><td class="r">{{ $n($f->montant_brut) }}</td></tr>
                @if ($f->remise_acc > 0)
                <tr><td class="lbl">Remise ({{ rtrim(rtrim(number_format($f->remise_acc_taux, 2, ',', ''), '0'), ',') }} %)</td><td class="r">- {{ $n($f->remise_acc) }}</td></tr>
                @endif
                <tr><td class="lbl">Montant HT</td><td class="r">{{ $n($f->montant_ht) }}</td></tr>
                <tr><td class="lbl">Montant TVA</td><td class="r">{{ $n($f->montant_tva) }}</td></tr>
                @if ($f->montant_debours > 0)
                <tr><td class="lbl">Débours</td><td class="r">{{ $n($f->montant_debours) }}</td></tr>
                @endif
                <tr><td class="lbl">Timbre fiscal</td><td class="r">{{ $n($f->timbre) }}</td></tr>
                <tr><td class="lbl">Montant TTC</td><td class="r">{{ $n($f->montant_ttc) }}</td></tr>
                <tr class="net"><td>Net à payer</td><td class="r">{{ $n($f->net_facture) }} {{ $devise }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="muted" style="position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px;">
    Facture {{ $f->numero }} — générée le {{ now()->format('d/m/Y à H:i') }}
</div>
</body>
</html>
