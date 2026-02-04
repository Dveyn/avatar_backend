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
        const numericAmount = Number(amount);

        // Общая защита от "бесплатных покупок"
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: 'Сумма оплаты должна быть больше нуля', status: false });
        }

        // Жёсткое правило: покупка аватаров только полным пакетом за 7000 рублей
        if (item.isAvatar && numericAmount !== 7000) {
            return res.status(400).json({ message: 'Неверная сумма для покупки аватаров', status: false });
        }

        const queryRequest = `
            INSERT INTO transactions (user_id, item, amount, status, description )
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await query(queryRequest, [userId, JSON.stringify(item), numericAmount, 'OPEN', title || '']);

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

    console.log('NOTIFICATION BODY =>', req.body, req);

    try {
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

        if (item.isAvatar) {
            if (!item.people_id) {
                console.error('Не указан people_id для покупки аватаров');
                return res.status(400).send('people_id is required for avatar purchase');
            }

            // Новое правило: при покупке аватаров помечаем купленными ВСЕ аватары человека
            await query('UPDATE avatars SET purchased = 1 WHERE person_id = ?', [item.people_id]);
        } else {
            if (item.posId === 2) {
                // Находим первого человека пользователя по email
                const [person] = await query('SELECT id FROM people WHERE user_id IN (SELECT id FROM users WHERE email = ?) ORDER BY id ASC LIMIT 1', [item.email]);

                if (person) {
                    await query('UPDATE avatars SET purchased = 1 WHERE person_id = ?', [person.id]);
                    console.log(`Все аватары для первого человека пользователя ${item.email} помечены как купленные`);
                } else {
                    console.log(`Человек для пользователя ${item.email} не найден`);
                }
            }
            sendPayEmail(item.service, item.name, item.email, item.phone, item.date);
        }

        console.log(`Транзакция ${InvId} успешно обработана`);
        res.send(`OK${InvId}`);

    } catch (error) {
        console.error('Ошибка обработки уведомления:', error);
        res.status(500).send('server error');
    }
};


export const notificationTransactionTest = async () => {
    const getQueryTransaction = 'SELECT user_id, item FROM transactions WHERE id=?';

    const resultGet = await query(getQueryTransaction, [161]);
    const { user_id: userId, item: itemStr } = resultGet[0];
    const item = JSON.parse(itemStr);
    
    if (item.isAvatar) {
        if (!item.people_id) {
            console.error('Не указан people_id для покупки аватаров (test)');
            return;
        }

        // Новое правило: при покупке аватаров помечаем купленными ВСЕ аватары человека
        await query('UPDATE avatars SET purchased = 1 WHERE person_id = ?', [item.people_id]);
    } else {
        sendPayEmail(item.service, item.name, item.email, item.phone, item.date);
    }
};


export const robokassaSignature = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { mrh_login, out_summ, inv_id, Receipt, pass1 } = req.body;
    console.log('RECEIPT', Receipt);
    const signature = crypto
        .createHash('md5')
        .update(`${mrh_login}:${out_summ}:${inv_id}:${Receipt}:${pass1}`)
        .digest('hex');

    res.json(signature);
};
