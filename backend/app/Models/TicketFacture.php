<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketFacture extends Model
{
    protected $table = 'ticket_factures';

    protected $fillable = [
        'ticket_id', 'created_by', 'numero', 'date_facture', 'societe',
        'client_code', 'client_nom', 'observation', 'exercice', 'statut', 'mode_paiement',
        'duplicata', 'tampon', 'sans_en_tete',
        'lignes', 'remise_acc_taux', 'timbre',
        'montant_brut', 'remise_acc', 'montant_debours', 'montant_ht',
        'montant_tva', 'montant_ttc', 'net_facture', 'bases_tva',
    ];

    protected $casts = [
        'date_facture'    => 'date:Y-m-d',
        'duplicata'       => 'boolean',
        'tampon'          => 'boolean',
        'sans_en_tete'    => 'boolean',
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
}
