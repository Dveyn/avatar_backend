import { query } from '../models/db.js';
import { asyncHandler, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { insertAvatarsBatch } from '../utils/dbHelpers.js';

export const getProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;

    const queryRequest = `SELECT people.*, users.email, users.is_admin FROM people JOIN users ON users.id = people.user_id WHERE people.user_id = ?`;
  
    const people = await query(queryRequest, [userId]);
    
    if (people.length === 0) {
        return res.status(200).json({ people: 0 });
    }
    
    if (people.length === 1) {
        const peopleId = people[0].id;
        const avatars = await query('SELECT * FROM avatars WHERE person_id = ?', [peopleId]);
        return res.status(200).json({ 
            people: people.length, 
            date: people[0], 
            avatars: avatars 
        });
    }
    
    // Если несколько людей, возвращаем список
    res.status(200).json({ 
        people: people.length, 
        date: people[0], 
        people: people 
    });
});
// Получение списка людей для пользователя
export const getPeople = asyncHandler(async (req, res) => {
    const userId = req.userId;

    const queryRequest = `SELECT * FROM people WHERE user_id = ?`;
    const people = await query(queryRequest, [userId]);

    res.status(200).json(people);
});

export const addPerson = asyncHandler(async (req, res) => {
    const { name, birdDay, gender, result } = req.body;
    const userId = req.userId;

    const queryRequest = `
        INSERT INTO people (user_id, name, gender, birth_date)
        VALUES (?, ?, ?, ?)
    `;

    const resultQuery = await query(queryRequest, [userId, name, gender, birdDay]);
    const personId = resultQuery.insertId;

    const avatars = [
        { keyWord: 'A', avatar_id: result.A, purchased: 1, preview: 0 },
        { keyWord: 'B', avatar_id: result.B, purchased: 0, preview: 0 },
        { keyWord: 'V', avatar_id: result.V, purchased: 0, preview: 0 },
        { keyWord: 'G', avatar_id: result.G, purchased: 0, preview: 0 },
        { keyWord: 'D', avatar_id: result.D, purchased: 0, preview: 0 },
        { keyWord: 'K', avatar_id: result.K, purchased: 0, preview: 0 },
        { keyWord: 'L', avatar_id: result.L, purchased: 0, preview: 0 },
        { keyWord: 'M', avatar_id: result.M, purchased: 0, preview: 0 },
        { keyWord: 'N', avatar_id: result.N, purchased: 0, preview: 0 },
        { keyWord: 'B2', avatar_id: result.B2, purchased: 0, preview: 0 },
    ];

    // Используем batch insert вместо цикла
    await insertAvatarsBatch(query, personId, avatars);
    logger.debug(`Успешно добавлено ${avatars.length} аватаров для person_id: ${personId}`);

    res.status(200).json({ message: 'Человек добавлен' });
});

export const getAvatar = asyncHandler(async (req, res) => {
    const { id: avatarId } = req.body;
    const userId = req.userId;

    if (!avatarId) {
        throw new ValidationError('Не передан ID аватара');
    }

    const queryRequest = `
        SELECT a.*, p.gender, p.user_id
        FROM avatars a
        INNER JOIN people p ON a.person_id = p.id
        WHERE a.id = ? AND p.user_id = ?
    `;
    const result = await query(queryRequest, [avatarId, userId]);

    if (result.length === 0) {
        throw new NotFoundError('Нет доступа к этому аватару');
    }

    res.status(200).json({ avatar: result[0] });
});


export const getAvatars = asyncHandler(async (req, res) => {
    const { id: peopleId } = req.body;
    const userId = req.userId;
    
    if (!peopleId) {
        throw new ValidationError('Не передан ID человека');
    }

    const queryRequest = `SELECT people.*, users.email FROM people JOIN users ON users.id = people.user_id WHERE people.user_id = ? AND people.id = ?`;
    const people = await query(queryRequest, [userId, peopleId]);

    if (people.length === 0) {
        throw new NotFoundError('Человек не найден');
    }

    const avatars = await query('SELECT * FROM avatars WHERE person_id = ?', [peopleId]);
    res.status(200).json({ 
        people: people.length, 
        date: people[0], 
        avatars: avatars 
    });
});
