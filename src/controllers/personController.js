import { query } from '../models/db.js';


export const getProfile = async (req, res) => {
    const userId = req.userId;

    const queryRequest = `SELECT people.*, users.email, users.is_admin FROM people JOIN users ON users.id = people.user_id WHERE people.user_id = ?`;
  
    const people = await query(queryRequest, [userId]);
    
    if (people.length > 1) {
        res.status(200).json({ people: people.length, people: people });
    } else if (people.length === 1) {
        const peopleId = people[0].id;
        const avatars = await query('SELECT * FROM avatars WHERE person_id =? ', [peopleId]);
        res.status(200).json({ people: people.length, date: people[0], avatars: avatars });
    } else {
        res.status(200).json({ people: 0 });
    }
};
// Получение списка людей для пользователя
export const getPeople = async (req, res) => {
    const { userId } = req.user;

    try {
        const queryRequest = `SELECT * FROM people WHERE user_id = ?`;
        const people = await query(queryRequest, [userId]);

        res.status(200).json(people);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка получения списка людей' });
    }
};

export const addPerson = async (req, res) => {
    const { name, birdDay, gender, result } = req.body;
    const userId = req.userId;

    if (!name) {
        return res.status(400).json({ message: 'Имя обязательно' });
    }

    try {
        const queryRequest = `
            INSERT INTO people (user_id, name, gender, birth_date)
            VALUES (?, ?, ?, ?)
        `;

        const resultQuery = await query(queryRequest, [userId, name, gender, birdDay]);
        const personId = resultQuery.insertId;

        const avatars = [
            { keyWord: 'A', avatar_id: result.A, purchased: 1 },
            { keyWord: 'B', avatar_id: result.B, purchased: 0 },
            { keyWord: 'V', avatar_id: result.V, purchased: 0 },
            { keyWord: 'G', avatar_id: result.G, purchased: 0 },
            { keyWord: 'D', avatar_id: result.D, purchased: 0 },
            { keyWord: 'K', avatar_id: result.K, purchased: 0 },
            { keyWord: 'L', avatar_id: result.L, purchased: 0 },
            { keyWord: 'M', avatar_id: result.M, purchased: 0 },
            { keyWord: 'N', avatar_id: result.N, purchased: 0 },
            { keyWord: 'B2', avatar_id: result.B2, purchased: 0 },
        ];

        const avatarQuery = `INSERT INTO avatars (person_id, keyWord, avatar_id, purchased) VALUES (?,?,?,?)`;

        try {
            for (const avatar of avatars) {
                await query(avatarQuery, [personId, avatar.keyWord, avatar.avatar_id, avatar.purchased]);
            }
            console.log('Все аватары успешно добавлены.');
        } catch (error) {
            console.error('Ошибка при добавлении аватаров:', error);
        }

        res.status(200).json({ message: 'Человек добавлен' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка добавления человека' });
    }
};

export const getAvatar = async (req, res) => {

    const { id: avatarId } = req.body;
    const userId = req.userId;

    if (!avatarId) {
        return res.status(400).json({ message: 'Не передан ID аватара' });
    }

    try {
        const queryRequest = `
            SELECT a.*, p.gender, p.user_id
            FROM avatars a
            INNER JOIN people p ON a.person_id = p.id
            WHERE a.id = ? AND p.user_id = ?
        `;
        const result = await query(queryRequest, [avatarId, userId]);

        if (result.length === 0) {
            return res.status(403).json({ message: 'Нет доступа к этому аватару' });
        }
        console.log(result[0]);
        res.status(200).json({ avatar: result[0] });
    } catch (error) {
        console.error('Ошибка при получении аватара:', error);
        res.status(500).json({ message: 'Ошибка получения аватара' });
    }
};


export const getAvatars = async (req, res) => {
    const { id: peopleId } = req.body;
    const userId = req.userId;
    const queryRequest = `SELECT people.*, users.email FROM people JOIN users ON users.id = people.user_id WHERE people.user_id = ? AND people.id = ?`;
    const people = await query(queryRequest, [userId, peopleId]);


    const avatars = await query('SELECT * FROM avatars WHERE person_id =? ', [peopleId]);
    res.status(200).json({ people: people.length, date: people[0], avatars: avatars });

};
