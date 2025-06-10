-- Проверяем и добавляем provider
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'provider');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE users ADD COLUMN provider VARCHAR(10) DEFAULT "email"',
    'SELECT "Column provider already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Проверяем и добавляем social_id
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'social_id');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE users ADD COLUMN social_id VARCHAR(255)',
    'SELECT "Column social_id already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Проверяем и добавляем индекс
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_NAME = 'users' AND INDEX_NAME = 'idx_social_user');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE users ADD UNIQUE INDEX idx_social_user (provider, social_id)',
    'SELECT "Index idx_social_user already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 
