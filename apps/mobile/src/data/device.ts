// Ações que dependem da plataforma, versão web. No nativo, o Metro usa device.native.ts.
import { MAX_BACKUP_BYTES } from './state';

export async function saveBackupFile(name: string, text: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  try {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** Abre o seletor de arquivos. Resolve `null` se a pessoa cancelar. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > MAX_BACKUP_BYTES) { reject(new Error('O arquivo é grande demais para ser um backup do STARK.')); return; }
      file.text().then(resolve, () => reject(new Error('Não foi possível ler o arquivo.')));
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function confirmAction(title: string, message: string, _action: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

export const canImportBackup = true;
