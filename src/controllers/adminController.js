import dotenv from 'dotenv';
dotenv.config();

import { query } from '../models/db.js';

export const getUsers = async (req, res) => {
  const result = await query('SELECT id, email,is_confirmed, is_admin  FROM users', []);
  res.status(200).json({ date: result });
};
export const saveUsers = (req, res) => {

};
export const getPeoples = async (req, res) => {
  const { id } = req.body;
  const result = await query('SELECT *  FROM people WHERE user_id= ?', [id]);
  res.status(200).json({ date: result });

};
export const getPeople = (req, res) => {

};
export const savePeople = (req, res) => {

};

export const getAvatar = async (req, res) => {
  const { id } = req.body;
  const result = await query('SELECT *  FROM avatars WHERE person_id= ?', [id]);
  res.status(200).json({ date: result });
};

export const setPreview = async (req, res) => {
  const { id } = req.body;
  const [result] = await query('SELECT *  FROM avatars WHERE id= ?', [id]);
  console.log(result);
  const peopleId = result.person_id;
  await query('UPDATE avatars SET preview = 1 WHERE id = ?', [id]);

  const totalResult = await query('SELECT *  FROM avatars WHERE person_id= ?', [peopleId]);

  res.status(200).json({ date: totalResult });
};

export const setAll= async (req, res) => {
  const { id } = req.body;
  const [result] = await query('SELECT *  FROM avatars WHERE id= ?', [id]);
  const peopleId = result.person_id;
  await query('UPDATE avatars SET purchased = 1 WHERE id = ?', [id]);

  const totalResult = await query('SELECT *  FROM avatars WHERE person_id= ?', [peopleId]);

  res.status(200).json({ date: totalResult });
};
