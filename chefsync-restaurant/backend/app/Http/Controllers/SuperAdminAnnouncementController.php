<?php

namespace App\Http\Controllers;

use App\Models\PlatformAnnouncement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * ניהול הודעות כלליות לפלטפורמה — סופר אדמין בלבד
 */
class SuperAdminAnnouncementController extends Controller
{
    /**
     * רשימת כל ההודעות (paginated)
     */
    public function index(Request $request)
    {
        $announcements = PlatformAnnouncement::with('creator:id,name')
            ->orderByDesc('priority')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['success' => true, 'data' => $announcements]);
    }

    /**
     * יצירת הודעה חדשה
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'body' => 'nullable|string|max:1000',
            'image' => 'nullable|image|max:2048',
            'link_url' => 'nullable|url|max:500',
            'start_at' => 'required|date',
            'end_at' => 'required|date|after:start_at',
            'is_active' => 'boolean',
            'position' => 'in:top_banner,popup,hero_overlay',
            'priority' => 'integer|min:0|max:100',
        ]);

        $imageUrl = null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $file->storeAs('public/announcements', $filename);
            $imageUrl = Storage::url('public/announcements/' . $filename);
        }

        $announcement = PlatformAnnouncement::create([
            'title' => $validated['title'],
            'body' => $validated['body'] ?? null,
            'image_url' => $imageUrl,
            'link_url' => $validated['link_url'] ?? null,
            'start_at' => $validated['start_at'],
            'end_at' => $validated['end_at'],
            'is_active' => $validated['is_active'] ?? true,
            'position' => $validated['position'] ?? 'top_banner',
            'priority' => $validated['priority'] ?? 0,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הודעה נוצרה בהצלחה',
            'data' => $announcement,
        ], 201);
    }

    /**
     * עדכון הודעה
     */
    public function update(Request $request, int $id)
    {
        $announcement = PlatformAnnouncement::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:150',
            'body' => 'nullable|string|max:1000',
            'image' => 'nullable|image|max:2048',
            'remove_image' => 'boolean',
            'link_url' => 'nullable|url|max:500',
            'start_at' => 'sometimes|date',
            'end_at' => 'sometimes|date|after:start_at',
            'is_active' => 'boolean',
            'position' => 'in:top_banner,popup,hero_overlay',
            'priority' => 'integer|min:0|max:100',
        ]);

        if ($request->hasFile('image')) {
            // מחיקת תמונה ישנה
            $this->deleteOldImage($announcement->getRawOriginal('image_url'));
            $file = $request->file('image');
            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $file->storeAs('public/announcements', $filename);
            $validated['image_url'] = Storage::url('public/announcements/' . $filename);
        } elseif ($request->boolean('remove_image')) {
            $this->deleteOldImage($announcement->getRawOriginal('image_url'));
            $validated['image_url'] = null;
        }

        unset($validated['image'], $validated['remove_image']);
        $announcement->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'הודעה עודכנה בהצלחה',
            'data' => $announcement->fresh(),
        ]);
    }

    /**
     * מחיקת הודעה
     */
    public function destroy(int $id)
    {
        $announcement = PlatformAnnouncement::findOrFail($id);
        $this->deleteOldImage($announcement->getRawOriginal('image_url'));
        $announcement->delete();

        return response()->json([
            'success' => true,
            'message' => 'הודעה נמחקה בהצלחה',
        ]);
    }

    /**
     * הפעלה/כיבוי מהיר
     */
    public function toggle(int $id)
    {
        $announcement = PlatformAnnouncement::findOrFail($id);
        $announcement->update(['is_active' => !$announcement->is_active]);

        return response()->json([
            'success' => true,
            'message' => $announcement->is_active ? 'הודעה הופעלה' : 'הודעה כובתה',
            'data' => $announcement,
        ]);
    }

    /**
     * Endpoint ציבורי — הודעות פעילות (ללקוחות)
     */
    public function active()
    {
        $announcements = PlatformAnnouncement::active()
            ->orderByDesc('priority')
            ->get(['id', 'title', 'body', 'image_url', 'link_url', 'position', 'start_at', 'end_at']);

        return response()->json(['success' => true, 'data' => $announcements]);
    }

    private function deleteOldImage(?string $path): void
    {
        if (!$path) return;
        $storagePath = str_replace('/storage/', 'public/', $path);
        if (Storage::exists($storagePath)) {
            Storage::delete($storagePath);
        }
    }
}
