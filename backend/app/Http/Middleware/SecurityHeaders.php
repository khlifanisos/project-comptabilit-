<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Defensive HTTP headers on every response.
 *
 * The API returns JSON and user-uploaded files (invoices, attachments…), so
 * none of its responses should ever be framed, sniffed into another content
 * type, or leak the URL they were loaded from.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'no-referrer');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->remove('X-Powered-By');

        // API responses carry client data: never store them (browser disk cache,
        // proxies) unless a route deliberately set a max-age (e.g. attachments).
        if ($request->is('api/*') && !$headers->hasCacheControlDirective('max-age')) {
            $headers->set('Cache-Control', 'no-store, private');
        }

        if ($request->isSecure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
