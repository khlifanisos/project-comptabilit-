<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Administrateur;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Shared authorization for every resource that belongs to a client
 * (factures, relevés, déclarations, leasing, exports…).
 *
 *  - a client only reaches their own rows;
 *  - an admin only reaches rows of clients in their cabinet
 *    (see Client::scopeVisibleTo()).
 */
trait AuthorizesClientAccess
{
    /** Aborts with 403 unless the current user may act on this client's data. */
    protected function authorizeAccess(Request $request, ?int $clientId): void
    {
        $user = $request->user();

        $allowed = $user instanceof Administrateur
            ? $user->canAccessClient($clientId)
            : $clientId !== null && $user->id === $clientId;

        abort_unless($allowed, 403, 'Accès non autorisé.');
    }

    /**
     * Restricts a query on a client-owned model (with a `client` relation and
     * a `client_id` column) to what the current user may see.
     */
    protected function scopeToUser(Builder $query, $user): Builder
    {
        return $user instanceof Administrateur
            ? $query->whereHas('client', fn (Builder $q) => $q->visibleTo($user))
            : $query->where('client_id', $user->id);
    }

    /**
     * Resolves the client an action targets: the client themself, or — for an
     * admin — the `client_id` they sent, after checking it's in their cabinet.
     */
    protected function resolveTargetClientId(Request $request): int
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            return $user->id;
        }

        $clientId = (int) $request->input('client_id', 0);
        abort_unless($clientId > 0, 422, 'Le client concerné (client_id) est requis.');
        $this->authorizeAccess($request, $clientId);

        return $clientId;
    }
}
