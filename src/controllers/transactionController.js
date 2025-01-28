import { query } from '../models/db.js';
import { sendConfirmationEmail } from '../utils/email.js';

// Запись транзакции
export const createTransaction = async (req, res) => {
    const { item, amount, title } = req.body;
    const userId = req.userId || null;
    if (!item || !amount) {
        return res.status(400).json({ message: 'Все поля обязательны' });
    }

    try {
        const queryRequest = `
            INSERT INTO transactions (user_id, item, amount, status, description )
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await query(queryRequest, [userId, JSON.stringify(item), amount, 'OPEN', title || '']);

        // Возвращаем ID из результата
        const transactionId = result.insertId;

        res.status(200).json({ message: 'Транзакция записана', orderID: transactionId, status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка записи транзакции' });
    }
};

export const notificationTransaction = async (req, res) => {
    const { OrderId, Success, Status, Amount } = req.body;

    try {
        const getQueryTransaction = 'SELECT user_id, people_id, item FROM transactions WHERE id=?';
        const resultGet = await query(getQueryTransaction, [OrderId]);

        if (!resultGet) {
            //Ошибку вывести потом
        }
        await query('UPDATE transactions SET status= ? WHERE id = ?', [Status, OrderId]);
      
        if (Status === 'CONFIRMED') {
          
            const { user_id:userId, item:itemStr } = resultGet[0]
            const item = JSON.parse(itemStr);

            if (item.isAvatar) {
                const avatars =  await query('SELECT * FROM avatars WHERE person_id = ?', [item.people_id])
                const idsWithAvatar = avatars.filter(item => item.avatar_id === 11).map(item => item.id);
                idsWithAvatar.map(async id => {
                    await query('UPDATE avatars SET purchased= ? WHERE id = ?', [1, id]);
                })

                const idsPreviewAvatar = avatars.filter(item => item.avatar_id === 11).map(item => item.id);
                idsPreviewAvatar.map(async id => {
                    await query('UPDATE avatars SET purchased= ? WHERE id = ?', [1, id]);
                })

            } else {
                sendConfirmationEmail(item.service, item.name, item.email, item.phone, item.date);
            }
        }
        res.send('ok');

    } catch (error) {
        console.error(error)
    }

};
