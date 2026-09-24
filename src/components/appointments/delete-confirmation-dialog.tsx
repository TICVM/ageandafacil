'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  cancelText?: string
  confirmText?: string
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Excluir Registro?',
  description = 'Deseja realmente remover este agendamento do sistema?',
  cancelText = 'Voltar',
  confirmText = 'Sim, Excluir Registro',
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="z-[200] mx-auto max-w-sm rounded-3xl border-none p-10 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-10 w-10" />
          </div>

          <DialogTitle className="text-2xl font-bold text-slate-800">
            {title}
          </DialogTitle>

          <DialogDescription className="mt-2 text-base leading-relaxed text-slate-500">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-14 flex-1 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-600 transition-colors hover:bg-slate-100"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            className="h-14 flex-1 rounded-2xl bg-destructive font-bold text-white shadow-lg shadow-destructive/20 transition-all hover:bg-destructive/90 active:scale-95"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}