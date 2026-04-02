import { supabase } from '@/integrations/supabase/client';

const PDF_MIME_TYPE = 'application/pdf';

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_');

const toPdfBlob = (payload: unknown) => {
  if (payload instanceof Blob) {
    return payload.type ? payload : new Blob([payload], { type: PDF_MIME_TYPE });
  }

  if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
    return new Blob([payload], { type: PDF_MIME_TYPE });
  }

  if (typeof payload === 'string') {
    return new Blob([payload], { type: PDF_MIME_TYPE });
  }

  throw new Error('Réponse de téléchargement invalide');
};

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

export const downloadInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
  const { data, error } = await supabase.functions.invoke('generate-invoice', {
    body: {
      invoiceId,
      returnBlob: true,
    },
  });

  if (error) throw error;

  const pdfBlob = toPdfBlob(data);
  const fileName = `${sanitizeFileName(invoiceNumber || 'facture')}.pdf`;

  triggerBrowserDownload(pdfBlob, fileName);
};