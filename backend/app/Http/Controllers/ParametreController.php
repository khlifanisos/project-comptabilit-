<?php

namespace App\Http\Controllers;

use App\Models\Administrateur;
use App\Models\Parametre;
use Illuminate\Http\Request;

class ParametreController extends Controller
{
    private function current(): Parametre
    {
        return Parametre::first() ?? Parametre::create(['devise' => 'TND']);
    }

    public function show()
    {
        return response()->json($this->current());
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if (!($user instanceof Administrateur)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        $validated = $request->validate([
            'devise'   => 'sometimes|required|string|max:10',
            'whatsapp' => 'sometimes|nullable|string|max:30',
        ]);

        $parametre = $this->current();
        $parametre->update($validated);

        return response()->json($parametre);
    }
}
