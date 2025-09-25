import React, { useEffect, useState } from 'react';
import { Customer } from '@shared/api';
import { useCustomers } from '@/contexts/CustomerContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { normalizeContact } from '@/utils/phone';
import { formatDateLocalISO, computeExpiryDate } from '@/utils/dateUtils';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCustomerModal({ isOpen, onClose }: AddCustomerModalProps) {
  const { addCustomer, addHistory } = useCustomers();
  const [formData, setFormData] = useState<Partial<Customer>>({
    status: 'Active',
    familyType: 'Individual',
    membership: 'Silver',
    joinDate: formatDateLocalISO(new Date()),
  });
  const [tagsText, setTagsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success'|'error'>('success');

  useEffect(() => {
    if (!isOpen) {
      setFormData({ status: 'Active', familyType: 'Individual', membership: 'Silver', joinDate: formatDateLocalISO(new Date()), expireDate: '' });
      setTagsText('');
      setMessage('');
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      if (!formData.regId || !formData.name || !formData.contact) {
        setMessage('Reg ID, Name, and Contact are required fields.');
        setMessageType('error');
        setIsSaving(false);
        return;
      }
      const payload: any = {
        ...formData,
        contact: normalizeContact(formData.contact || ''),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
      } as Customer;
      if (payload.joinDate && !payload.expireDate) {
        const e = computeExpiryDate(payload.joinDate);
        if (e) payload.expireDate = e;
      }
      const result = await addCustomer(payload);
      if (result.success) {
        setMessage('Customer added successfully!');
        setMessageType('success');
        // optional history entry
        try {
          // addHistory requires customerId; server returns data? not here, skip for now
        } catch {}
        setTimeout(() => {
          onClose();
          setMessage('');
        }, 1000);
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (e) {
      setMessage('Failed to add customer');
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open)=>{ if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>Enter new customer information.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {message && (
            <Alert className={messageType === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
              {messageType === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={messageType === 'error' ? 'text-red-800' : 'text-green-800'}>
                {message}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="regId">Reg ID *</Label>
              <Input id="regId" value={formData.regId || ''} onChange={handleInputChange('regId')} placeholder="Registration ID" />
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={formData.name || ''} onChange={handleInputChange('name')} placeholder="Customer Name" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact">Contact *</Label>
              <Input id="contact" value={formData.contact || ''} onChange={handleInputChange('contact')} placeholder="Phone Number" />
            </div>
            <div>
              <Label htmlFor="salesmanId">Salesman ID</Label>
              <Input id="salesmanId" value={formData.salesmanId || ''} onChange={handleInputChange('salesmanId')} placeholder="Salesman ID" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" value={formData.status || 'Active'} onChange={handleInputChange('status')} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label htmlFor="familyType">Family Type</Label>
              <select id="familyType" value={formData.familyType || 'Individual'} onChange={handleInputChange('familyType')} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                <option value="Individual">Individual</option>
                <option value="Family">Family</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="membership">Membership</Label>
              <select id="membership" value={formData.membership || 'Silver'} onChange={handleInputChange('membership')} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            <div>
              <Label htmlFor="joinDate">Join Date</Label>
              <Input id="joinDate" type="date" value={formData.joinDate || ''} onChange={handleInputChange('joinDate')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expireDate">Expire Date (optional)</Label>
              <Input id="expireDate" type="date" value={(formData as any).expireDate || ''} onChange={handleInputChange('expireDate' as any)} />
            </div>
          </div>

          <div>
            <Label htmlFor="familyMembers">Family Members</Label>
            <Input id="familyMembers" value={formData.familyMembers || ''} onChange={handleInputChange('familyMembers')} placeholder="e.g., No family, 3 members, etc." />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={(formData as any).notes || ''} onChange={handleInputChange('notes' as any)} placeholder="Add internal notes..." />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g., High Priority, Follow-up" />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Saving...' : 'Add Customer'}
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
