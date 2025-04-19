import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

import { query } from '../models/db.js';

export const sendConfirmationEmail = async (email, token) => {
  const mail = process.env.MAIL;
  const password = process.env.MAIL_PASSWORD;

  const transporter = nodemailer.createTransport({
    service: 'mail.ananievds.ru',
    host: 'mail.ananievds.ru',
    port: 465,
    secure: true,
    auth: {
      user: mail,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: mail,
    to: email,
    subject: 'Подтверждение регистрации',
    html: `<p>Для подтверждения вашей почты перейдите по <a style="color:rgb(41, 4, 255);" href="https://avalik-avatar.ru/confirm-email/${token}">ссылке (https://avalik-avatar.ru/confirm-email/${token})</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPayEmail = async (title, name, email, phone, date) => {
  const mail = process.env.MAIL;
  const password = process.env.MAIL_PASSWORD;

  const transporter = nodemailer.createTransport({
    service: 'mail.avalik-avatar.ru',
    host: 'mail.avalik-avatar.ru',
    port: 465,
    secure: true,
    auth: {
      user: mail,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: 'info@avalik-avatar.ru',
    to: ['kimavalik@gmail.com', 'info@avalik-avatar.ru'],
    subject: 'Новый заказ консультации',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4caf50; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Новый заказ консультации</h2>
          </div>
          <div style="padding: 20px;">
            <p style="margin: 0 0 10px;"><strong>Заказ:</strong> ${title}</p>
            <p style="margin: 0 0 10px;"><strong>Имя клиента:</strong> ${name}</p>
            <p style="margin: 0 0 10px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0 0 10px;"><strong>Номер телефона:</strong> ${phone}</p>
            <p style="margin: 0 0 10px;"><strong>Дата:</strong> ${date}</p>
          </div>
          <div style="background-color: #f4f4f9; padding: 10px; text-align: center; font-size: 14px; color: #777;">
            <p style="margin: 0;">Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
          </div>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendOneMail = async () => {
  const mail = process.env.MAIL;
  const password = process.env.MAIL_PASSWORD;

  const queryRequest = `SELECT email FROM users WHERE confirmation_token IS NULL OR confirmation_token = ''`;
  const userReq = await query(queryRequest, []);
  const mails = [];

  for (const email of userReq) {
    mails.push(email.email);
  }

  const transporter = nodemailer.createTransport({
    service: 'mail.ananievds.ru',
    host: 'mail.ananievds.ru',
    port: 465,
    secure: true,
    auth: {
      user: mail,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: 'info@avalik-avatar.ru',
    to: mails,
    subject: '3 дня до конца акции!',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: auto;">
        <h2 style="color: #000;">3 дня до конца акции!</h2>
        <p style="font-size: 16px; color: #d9534f;"><strong>-50% на всех аватаров!</strong></p>
  
        <p style="font-size: 16px;"><strong>В какой сфере развиваться?</strong></p>
        <p style="font-size: 16px;">Почему у других получается, а у меня нет?</p>
        <p style="font-size: 16px;">Как перестать ссориться с партнёром и наладить отношения?</p>
        <p style="font-size: 16px;">Как вырасти в доходе?</p>
  
        <p style="font-size: 16px;">
          На эти и другие важные вопросы помогают найти ответы <strong>Аватары</strong>.
        </p>
  
        <p style="font-size: 16px;">
          <strong>Аватары</strong> — это разные части вашей личности, которые помогают понимать и управлять своими эмоциями, решениями.
        </p>
        <p style="font-size: 16px;">
          <strong>Аватары — это ключ к пониманию себя.</strong>
        </p>
  
        <p style="font-size: 16px; color: #d9534f;">
          ❗️Только до 20 апреля вы можете получить:
        </p>
  
        <ul style="font-size: 16px; line-height: 1.6;">
          <li>Персональный разбор матрицы по Аватарам</li>
          <li>Или пошаговый план по улучшению одной из сфер жизни:</li>
          <ul>
            <li>💰 Финансов</li>
            <li>❤️ Отношений</li>
            <li>🌟 Реализации</li>
          </ul>
        </ul>
  
        <p style="font-size: 16px;">
          Всё это — <strong>со скидкой 50%</strong>!
        </p>
  
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://avalik-avatar.ru/#services" 
             style="background-color: #fee110; color: white; padding: 14px 24px; text-decoration: none; font-size: 16px; border-radius: 8px; display: inline-block;">
            ЗАБРАТЬ РАЗБОР СО СКИДКОЙ
          </a>
        </div>
  
        <p style="font-size: 16px;">С любовью и верой в вас 💛</p>
      </div>
    `,
  };

   await transporter.sendMail(mailOptions);
}

