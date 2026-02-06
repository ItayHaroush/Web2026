export const FONT_LIBRARY = [
    {
        id: 'Rubik',
        label: 'Rubik',
        hebrewLabel: 'רוביק',
        cssFamily: "'Rubik', sans-serif",
        googleParam: 'Rubik:wght@400;700;900',
        sample: 'אבגדהו 123',
        style: 'clean',
    },
    {
        id: 'Heebo',
        label: 'Heebo',
        hebrewLabel: 'חיבו',
        cssFamily: "'Heebo', sans-serif",
        googleParam: 'Heebo:wght@400;500;700;900',
        sample: 'אבגדהו 123',
        style: 'modern',
    },
    {
        id: 'Assistant',
        label: 'Assistant',
        hebrewLabel: 'אסיסטנט',
        cssFamily: "'Assistant', sans-serif",
        googleParam: 'Assistant:wght@400;600;700',
        sample: 'אבגדהו 123',
        style: 'light',
    },
    {
        id: 'SecularOne',
        label: 'Secular One',
        hebrewLabel: 'סקולר וואן',
        cssFamily: "'Secular One', sans-serif",
        googleParam: 'Secular+One',
        sample: 'אבגדהו 123',
        style: 'bold',
    },
    {
        id: 'Karantina',
        label: 'Karantina',
        hebrewLabel: 'קרנטינה',
        cssFamily: "'Karantina', system-ui",
        googleParam: 'Karantina:wght@400;700',
        sample: 'אבגדהו 123',
        style: 'display',
    },
    {
        id: 'AmaticSC',
        label: 'Amatic SC',
        hebrewLabel: 'אמאטיק',
        cssFamily: "'Amatic SC', cursive",
        googleParam: 'Amatic+SC:wght@400;700',
        sample: 'אבגדהו 123',
        style: 'handwritten',
    },
];

export const getFontById = (id) => FONT_LIBRARY.find(f => f.id === id) || FONT_LIBRARY[0];

export const buildGoogleFontsUrl = (fontIds) => {
    const unique = [...new Set(fontIds.filter(Boolean))];
    if (unique.length === 0) return null;
    const params = unique
        .map(id => getFontById(id)?.googleParam)
        .filter(Boolean)
        .map(p => `family=${p}`)
        .join('&');
    return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};
