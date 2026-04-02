INSERT INTO public.invoices (
  user_id, invoice_number, invoice_date, 
  amount_ht, tva_rate, tva_amount, amount_ttc,
  plan_type, plan_name, period_start, period_end,
  customer_email, customer_billing_email,
  seller_name, seller_siret, seller_address, seller_email,
  payment_reference, payment_method, status
) VALUES (
  '6f0b2a40-afe8-4a61-96c5-63435877e6e6',
  'BB-2026-0001',
  '2026-04-02',
  4900, 20.00, 980, 5880,
  'essentiel', 'Essentiel', '2026-04-02', '2026-05-02',
  'aminekhellas2@gmail.com', 'aminekhellas2@gmail.com',
  'BicBloc', '97864605700015', '60 RUE FRANCOIS IER, 75008 PARIS', 'support@bicbloc.eu',
  'pi_3QxYz1234567890', 'card', 'paid'
);