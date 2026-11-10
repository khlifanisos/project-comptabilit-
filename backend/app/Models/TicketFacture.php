<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketFacture extends Model
{
    protected $table = 'ticket_factures';

    /** Contract préfactures are numbered "PF-YY-000001" until validated into a real invoice. */
    public const PREFIXE_PREFACTURE = 'PF-';

    protected $fillable = [
        'ticket_id', 'client_id', 'contrat_id', 'periode_debut', 'periode_fin', 'created_by', 'numero', 'date_facture', 'societe',
        'client_code', 'client_nom', 'observation', 'exercice', 'statut', 'mode_paiement',
        'duplicata', 'tampon', 'sans_en_tete',
        'lignes', 'remise_acc_taux', 'timbre', 'retenue_source', 'montant_retenue',
        'montant_brut', 'remise_acc', 'montant_debours', 'montant_ht',
        'montant_tva', 'montant_ttc', 'net_facture', 'bases_tva',
    ];

    protected $casts = [
        'date_facture'    => 'date:Y-m-d',
        'periode_debut'   => 'date:Y-m-d',
        'periode_fin'     => 'date:Y-m-d',
        'duplicata'       => 'boolean',
        'tampon'          => 'boolean',
        'sans_en_tete'    => 'boolean',
        'retenue_source'  => 'boolean',
        'montant_retenue' => 'float',
        'lignes'          => 'array',
        'bases_tva'       => 'array',
        'remise_acc_taux' => 'float',
        'timbre'          => 'float',
        'montant_brut'    => 'float',
        'remise_acc'      => 'float',
        'montant_debours' => 'float',
        'montant_ht'      => 'float',
        'montant_tva'     => 'float',
        'montant_ttc'     => 'float',
        'net_facture'     => 'float',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function creator()
    {
        return $this->belongsTo(Administrateur::class, 'created_by');
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function contrat()
    {
        return $this->belongsTo(Contrat::class);
    }

    public function reglements()
    {
        return $this->hasMany(Reglement::class, 'facture_id')->orderBy('date_reglement')->orderBy('id');
    }

    public function isPrefacture(): bool
    {
        return str_starts_with($this->numero, self::PREFIXE_PREFACTURE);
    }

    /** Next "{prefix}YY-000001" number, sequenced per calendar year. */
    public static function nextNumero(string $prefix = ''): string
    {
        $prefix .= now()->format('y') . '-';
        $last = self::where('numero', 'like', $prefix . '%')->orderByDesc('numero')->value('numero');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
    }
}
