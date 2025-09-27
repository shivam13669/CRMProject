import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminUsers() {
  const { admin, token } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!admin) return null;
  if (admin.role !== 'central') {
    return <Navigate to="/dashboard" replace />;
  }

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
          'Authorization': 'Bearer ${token}',
        },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Admin created successfully' });
        setForm({ name: '', username: '', password: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create admin' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create admin' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
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
              <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? 'Creating...' : 'Create Admin'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}