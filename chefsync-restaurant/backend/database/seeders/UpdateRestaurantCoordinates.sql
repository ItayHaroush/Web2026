-- עדכון קואורדינטות למסעדות לפי עיר
-- הרץ בשרת: mysql -u username -p database_name < UpdateRestaurantCoordinates.sql

UPDATE restaurants SET latitude = 32.6996, longitude = 35.3035 WHERE city = 'נוף הגליל';

UPDATE restaurants SET latitude = 32.6996, longitude = 35.3035 WHERE name LIKE '%מנוף הגליל%';