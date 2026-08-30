import { ServerProfileDialog } from './ServerProfileDialog'

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  return <ServerProfileDialog mode="add" open={open} onOpenChange={onOpenChange} />
}
