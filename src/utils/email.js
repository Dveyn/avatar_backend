import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';


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
  });

  const mailOptions = {
    from: mail,
    to: email,
    subject: 'Подтверждение регистрации',
    html: `<p>Для подтверждения вашей почты перейдите по <a href="https://avalik-avatar.ru/confirm-email/${token}">ссылке</a></p>`,
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
  });

  const mailOptions = {
    from: 'info@avalik-avatar.ru',
    to: [ 'kimavalik@gmail.com', 'info@avalik-avatar.ru'],
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
            <p style="margin: 0 0 10px;"><strong>Дата консультации:</strong> ${date}</p>
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
