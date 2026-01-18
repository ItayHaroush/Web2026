-- עדכון קואורדינטות למסעדות לפי עיר
-- הרץ בשרת: mysql -u username -p database_name < UpdateRestaurantCoordinates.sql

-- תל אביב
UPDATE restaurants 
SET latitude = 32.0853, longitude = 34.7818 
WHERE city = 'תל אביב' AND (latitude IS NULL OR longitude IS NULL);

-- ירושלים
UPDATE restaurants 
SET latitude = 31.7683, longitude = 35.2137 
WHERE city = 'ירושלים' AND (latitude IS NULL OR longitude IS NULL);

-- חיפה
UPDATE restaurants 
SET latitude = 32.7940, longitude = 34.9896 
WHERE city = 'חיפה' AND (latitude IS NULL OR longitude IS NULL);

-- באר שבע
UPDATE restaurants 
SET latitude = 31.2518, longitude = 34.7913 
WHERE city = 'באר שבע' AND (latitude IS NULL OR longitude IS NULL);

-- נתניה
UPDATE restaurants 
SET latitude = 32.3215, longitude = 34.8532 
WHERE city = 'נתניה' AND (latitude IS NULL OR longitude IS NULL);
