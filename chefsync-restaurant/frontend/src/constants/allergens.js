/**
 * מילון אלרגנים - מיפוי בין ערכים באנגלית (DB) לעברית (UI)
 */
export const ALLERGEN_MAP = {
    gluten: 'גלוטן',
    nuts: 'אגוזים',
    peanuts: 'בוטנים',
    eggs: 'ביצים',
    milk: 'חלב',
    soy: 'סויה',
    sesame: 'שומשום',
    fish: 'דגים',
    shellfish: 'פירות ים',
    celery: 'סלרי',
    mustard: 'חרדל',
    sulfites: 'סולפיטים',
    lupin: 'לופין',
    mollusks: 'רכיכות'
};

/**
 * רשימת כל האלרגנים האפשריים
 */
export const ALLERGEN_OPTIONS = [
    { value: 'gluten', label: 'גלוטן' },
    { value: 'nuts', label: 'אגוזים' },
    { value: 'peanuts', label: 'בוטנים' },
    { value: 'eggs', label: 'ביצים' },
    { value: 'milk', label: 'חלב' },
    { value: 'soy', label: 'סויה' },
    { value: 'sesame', label: 'שומשום' },
    { value: 'fish', label: 'דגים' },
    { value: 'shellfish', label: 'פירות ים' },
    { value: 'celery', label: 'סלרי' },
    { value: 'mustard', label: 'חרדל' },
    { value: 'sulfites', label: 'סולפיטים' },
    { value: 'lupin', label: 'לופין' },
    { value: 'mollusks', label: 'רכיכות' }
];

/**
 * רמות כשרות
 */
export const KASHRUT_LEVELS = {
    none: 'לא כשר',
    kosher: 'כשר',
    mehadrin: 'מהדרין',
    badatz: 'בד"ץ',
    other: 'אחר'
};

/**
 * אופציות כשרות לבחירה
 */
export const KASHRUT_OPTIONS = [
    { value: 'none', label: 'לא כשר' },
    { value: 'kosher', label: 'כשר' },
    { value: 'mehadrin', label: 'מהדרין' },
    { value: 'badatz', label: 'בד"ץ' },
    { value: 'other', label: 'אחר' }
];
