import apiClient from './apiClient';

/**
 * שירות לשיפור תמונות עם AI
 */
class ImageEnhancementService {
    /**
     * שיפור תמונה עם אפשרויות רקע וזווית
     * @param {File} imageFile - קובץ התמונה
     * @param {string} background - סוג רקע: marble, wood, clean
     * @param {string} angle - זווית צילום: top, side, hands
     * @param {Object} menuItem - (אופציונלי) אובייקט המנה המלא (עם category_id, name)
     * @returns {Promise<Object>} אובייקט עם 3 וריאציות
     */
    async enhance(imageFile, background, angle, menuItem = null) {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('background', background || 'white');

        // 🎯 זיהוי אוטומטי של category (משקה/אוכל)
        const detectedCategory = this.detectCategory(menuItem);
        const detectedPresentation = this.detectPresentation(menuItem, detectedCategory);

        console.log('🔍 זיהוי אוטומטי:', {
            menuItemName: menuItem?.name,
            categoryName: menuItem?.category?.name,
            detectedCategory,
            detectedPresentation
        });

        formData.append('category', detectedCategory);
        formData.append('presentation', detectedPresentation);

        // 📝 פרטי המנה להעשרת הפרומפט
        if (menuItem) {
            formData.append('menu_item_id', menuItem.id);

            if (menuItem.name) {
                formData.append('dish_name', menuItem.name);
            }
            if (menuItem.description) {
                formData.append('description', menuItem.description);
            }
            if (menuItem.price) {
                formData.append('price', menuItem.price);
            }
            if (menuItem.category_id) {
                formData.append('category_id', menuItem.category_id);
            }
            if (menuItem.category?.name) {
                formData.append('category_name', menuItem.category.name);
            }
            if (menuItem.is_vegan) {
                formData.append('is_vegan', '1');
            }
            if (menuItem.is_vegetarian) {
                formData.append('is_vegetarian', '1');
            }
        }

        const response = await apiClient.post('/admin/ai/enhance-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 60000, // 60 seconds for 3 variations
        });

        return response.data;
    }

    /**
     * זיהוי אוטומטי של קטגוריית המנה
     */
    detectCategory(menuItem) {
        if (!menuItem) return 'generic';

        // ⚠️ לא משתמשים ב-toLowerCase() כי זה עברית!
        const name = menuItem.name || '';
        const categoryName = menuItem.category?.name || '';
        const description = menuItem.description || '';

        // 🥤 משקאות
        const drinkKeywords = ['משקה', 'שתייה', 'קולה', 'סודה', 'בירה', 'יין', 'מיץ', 'קפה', 'תה', 'לימונדה', 'קוקטייל', 'מים', 'water', 'drink'];
        if (drinkKeywords.some(kw => categoryName.includes(kw) || name.includes(kw))) {
            return 'drink';
        }

        // 🍕 פיצה
        if (name.includes('פיצה') || categoryName.includes('פיצ')) {
            return 'pizza';
        }

        // 🥙 שווארמה
        if (name.includes('שווארמה') || name.includes('שוורמה')) {
            return 'shawarma';
        }

        // 🍔 המבורגר
        if (name.includes('המבורגר') || name.includes('בורגר')) {
            return 'burger';
        }

        // 🥗 סלט
        if (name.includes('סלט') || categoryName.includes('סלט')) {
            return 'salad';
        }

        return 'generic';
    }

    /**
     * זיהוי אוטומטי של סגנון הגשה
     */
    detectPresentation(menuItem, category) {
        if (!menuItem) return 'plate';

        // ⚠️ לא משתמשים ב-toLowerCase() כי זה עברית!
        const name = menuItem.name || '';
        const description = menuItem.description || '';

        // משקאות
        if (category === 'drink') {
            if (name.includes('בקבוק') || description.includes('בקבוק')) {
                return 'bottle';
            }
            return 'glass';
        }

        // בפיתה / לפה
        if (name.includes('בפיתה') || name.includes('לפה') || description.includes('פיתה')) {
            return 'pita';
        }

        // באגט
        if (name.includes('באגט') || description.includes('באגט')) {
            return 'baguette';
        }

        // Default לפי קטגוריה
        if (category === 'pizza') return 'plate';
        if (category === 'shawarma') return 'pita';
        if (category === 'burger') return 'street';
        if (category === 'salad') return 'bowl';

        return 'plate';
    }

    /**
     * בחירת וריאציה מועדפת
     * @param {number} enhancementId - ID של תהליך השיפור
     * @param {number} selectedIndex - אינדקס הוריאציה הנבחרת (0-2)
     * @returns {Promise<Object>} אובייקט עם ה-URL הסופי
     */
    async selectVariation(enhancementId, selectedIndex) {
        const response = await apiClient.post('/admin/ai/select-variation', {
            enhancement_id: enhancementId,
            selected_index: selectedIndex,
        });

        return response.data;
    }

    /**
     * שליפת היסטוריית שיפורים
     * @returns {Promise<Array>} רשימת שיפורים
     */
    async getEnhancements() {
        const response = await apiClient.get('/admin/ai/enhancements');
        return response.data;
    }

    /**
     * מחיקת שיפור
     * @param {number} id - ID של השיפור
     * @returns {Promise<Object>}
     */
    async deleteEnhancement(id) {
        const response = await apiClient.delete(`/admin/ai/enhancements/${id}`);
        return response.data;
    }
}

export default new ImageEnhancementService();
