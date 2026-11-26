<?php

namespace App\Http\Middleware;

use App\Models\Administrateur;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level guard for back-office endpoints (tickets, facturation, admin/*).
 *
 * Clients and administrators live in separate tables, so their ids overlap:
 * a controller that assumes "the user is an admin" and filters on
 * `assigned_to = $user->id` would hand a client the rows of the admin who
 * happens to share their id. Rejecting non-admins here closes that whole
 * class of bug, whatever the controller does afterwards.
 */
class EnsureAdministrateur
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!($request->user() instanceof Administrateur)) {
            return response()->json(['message' => 'Accès réservé aux administrateurs.'], 403);
        }

        return $next($request);
    }
}
