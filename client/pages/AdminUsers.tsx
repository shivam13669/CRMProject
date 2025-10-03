import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminRow {
  id: string;
  name: string;
  username: string;
  role: 'central' | 'admin';
  status: 'active' | 'suspended';
}

export default function AdminUsers() {
  const { admin, token } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [edit, setEdit] = useState<{ open: boolean; id?: string; name?: string; username?: string; password?: string }>({ open: false });

  if (!admin) return null;
  if (admin.role !== 'central') {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchAdmins = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/auth/admins', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) setAdmins((data.data || []).filter((a: AdminRow) => a.role !== 'central'));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleChange = (field: 'name' | 'username' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Admin created successfully' });
        setForm({ name: '', username: '', password: '' });
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create admin' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create admin' });
    } finally {
      setIsSaving(false);
    }
  };

  const suspend = async (id: string) => {
    await fetch(`/api/auth/admins/${id}/suspend`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fetchAdmins();
  };
  const unsuspend = async (id: string) => {
    await fetch(`/api/auth/admins/${id}/unsuspend`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fetchAdmins();
  };
  const del = async (id: string) => {
    await fetch(`/api/auth/admins/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchAdmins();
  };
  const openEdit = (row: AdminRow) => setEdit({ open: true, id: row.id, name: row.name, username: row.username, password: '' });
  const saveEdit = async () => {
    if (!edit.id) return;
    await fetch(`/api/auth/admins/${edit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: edit.name, username: edit.username, password: edit.password || undefined })
    });
    setEdit({ open: false });
    fetchAdmins();
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Admin User</CardTitle>
            <CardDescription>Only Central Admin can create new admin users.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {message && (
                <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                  <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                    {message.text}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={handleChange('name')} placeholder="Full name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={form.username} onChange={handleChange('username')} placeholder="Email or username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={handleChange('password')} placeholder="Set a password" required />
                </div>
              </div>
              <Button type="submit" disabled={isSaving}
                className="w-full md:w-auto">{isSaving ? 'Creating...' : 'Create Admin'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Admins</CardTitle>
            <CardDescription>Manage admin accounts: suspend, delete, or edit details.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <p>Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Username</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id} className="border-t">
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="py-2 pr-4">{a.username}</td>
                        <td className="py-2 pr-4 capitalize">{a.role}</td>
                        <td className="py-2 pr-4 capitalize">{a.status}</td>
                        <td className="py-2 pr-4 space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(a)} disabled={a.role==='central'}>Edit</Button>
                          {a.status === 'active' ? (
                            <Button variant="outline" size="sm" onClick={() => suspend(a.id)} disabled={a.role==='central'}>Suspend</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => unsuspend(a.id)} disabled={a.role==='central'}>Unsuspend</Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => del(a.id)} disabled={a.role==='central'}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={edit.open} onOpenChange={(open)=> setEdit(prev => ({ ...prev, open }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={edit.name || ''} onChange={e => setEdit(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>Username</Label>
                <Input value={edit.username || ''} onChange={e => setEdit(prev => ({ ...prev, username: e.target.value }))} />
              </div>
              <div>
                <Label>New Password (optional)</Label>
                <Input type="password" value={edit.password || ''} onChange={e => setEdit(prev => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" onClick={() => setEdit({ open: false })}>Cancel</Button>
                <Button onClick={saveEdit}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
