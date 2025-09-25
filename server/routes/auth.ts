import { RequestHandler } from 'express';
import { LoginRequest, LoginResponse, ApiResponse } from '@shared/api';
import { generateToken } from '../middleware/auth';
import { authDB } from '../database/db';

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { username, password }: LoginRequest = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      } as ApiResponse);
    }

    // Verify credentials using database with hashed passwords
    const authResult = await authDB.verifyAdmin(username, password);

    if (!authResult.success || !authResult.admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      } as ApiResponse);
    }

    // Generate JWT token
    const admin = {
      id: authResult.admin.id.toString(),
      username: authResult.admin.username
    };

    const token = generateToken(admin);

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        admin
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const handleLogout: RequestHandler = (req, res) => {
  // In a more sophisticated setup, you might maintain a blacklist of tokens
  // For now, we'll just send a success response as the client will remove the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  } as ApiResponse);
};

export const handleProfile: RequestHandler = (req, res) => {
  // This endpoint requires authentication middleware
  res.json({
    success: true,
    data: req.admin
  } as ApiResponse);
};

export const handleChangePassword: RequestHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminUsername = req.admin?.username;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      } as ApiResponse);
    }

    if (!adminUsername) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      } as ApiResponse);
    }

    // Verify current password
    const authResult = await authDB.verifyAdmin(adminUsername, currentPassword);
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      } as ApiResponse);
    }

    // Update to new password
    const success = await authDB.updateAdminPassword(adminUsername, newPassword);

    if (success) {
      res.json({
        success: true,
        message: 'Password updated successfully'
      } as ApiResponse);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update password'
      } as ApiResponse);
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

// Debug endpoint to view admin table data
export const handleViewAdmins: RequestHandler = async (req, res) => {
  try {
    const admins = await authDB.getAllAdmins();
    res.json({
      success: true,
      data: admins,
      message: `Found ${admins.length} admin(s) in database`
    } as ApiResponse);
  } catch (error) {
    console.error('Error viewing admins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};
