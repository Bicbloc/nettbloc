import { supabase } from '@/integrations/supabase/client';

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_');

const getInvoiceFunctionUrl = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`;

const requestInvoicePdf = async (invoiceId: string) => {
  const { data } = await supabase.auth.getSession();

  const response = await fetch(getInvoiceFunctionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
    },
    body: JSON.stringify({
      invoiceId,
      returnBlob: true,
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.error || 'Impossible de télécharger la facture');
    }

    const text = await response.text().catch(() => 'Impossible de télécharger la facture');
    throw new Error(text || 'Impossible de télécharger la facture');
  }

  return response.blob();
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
  const pdfBlob = await requestInvoicePdf(invoiceId);
  const fileName = `${sanitizeFileName(invoiceNumber || 'facture')}.pdf`;

  triggerBrowserDownload(pdfBlob, fileName);
};