<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\PaymentTerminal;
use App\Models\PosSession;
use App\Models\Restaurant;
use Illuminate\Http\Request;

class PaymentTerminalController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $terminals = PaymentTerminal::where('restaurant_id', $user->restaurant_id)
            ->orderBy('name')
            ->get()
            ->map(fn ($t) => $this->formatTerminal($t));

        return response()->json(['success' => true, 'terminals' => $terminals]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'zcredit_terminal_number' => 'nullable|string|max:64',
            'zcredit_terminal_password' => 'nullable|string|max:255',
            'zcredit_pinpad_id' => 'nullable|string|max:64',
        ]);

        $terminal = PaymentTerminal::create(array_merge($validated, [
            'restaurant_id' => $user->restaurant_id,
        ]));

        return response()->json(['success' => true, 'terminal' => $this->formatTerminal($terminal)], 201);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $terminal = PaymentTerminal::where('restaurant_id', $user->restaurant_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:120',
            'zcredit_terminal_number' => 'nullable|string|max:64',
            'zcredit_terminal_password' => 'nullable|string|max:255',
            'zcredit_pinpad_id' => 'nullable|string|max:64',
        ]);

        if (array_key_exists('zcredit_terminal_password', $validated) && $validated['zcredit_terminal_password'] === '') {
            unset($validated['zcredit_terminal_password']);
        }

        $terminal->update($validated);

        return response()->json(['success' => true, 'terminal' => $this->formatTerminal($terminal->fresh())]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $terminal = PaymentTerminal::where('restaurant_id', $user->restaurant_id)->findOrFail($id);

        $restaurant = Restaurant::find($user->restaurant_id);
        if ($restaurant && (int) $restaurant->default_payment_terminal_id === (int) $terminal->id) {
            $restaurant->update(['default_payment_terminal_id' => null]);
        }

        Kiosk::where('restaurant_id', $user->restaurant_id)->where('payment_terminal_id', $terminal->id)->update(['payment_terminal_id' => null]);
        PosSession::where('payment_terminal_id', $terminal->id)->update(['payment_terminal_id' => null]);

        $terminal->delete();

        return response()->json(['success' => true]);
    }

    private function formatTerminal(PaymentTerminal $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'zcredit_terminal_number' => $t->zcredit_terminal_number,
            'zcredit_pinpad_id' => $t->zcredit_pinpad_id,
            'has_password' => $t->zcredit_terminal_password !== null && $t->zcredit_terminal_password !== '',
        ];
    }
}
