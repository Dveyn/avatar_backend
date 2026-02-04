// Вспомогательные функции для работы с БД

/**
 * Batch insert для оптимизации множественных вставок
 * @param {Object} pool - Пул соединений MySQL
 * @param {string} table - Имя таблицы
 * @param {Array} data - Массив объектов для вставки
 * @param {Array} fields - Массив имен полей
 * @returns {Promise} Результат выполнения запроса
 */
export const batchInsert = async (query, table, data, fields) => {
  if (!data || data.length === 0) {
    return [];
  }

  const placeholders = fields.map(() => '?').join(', ');
  const values = data.map(() => `(${placeholders})`).join(', ');
  
  const sql = `
    INSERT INTO ${table} (${fields.join(', ')})
    VALUES ${values}
  `;
  
  const flatValues = data.flatMap(row => fields.map(field => row[field]));
  
  return await query(sql, flatValues);
};

/**
 * Оптимизированная вставка аватаров
 */
export const insertAvatarsBatch = async (query, personId, avatars) => {
  if (!avatars || avatars.length === 0) {
    return [];
  }

  const fields = ['person_id', 'keyWord', 'avatar_id', 'purchased', 'preview'];
  const data = avatars.map(avatar => ({
    person_id: personId,
    keyWord: avatar.keyWord,
    avatar_id: avatar.avatar_id,
    purchased: avatar.purchased || 0,
    preview: avatar.preview !== undefined ? avatar.preview : 0
  }));

  return await batchInsert(query, 'avatars', data, fields);
};
