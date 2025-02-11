import { query } from '../models/db.js';
import { sendConfirmationEmail, sendPayEmail } from '../utils/email.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const MRH_PASS2 = process.env.ROBOKASSA_PASS2;
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
    const { OutSum, InvId, SignatureValue } = req.body;

    console.log('NOTIFICATION BODY =>',req.body, req)

    try {
        // Формируем свою подпись
        const myCrc = crypto
            .createHash('md5')
            .update(`${OutSum}:${InvId}:${MRH_PASS2}`)
            .digest('hex')
            .toUpperCase();

        if (myCrc !== SignatureValue.toUpperCase()) {
            console.error('Ошибка проверки подписи');
            return res.status(400).send('bad sign');
        }

        // Получаем информацию о транзакции
        const getQueryTransaction = 'SELECT user_id, item FROM transactions WHERE id=?';
        const resultGet = await query(getQueryTransaction, [InvId]);

        if (!resultGet.length) {
            console.error('Транзакция не найдена');
            return res.status(404).send('transaction not found');
        }

        // Обновляем статус транзакции
        await query('UPDATE transactions SET status = ? WHERE id = ?', ['CONFIRMED', InvId]);

        const { user_id: userId, item: itemStr } = resultGet[0];
        const item = JSON.parse(itemStr);

        // Если это покупка аватара
        if (item.isAvatar) {
            const avatars = await query('SELECT * FROM avatars WHERE person_id = ?', [item.people_id]);

            // Покупка аватара с id = 11
            const idsWithAvatar = avatars.filter(a => a.avatar_id === item.avatar_id).map(a => a.id);
            for (const id of idsWithAvatar) {
                await query('UPDATE avatars SET purchased = ? WHERE id = ?', [1, id]);
            }
        } else {
            // Отправляем email с информацией о покупке
            sendPayEmail(item.service, item.name, item.email, item.phone, item.date);
        }

        console.log(`Транзакция ${InvId} успешно обработана`);
        res.send(`OK${InvId}`);

    } catch (error) {
        console.error('Ошибка обработки уведомления:', error);
        res.status(500).send('server error');
    }
};



export const robokassaSignature = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { mrh_login, out_summ, inv_id, pass1 } = req.body;

    const signature = crypto
        .createHash('md5')
        .update(`${mrh_login}:${out_summ}:${inv_id}:${pass1}`)
        .digest('hex');

    res.json(signature);
};
