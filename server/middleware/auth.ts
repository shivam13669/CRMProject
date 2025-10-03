import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request type to include admin property
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        username: string;
        name: string;
        role: 'central' | 'admin';
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_crm_secret_key_change_in_production';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    req.admin = decoded as { id: string; username: string; name: string; role: 'central' | 'admin' };
    next();
  });
};

export const generateToken = (admin: { id: string; username: string; name: string; role: 'central' | 'admin' }) => {
  return jwt.sign(admin, JWT_SECRET, { expiresIn: '24h' });
};
