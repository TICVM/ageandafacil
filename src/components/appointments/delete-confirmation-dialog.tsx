'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Excluir Registro?",
  description = "Deseja realmente remover este agendamento do sistema?",
  cancelText = "Voltar",
  confirmText = "Sim, Excluir Registro"
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-3xl p-10 border-none shadow-2xl max-w-sm mx-auto z-[200]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <AlertDialogHeader className="flex flex-col items-center">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
            <Trash2 className="w-10 h-10" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-center text-slate-800">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base text-slate-500 mt-2 leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-10 flex flex-row gap-4 sm:justify-center">
          <AlertDialogCancel onClick={onClose} className="flex-1 rounded-2xl h-14 border-slate-100 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="flex-1 bg-destructive text-white hover:bg-destructive/90 rounded-2xl h-14 font-bold shadow-lg shadow-destructive/20 transition-all active:scale-95"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
