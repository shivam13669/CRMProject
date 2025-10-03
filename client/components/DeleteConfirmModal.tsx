import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  isDeleting?: boolean;
}

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = "Delete",
  isDeleting = false 
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open)=>{ if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-gray-900">{title}</DialogTitle>
              <DialogDescription className="text-gray-600 mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex space-x-2 pt-4">
          <Button 
            onClick={onConfirm} 
            disabled={isDeleting}
            variant="destructive"
            className="flex-1"
          >
            {isDeleting ? 'Deleting...' : confirmText}
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
