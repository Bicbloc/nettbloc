UPDATE public.invoices 
SET payment_method = 'gocardless_direct_debit',
    payment_reference = 'PM-0001-GC-2026'
WHERE invoice_number = 'BB-2026-0001' 
  AND user_id = '6f0b2a40-afe8-4a61-96c5-63435877e6e6';