import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type ConfirmOpts = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptOpts = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
};

let rootEl: HTMLDivElement | null = null;
let root: Root | null = null;
function ensureRoot() {
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = '__imperative_dialog_root';
    document.body.appendChild(rootEl);
    root = createRoot(rootEl);
  }
  return root!;
}

function ConfirmComp({ opts, onClose }: { opts: ConfirmOpts; onClose: (v: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); onClose(false); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.description && <AlertDialogDescription className="whitespace-pre-line">{opts.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setOpen(false); onClose(false); }}>{opts.cancelText || 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            className={opts.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={() => { setOpen(false); onClose(true); }}
          >
            {opts.confirmText || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PromptComp({ opts, onClose }: { opts: PromptOpts; onClose: (v: string | null) => void }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(opts.defaultValue || '');
  const submit = () => { setOpen(false); onClose(value); };
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#__imperative_prompt_input');
      el?.focus(); el?.select();
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); onClose(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opts.title}</DialogTitle>
          {opts.description && <DialogDescription>{opts.description}</DialogDescription>}
        </DialogHeader>
        <Input
          id="__imperative_prompt_input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={opts.placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); onClose(null); }}>{opts.cancelText || 'Cancelar'}</Button>
          <Button onClick={submit}>{opts.confirmText || 'OK'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const queue: React.ReactNode[] = [];
function render() {
  const r = ensureRoot();
  r.render(<>{queue.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}</>);
}

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const node = (
      <ConfirmComp
        opts={opts}
        onClose={(v) => {
          const idx = queue.indexOf(node);
          if (idx >= 0) queue.splice(idx, 1);
          render();
          resolve(v);
        }}
      />
    );
    queue.push(node);
    render();
  });
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    const node = (
      <PromptComp
        opts={opts}
        onClose={(v) => {
          const idx = queue.indexOf(node);
          if (idx >= 0) queue.splice(idx, 1);
          render();
          resolve(v);
        }}
      />
    );
    queue.push(node);
    render();
  });
}
