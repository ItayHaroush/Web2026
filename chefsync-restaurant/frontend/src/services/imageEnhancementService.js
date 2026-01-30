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
     * @param {number} menuItemId - (אופציונלי) ID של המנה
     * @returns {Promise<Object>} אובייקט עם 3 וריאציות
     */
    async enhance(imageFile, background, angle, menuItemId = null) {
        // Temporary mapping: old values → new backend values
        const backgroundMap = {
            'marble': 'white',
            'wood': 'table',
            'clean': 'white'
        };

        const mappedBackground = backgroundMap[background] || background;

        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('background', mappedBackground);
        formData.append('category', 'food'); // Default
        formData.append('level', 'casual'); // Default
        if (menuItemId) {
            formData.append('menu_item_id', menuItemId);
        }

        const response = await apiClient.post('/admin/ai/enhance-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
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
