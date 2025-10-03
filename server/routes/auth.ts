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
      if ((authResult as any).suspended) {
        return res.status(403).json({ success: false, message: 'Your account has been suspended' } as ApiResponse);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      } as ApiResponse);
    }

    // Generate JWT token
    const admin = {
      id: authResult.admin.id.toString(),
      username: String(authResult.admin.username),
      name: String((authResult.admin as any).name || 'Admin'),
      role: String((authResult.admin as any).role || 'admin') as 'central' | 'admin'
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

// Admin management: list admins (central-only)
export const handleViewAdmins: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }
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

// Create admin (central-only)
export const handleCreateAdmin: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }

    const { name, username, password, role } = req.body as { name: string; username: string; password: string; role?: 'central' | 'admin' };

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, username and password are required' } as ApiResponse);
    }

    const ok = await authDB.createAdmin(name, username, password, role === 'central' ? 'central' : 'admin');
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Failed to create admin (maybe username already exists)' } as ApiResponse);
    }
    res.json({ success: true, message: 'Admin created' } as ApiResponse);
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ success: false, message: 'Internal server error' } as ApiResponse);
  }
};

export const handleSuspendAdmin: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }
    const { id } = req.params as { id: string };
    const target = await authDB.getAdminById(id);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found' } as ApiResponse);
    if (target.role === 'central') return res.status(400).json({ success: false, message: 'Cannot suspend central admin' } as ApiResponse);
    const ok = await authDB.setAdminStatus(id, 'suspended');
    return res.json({ success: ok, message: ok ? 'Admin suspended' : 'Failed to suspend admin' } as ApiResponse);
  } catch (e) {
    console.error('Error suspending admin:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' } as ApiResponse);
  }
};

export const handleUnsuspendAdmin: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }
    const { id } = req.params as { id: string };
    const target = await authDB.getAdminById(id);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found' } as ApiResponse);
    const ok = await authDB.setAdminStatus(id, 'active');
    return res.json({ success: ok, message: ok ? 'Admin unsuspended' : 'Failed to unsuspend admin' } as ApiResponse);
  } catch (e) {
    console.error('Error unsuspending admin:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' } as ApiResponse);
  }
};

export const handleDeleteAdmin: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }
    const { id } = req.params as { id: string };
    const target = await authDB.getAdminById(id);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found' } as ApiResponse);
    if (target.role === 'central') return res.status(400).json({ success: false, message: 'Cannot delete central admin' } as ApiResponse);
    const ok = await authDB.deleteAdmin(id);
    return res.json({ success: ok, message: ok ? 'Admin deleted' : 'Failed to delete admin' } as ApiResponse);
  } catch (e) {
    console.error('Error deleting admin:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' } as ApiResponse);
  }
};

export const handleUpdateAdmin: RequestHandler = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'central') {
      return res.status(403).json({ success: false, message: 'Forbidden' } as ApiResponse);
    }
    const { id } = req.params as { id: string };
    const { name, username, password } = req.body as { name?: string; username?: string; password?: string };
    const target = await authDB.getAdminById(id);
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found' } as ApiResponse);
    if (target.role === 'central' && (username || password || name)) {
      // allow changing central's name/username/password? safer: allow only name, but we'll disallow destructive here except name
      if (username || password) return res.status(400).json({ success: false, message: 'Cannot change central admin credentials' } as ApiResponse);
    }
    const ok = await authDB.updateAdmin(id, { name, username, password });
    return res.json({ success: ok, message: ok ? 'Admin updated' : 'Failed to update admin' } as ApiResponse);
  } catch (e) {
    console.error('Error updating admin:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' } as ApiResponse);
  }
};
