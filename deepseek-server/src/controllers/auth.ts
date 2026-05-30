import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user';
import dotenv from 'dotenv';
import { Request, Response } from 'express';

dotenv.config();

const AuthController = {
  async register(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ message: '请填写所有必填字段' });
      }

      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: '邮箱已被注册' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await UserModel.create(username, email, passwordHash);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });

      res.status(201).json({
        message: '注册成功',
        token,
        user: {
          id: userId,
          username,
          email
        }
      });
    } catch (error) {
      console.error('注册错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: '请填写邮箱和密码' });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  },

  async getProfile(req: Request, res: Response) {
    try {
      const user = await UserModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }
      res.json({ user });
    } catch (error) {
      console.error('获取用户信息错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }
};

export default AuthController;
