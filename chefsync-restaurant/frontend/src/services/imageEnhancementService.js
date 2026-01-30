import apiClient from './apiClient';

/**
 * שירות לשיפור תמונות עם AI
 */
class ImageEnhancementService {
    /**
     * שיפור תמונה עם בחירת סגנון הגשה
     * @param {File} imageFile - קובץ התמונה
     * @param {string} userScene - סגנון הגשה שנבחר: plate, street, home (אופציונלי)
     * @param {null} deprecated - פרמטר ישן, לא בשימוש
     * @param {Object} menuItem - (אופציונלי) אובייקט המנה המלא
     * @returns {Promise<Object>} אובייקט עם 3 וריאציות
     */
    async enhance(imageFile, userScene = null, deprecated = null, menuItem = null) {
        const formData = new FormData();
        formData.append('image', imageFile);

        // 🎯 זיהוי אוטומטי של category (משקה/אוכל)
        const detectedCategory = this.detectCategory(menuItem);
        const detectedPresentation = this.detectPresentation(menuItem, detectedCategory);
        const detectedScene = this.detectScene(menuItem);

        console.log('🔍 זיהוי אוטומטי:', {
            menuItemName: menuItem?.name,
            categoryName: menuItem?.category?.name,
            detectedCategory,
            detectedPresentation,
            userScene,
            detectedScene
        });

        formData.append('category', detectedCategory);
        formData.append('presentation', detectedPresentation);
        
        // 🎬 Scene: משתמש בבחירה ידנית אם יש, אחרת auto-detect
        const finalScene = userScene || detectedScene;
        if (finalScene) {
            formData.append('scene', finalScene);
        }

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
     * זיהוי אוטומטי של סצנה/סגנון (scene)
     * street, home, moroccan, middle_eastern, fine_dining
     */
    detectScene(menuItem) {
        if (!menuItem) return null;

        const name = menuItem.name || '';
        const description = menuItem.description || '';
        const categoryName = menuItem.category?.name || '';
        const restaurantName = menuItem.restaurant?.name || '';

        // 🌍 מזרח תיכוני / מרוקאי
        const middleEasternKeywords = ['חומוס', 'טחינה', 'פלאפל', 'מסבחה', 'שקשוקה', 'סביח'];
        const moroccanKeywords = ['טאג\'ין', 'כוסכוס', 'חריימה', 'דפינה', 'מרוקאי', 'מרוקנית'];
        
        if (moroccanKeywords.some(kw => name.includes(kw) || description.includes(kw) || categoryName.includes(kw))) {
            return 'moroccan';
        }
        
        if (middleEasternKeywords.some(kw => name.includes(kw) || description.includes(kw) || categoryName.includes(kw))) {
            return 'middle_eastern';
        }

        // 🏠 אוכל ביתי
        const homeKeywords = ['ביתי', 'של סבתא', 'מתכון אמא', 'מסורתי', 'כפרי'];
        if (homeKeywords.some(kw => name.includes(kw) || description.includes(kw) || restaurantName.includes(kw))) {
            return 'home';
        }

        // 🍽️ Fine Dining
        const fineDiningKeywords = ['גורמה', 'שף', 'מיוחד', 'פרמיום', 'מעודן'];
        if (fineDiningKeywords.some(kw => description.includes(kw) || restaurantName.includes(kw))) {
            return 'fine_dining';
        }

        // 🌮 Street Food (default למנות רחוב)
        const streetKeywords = ['ברחוב', 'דוכן', 'טייק אווי'];
        if (streetKeywords.some(kw => name.includes(kw) || description.includes(kw))) {
            return 'street';
        }

        return null; // אם לא זוהה scene ספציפי, הבקאנד יבחר default
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
