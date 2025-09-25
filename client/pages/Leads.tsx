import React, { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { useLeads } from '@/contexts/LeadContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, UserPlus, CheckCircle2 } from 'lucide-react';

export default function Leads() {
  const { leads, addLead, updateLead, deleteLead, convert } = useLeads();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<any>({ status: 'New', priority: 'Medium' });

  const filtered = useMemo(()=> leads.filter(l => {
    const s = l.name.toLowerCase().includes(search.toLowerCase()) || l.contact.toLowerCase().includes(search.toLowerCase());
    const st = status === 'all' || l.status === status as any; return s && st;
  }), [leads, search, status]);

  const submit = async () => {
    if (!form.name || !form.contact) return;
    const payload = { id: `lead_${Date.now()}`, ...form };
    const r = await addLead(payload);
    if (r.success) { setIsAddOpen(false); setForm({ status:'New', priority:'Medium' }); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
            <p className="text-gray-600 mt-1">Track and convert leads</p>
          </div>
          <Button onClick={()=> setIsAddOpen(true)} className="flex items-center space-x-2 bg-blue-600 text-white"><Plus className="w-4 h-4"/><span>Add Lead</span></Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
            <CardDescription>Find leads quickly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input placeholder="Search by name or contact" value={search} onChange={e=> setSearch(e.target.value)} />
              <select className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" value={status} onChange={e=> setStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option>New</option>
                <option>Contacted</option>
                <option>Qualified</option>
                <option>Converted</option>
                <option>Lost</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Contact</th>
                    <th className="text-left py-2 px-3">Source</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Assigned</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium text-gray-900">{l.name}</td>
                      <td className="py-2 px-3">{l.contact}</td>
                      <td className="py-2 px-3">{l.source || '-'}</td>
                      <td className="py-2 px-3">
                        <select value={l.status} onChange={(e)=> updateLead(l.id, { status: e.target.value as any })} className="px-2 py-1 border border-gray-200 rounded text-sm">
                          {['New','Contacted','Qualified','Converted','Lost'].map(s=> <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <Input value={l.assignedTo || ''} onChange={(e)=> updateLead(l.id, { assignedTo: e.target.value })} placeholder="user" />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={()=> convert(l.id)} disabled={l.status==='Converted'} className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/>Convert</Button>
                          <Button size="sm" variant="outline" onClick={()=> deleteLead(l.id)} className="text-red-600 border-red-200"><Trash2 className="w-4 h-4"/></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isAddOpen} onOpenChange={(o)=> { if (!o) setIsAddOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Lead</DialogTitle>
              <DialogDescription>Create a new lead</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name || ''} onChange={e=> setForm((p:any)=> ({...p, name: e.target.value}))} />
                </div>
                <div>
                  <Label>Contact</Label>
                  <Input value={form.contact || ''} onChange={e=> setForm((p:any)=> ({...p, contact: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <select value={form.source || 'Web'} onChange={e=> setForm((p:any)=> ({...p, source: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                    <option>Web</option>
                    <option>Call</option>
                    <option>WhatsApp</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <select value={form.priority || 'Medium'} onChange={e=> setForm((p:any)=> ({...p, priority: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes || ''} onChange={e=> setForm((p:any)=> ({...p, notes: e.target.value}))} placeholder="Notes" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={submit} className="flex-1 bg-blue-600 text-white">Add</Button>
                <Button onClick={()=> setIsAddOpen(false)} variant="outline" className="flex-1">Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
