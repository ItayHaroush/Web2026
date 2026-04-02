<?php

namespace Database\Seeders;

use App\Models\IsraeliHoliday;
use Illuminate\Database\Seeder;

/**
 * Seeder לחגים ישראליים — שנת 2026
 * תאריכים לועזיים מבוססים על לוח השנה העברי
 */
class IsraeliHolidaySeeder extends Seeder
{
    /**
     * רשימת החגים הזמינים לטעינה
     */
    public function getHolidaysList(): array
    {
        return [
            // פסח 2026 — ט"ו-כ"ב ניסן תשפ"ו
            [
                'name' => 'ערב פסח',
                'hebrew_date_info' => 'י״ד ניסן',
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-01',
                'year' => 2026,
                'type' => 'eve',
                'description' => 'ערב חג — סגירה מוקדמת מומלצת',
            ],
            [
                'name' => 'פסח — יום טוב ראשון',
                'hebrew_date_info' => 'ט״ו ניסן',
                'start_date' => '2026-04-02',
                'end_date' => '2026-04-02',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'ליל הסדר ויום טוב ראשון',
            ],
            [
                'name' => 'פסח — חול המועד',
                'hebrew_date_info' => 'ט״ז-כ׳ ניסן',
                'start_date' => '2026-04-03',
                'end_date' => '2026-04-07',
                'year' => 2026,
                'type' => 'half_day',
                'description' => 'חול המועד — חלק מהעסקים פתוחים',
            ],
            [
                'name' => 'פסח — שביעי של פסח',
                'hebrew_date_info' => 'כ״א ניסן',
                'start_date' => '2026-04-08',
                'end_date' => '2026-04-08',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'יום טוב אחרון של פסח',
            ],

            // יום הזיכרון 2026
            [
                'name' => 'יום הזיכרון',
                'hebrew_date_info' => 'ד׳ אייר',
                'start_date' => '2026-04-22',
                'end_date' => '2026-04-22',
                'year' => 2026,
                'type' => 'info_only',
                'description' => 'יום הזיכרון לחללי מערכות ישראל — מקומות בילוי סגורים',
            ],

            // יום העצמאות 2026
            [
                'name' => 'יום העצמאות',
                'hebrew_date_info' => 'ה׳ אייר',
                'start_date' => '2026-04-23',
                'end_date' => '2026-04-23',
                'year' => 2026,
                'type' => 'info_only',
                'description' => 'חג לאומי — רוב העסקים פתוחים',
            ],

            // שבועות 2026
            [
                'name' => 'שבועות',
                'hebrew_date_info' => 'ו׳ סיוון',
                'start_date' => '2026-05-22',
                'end_date' => '2026-05-22',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'חג השבועות — יום טוב',
            ],

            // ט״ב 2026
            [
                'name' => 'תשעה באב',
                'hebrew_date_info' => 'ט׳ באב',
                'start_date' => '2026-07-26',
                'end_date' => '2026-07-26',
                'year' => 2026,
                'type' => 'info_only',
                'description' => 'צום ט׳ באב — מסעדות רבות סגורות',
            ],

            // ראש השנה 2026 — א׳-ב׳ תשרי תשפ"ז
            [
                'name' => 'ערב ראש השנה',
                'hebrew_date_info' => 'כ״ט אלול',
                'start_date' => '2026-09-11',
                'end_date' => '2026-09-11',
                'year' => 2026,
                'type' => 'eve',
                'description' => 'ערב חג — סגירה מוקדמת מומלצת',
            ],
            [
                'name' => 'ראש השנה',
                'hebrew_date_info' => 'א׳-ב׳ תשרי',
                'start_date' => '2026-09-12',
                'end_date' => '2026-09-13',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'ראש השנה — יום טוב',
            ],

            // יום כיפור 2026
            [
                'name' => 'ערב יום כיפור',
                'hebrew_date_info' => 'ט׳ תשרי',
                'start_date' => '2026-09-20',
                'end_date' => '2026-09-20',
                'year' => 2026,
                'type' => 'eve',
                'description' => 'ערב יום הכיפורים — סגירה לפני כניסת הצום',
            ],
            [
                'name' => 'יום כיפור',
                'hebrew_date_info' => 'י׳ תשרי',
                'start_date' => '2026-09-21',
                'end_date' => '2026-09-21',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'יום הכיפורים — הכל סגור',
            ],

            // סוכות 2026
            [
                'name' => 'סוכות — יום טוב ראשון',
                'hebrew_date_info' => 'ט״ו תשרי',
                'start_date' => '2026-09-26',
                'end_date' => '2026-09-26',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'סוכות — יום טוב',
            ],
            [
                'name' => 'סוכות — חול המועד',
                'hebrew_date_info' => 'ט״ז-כ״א תשרי',
                'start_date' => '2026-09-27',
                'end_date' => '2026-10-02',
                'year' => 2026,
                'type' => 'half_day',
                'description' => 'חול המועד סוכות',
            ],
            [
                'name' => 'שמחת תורה / שמיני עצרת',
                'hebrew_date_info' => 'כ״ב תשרי',
                'start_date' => '2026-10-03',
                'end_date' => '2026-10-03',
                'year' => 2026,
                'type' => 'full_closure',
                'description' => 'שמחת תורה — יום טוב',
            ],

            // חנוכה 2026
            [
                'name' => 'חנוכה',
                'hebrew_date_info' => 'כ״ה כסלו - ב׳ טבת',
                'start_date' => '2026-12-05',
                'end_date' => '2026-12-12',
                'year' => 2026,
                'type' => 'info_only',
                'description' => 'חנוכה — ימי עבודה רגילים, אירועים מיוחדים',
            ],
        ];
    }

    public function run(): void
    {
        $holidays = $this->getHolidaysList();

        foreach ($holidays as $holiday) {
            IsraeliHoliday::updateOrCreate(
                [
                    'name' => $holiday['name'],
                    'year' => $holiday['year'],
                    'start_date' => $holiday['start_date'],
                ],
                $holiday
            );
        }

        $this->command->info('✅ חגים ישראליים 2026 נטענו בהצלחה (' . count($holidays) . ' חגים)');
    }
}
