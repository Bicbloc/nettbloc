import { supabase } from '@/integrations/supabase/client';

export type WebhookProvider = 'slack' | 'zapier' | 'generic';

export const WEBHOOK_EVENTS = [
  { value: 'incident.created', label: 'Incident créé' },
  { value: 'incident.updated', label: 'Incident mis à jour' },
  { value: 'lost_found.created', label: 'Objet trouvé créé' },
  { value: 'task.created', label: 'Ticket / tâche créé' },
  { value: 'task.updated', label: 'Tâche mise à jour' },
  { value: 'report.created', label: 'Rapport quotidien créé' },
] as const;

export interface HotelWebhook {
  id: string;
  hotel_id: string;
  name: string;
  provider: WebhookProvider;
  target_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadWebhooks(hotelId: string): Promise<HotelWebhook[]> {
  const { data, error } = await supabase
    .from('hotel_webhooks')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HotelWebhook[];
}

export async function createWebhook(
  hotelId: string,
  webhook: { name: string; provider: WebhookProvider; target_url: string; events: string[] },
): Promise<HotelWebhook> {
  const { data, error } = await supabase
    .from('hotel_webhooks')
    .insert({ hotel_id: hotelId, ...webhook })
    .select()
    .single();
  if (error) throw error;
  return data as HotelWebhook;
}

export async function updateWebhook(
  id: string,
  patch: Partial<Pick<HotelWebhook, 'name' | 'provider' | 'target_url' | 'events' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase.from('hotel_webhooks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase.from('hotel_webhooks').delete().eq('id', id);
  if (error) throw error;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: string;
  response_code: number | null;
  error: string | null;
  created_at: string;
}

export async function loadDeliveries(hotelId: string): Promise<WebhookDelivery[]> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, event_type, status, response_code, error, created_at')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as WebhookDelivery[];
}
