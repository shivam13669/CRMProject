import React, { useState, useEffect } from 'react';
import { Customer } from '@shared/api';
import { useCustomers } from '@/contexts/CustomerContext';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { normalizeContact } from '@/utils/phone';
import { computeExpiryDate } from '@/utils/dateUtils';

interface EditCustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditCustomerModal({ customer, isOpen, onClose }: EditCustomerModalProps) {
  const { updateCustomer, listDocuments, uploadDocument, deleteDocument, getHistory, addHistory } = useCustomers();
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [tagsText, setTagsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [docs, setDocs] = useState<any[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('Aadhaar');
  const [docNumber, setDocNumber] = useState<string>('');
  const [otherDocType, setOtherDocType] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyNote, setHistoryNote] = useState('');
  const [stagedUploads, setStagedUploads] = useState<{ id: string; file: File; label: string; filename: string }[]>([]);

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatPAN = (value: string) => {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  };

  useEffect(() => {
    if (customer) {
      setFormData({
        regId: customer.regId,
        name: customer.name,
        contact: customer.contact,
        salesmanId: customer.salesmanId,
        status: customer.status,
        familyType: customer.familyType,
        familyMembers: customer.familyMembers,
        joinDate: customer.joinDate,
        expireDate: (customer as any).expireDate || '',
        membership: customer.membership,
        ...(customer as any).notes ? { notes: (customer as any).notes } : {},
      });
      const t = Array.isArray((customer as any).tags) ? (customer as any).tags.join(', ') : String((customer as any).tags || '');
      setTagsText(t);
      // load documents & history
      listDocuments(customer.id).then(setDocs).catch(() => setDocs([]));
      getHistory(customer.id).then(setHistory).catch(()=> setHistory([]));
      // reset document inputs when opening for a customer
      setDocType('Aadhaar');
      setDocNumber('');
      setOtherDocType('');
      setDocFile(null);
      setStagedUploads([]);
    }
  }, [customer, listDocuments]);

  const handleInputChange = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSave = async () => {
    if (!customer) return;

    setIsSaving(true);
    setMessage('');

    try {
      // Validate required fields
      if (!formData.regId || !formData.name || !formData.contact) {
        setMessage('Reg ID, Name, and Contact are required fields.');
        setMessageType('error');
        setIsSaving(false);
        return;
      }

      // Update the customer
      const payload: any = {
        ...formData,
        contact: normalizeContact(formData.contact || ''),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean)
      };
      if (!payload.expireDate && payload.joinDate) {
        const e = computeExpiryDate(payload.joinDate);
        if (e) payload.expireDate = e;
      }
      const result = await updateCustomer(customer.id, payload as any);

      if (!result.success) {
        setMessage(`Error: ${result.message}`);
        setMessageType('error');
        setIsSaving(false);
        return;
      }

      // After details saved, process staged document uploads (if any)
      if (stagedUploads.length > 0) {
        for (const item of stagedUploads) {
          const res = await uploadDocument(customer.id, item.file, item.label);
          if (!res.success) {
            setMessage(res.message || 'Failed to upload one or more documents');
            setMessageType('error');
            // continue to attempt remaining uploads
          }
        }
        // refresh documents list
        setDocs(await listDocuments(customer.id));
        setStagedUploads([]);
      }

      setMessage('Customer updated successfully!');
      setMessageType('success');

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setMessage('');
      }, 1500);
    } catch (error) {
      setMessage('Error updating customer. Please try again.');
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      // Reset transient state on close so nothing persists after Cancel
      setMessage('');
      setDocType('Aadhaar');
      setDocNumber('');
      setOtherDocType('');
      setDocFile(null);
      setStagedUploads([]);
      setHistoryNote('');
      onClose();
    }
  };

  if (!customer) return null;

  const docLimitReached = docs.length > 0 || stagedUploads.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer information below.
          </DialogDescription>
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
              <Input
                id="regId"
                value={formData.regId || ''}
                onChange={handleInputChange('regId')}
                placeholder="Registration ID"
              />
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={handleInputChange('name')}
                placeholder="Customer Name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact">Contact *</Label>
              <Input
                id="contact"
                value={formData.contact || ''}
                onChange={handleInputChange('contact')}
                placeholder="Phone Number"
              />
            </div>
            <div>
              <Label htmlFor="salesmanId">Salesman ID</Label>
              <Input
                id="salesmanId"
                value={formData.salesmanId || ''}
                onChange={handleInputChange('salesmanId')}
                placeholder="Salesman ID"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status || 'Active'}
                onChange={handleInputChange('status')}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label htmlFor="familyType">Family Type</Label>
              <select
                id="familyType"
                value={formData.familyType || 'Individual'}
                onChange={handleInputChange('familyType')}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
              >
                <option value="Individual">Individual</option>
                <option value="Family">Family</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="membership">Membership</Label>
              <select
                id="membership"
                value={formData.membership || 'Silver'}
                onChange={handleInputChange('membership')}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
              >
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            <div>
              <Label htmlFor="joinDate">Join Date</Label>
              <Input
                id="joinDate"
                type="date"
                value={formData.joinDate || ''}
                onChange={handleInputChange('joinDate')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expireDate">Expire Date (optional)</Label>
              <Input
                id="expireDate"
                type="date"
                value={(formData as any).expireDate || ''}
                onChange={handleInputChange('expireDate' as any)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="familyMembers">Family Members</Label>
            <Input
              id="familyMembers"
              value={formData.familyMembers || ''}
              onChange={handleInputChange('familyMembers')}
              placeholder="e.g., No family, 3 members, etc."
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={(formData as any).notes || ''} onChange={handleInputChange('notes' as any)} placeholder="Add internal notes..." />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g., High Priority, Follow-up" />
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Label>Documents</Label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={docType} onChange={(e)=>{ setDocType(e.target.value); setDocNumber(''); setOtherDocType(''); }} className="px-2 py-1 border border-gray-200 rounded text-sm" disabled={docLimitReached}>
                <option value="Aadhaar">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="Other">Other</option>
              </select>
              {docType === 'Aadhaar' && (
                <Input
                  placeholder="Aadhaar Number"
                  value={docNumber}
                  onChange={(e)=> setDocNumber(formatAadhaar(e.target.value))}
                  inputMode="numeric"
                  maxLength={14}
                  className="max-w-[220px]"
                  disabled={docLimitReached}
                />
              )}
              {docType === 'PAN' && (
                <Input
                  placeholder="PAN Number"
                  value={docNumber}
                  onChange={(e)=> setDocNumber(formatPAN(e.target.value))}
                  maxLength={10}
                  className="max-w-[220px] uppercase"
                  disabled={docLimitReached}
                />
              )}
              {docType === 'Other' && (
                <>
                  <Input placeholder="Document Type" value={otherDocType} onChange={(e)=> setOtherDocType(e.target.value)} className="max-w-[220px]" disabled={docLimitReached} />
                  <Input placeholder="Document Number" value={docNumber} onChange={(e)=> setDocNumber(e.target.value)} className="max-w-[220px]" disabled={docLimitReached} />
                </>
              )}
              <input type="file" onChange={(e)=> setDocFile(e.target.files?.[0] || null)} className="text-sm" disabled={docLimitReached} />
              <Button
                size="sm"
                disabled={docLimitReached || isUploading || !docFile || (docType === 'Aadhaar' && !docNumber) || (docType === 'PAN' && !docNumber) || (docType === 'Other' && (!otherDocType || !docNumber))}
                onClick={()=> {
                  if (docLimitReached) { setMessage('Only one document allowed. Delete existing to upload another.'); setMessageType('error'); return; }
                  if (!customer || !docFile) { setMessage('Please choose a file.'); setMessageType('error'); return; }
                  if (docType === 'Aadhaar' && !docNumber) { setMessage('Please enter Aadhaar number.'); setMessageType('error'); return; }
                  if (docType === 'PAN' && !docNumber) { setMessage('Please enter PAN number.'); setMessageType('error'); return; }
                  if (docType === 'Other' && (!otherDocType || !docNumber)) { setMessage('Please enter document type and number.'); setMessageType('error'); return; }
                  const label = docType === 'Aadhaar' ? `Aadhaar: ${docNumber}` : docType === 'PAN' ? `PAN: ${docNumber.trim().toUpperCase()}` : `Other (${otherDocType}): ${docNumber}`;
                  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  setStagedUploads(prev => prev.length ? prev : [...prev, { id, file: docFile, label, filename: docFile.name }]);
                  setDocFile(null);
                  setDocNumber('');
                  setOtherDocType('');
                  setMessage('Document staged. Click Save Changes to upload.');
                  setMessageType('success');
                }}
              >Add to Uploads</Button>
              {docLimitReached && (
                <span className="text-xs text-gray-500">Only 1 document allowed per customer. Delete to replace.</span>
              )}
            </div>

            {stagedUploads.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-gray-700 mb-1">Pending Upload</div>
                <ul className="divide-y divide-gray-200 border rounded-md">
                  {stagedUploads.slice(0,1).map(item => (
                    <li key={item.id} className="p-2 flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full border text-xs break-all">{item.label}</span>
                        <span className="break-all text-gray-700">{item.filename}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={()=> setStagedUploads([])}>Remove</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3">
              {docs.length > 0 && (
                <>
                  <div className="text-sm font-medium text-gray-700 mb-1">Existing Documents</div>
                  <ul className="divide-y divide-gray-200 border rounded-md">
                    {docs.map((d) => (
                      <li key={d.id} className="p-2 flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-full border text-xs break-all">{d.type}</span>
                          <a href={d.url || (`/uploads/${String((d.filepath || '').split(/[/\\]/).pop() || '')}`)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{d.filename}</a>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={async ()=>{ await deleteDocument(d.id); const list = await listDocuments(customer!.id); setDocs(list); }}>Delete</Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Label>History</Label>
            <div className="mt-2 space-y-2">
              <div className="flex space-x-2">
                <Input placeholder="Add a note (interaction)" value={historyNote} onChange={(e)=> setHistoryNote(e.target.value)} />
                <Button size="sm" onClick={async ()=>{ if (!customer || !historyNote) return; const res = await addHistory(customer.id, 'Note', historyNote); if (res.success) { setHistory(await getHistory(customer.id)); setHistoryNote(''); } }}>Add</Button>
              </div>
              {history.length > 0 ? (
                <ul className="divide-y divide-gray-200 border rounded-md">
                  {history.map((h)=> (
                    <li key={h.id} className="p-2 text-sm flex items-center justify-between">
                      <span className="text-gray-700">{h.action}{h.note ? ': ' + h.note : ''}</span>
                      <span className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No history yet.</p>
              )}
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              onClick={() => handleDialogOpenChange(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
