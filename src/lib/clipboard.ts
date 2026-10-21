/**
 * Copie du texte dans le presse-papiers. Si l'API asynchrone est absente ou
 * refusée (contexte non sécurisé, WebView…), on sélectionne le champ fourni
 * et on tente l'ancienne commande « copy ».
 */
export async function copyText(text: string, field?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // On passe au repli.
  }
  if (!field) return false;
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  }
}
