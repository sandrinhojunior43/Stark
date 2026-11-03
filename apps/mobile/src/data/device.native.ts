import { Alert, Share } from 'react-native';

export async function saveBackupFile(_name: string, text: string): Promise<void> {
  await Share.share({ message: text });
}
export async function pickBackupFile(): Promise<string | null> {
  throw new Error('A importação de backup está disponível na versão web desta fase.');
}
export function confirmAction(title: string, message: string, action: string): Promise<boolean> {
  return new Promise(resolve => Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
    { text: action, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
export const canImportBackup = false;
