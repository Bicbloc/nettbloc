import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type EquipmentCondition = 'new' | 'good' | 'worn' | 'broken' | 'missing' | 'to_replace';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type IssueType = 'to_repair' | 'to_replace' | 'missing' | 'damaged' | 'other';

export interface Building {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface CommonSpace {
  id: string;
  hotel_id: string;
  building_id: string | null;
  name: string;
  space_type: string;
  floor: number | null;
  area_sqm: number | null;
  description: string | null;
  photo_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface EquipmentCategory {
  id: string;
  hotel_id: string;
  name: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Equipment {
  id: string;
  hotel_id: string;
  room_registry_id: string | null;
  common_space_id: string | null;
  category_id: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  reference: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  purchase_price: number | null;
  supplier: string | null;
  photo_url: string | null;
  condition: EquipmentCondition;
  quantity: number;
  notes: string | null;
}

export interface EquipmentIssue {
  id: string;
  hotel_id: string;
  equipment_id: string | null;
  room_registry_id: string | null;
  common_space_id: string | null;
  incident_id: string | null;
  issue_type: IssueType;
  title: string;
  description: string | null;
  reported_by_name: string | null;
  reported_at: string;
  status: IssueStatus;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface RoomCharacteristics {
  id: string;
  hotel_id: string;
  room_registry_id: string;
  template_id: string | null;
  bed_type: string | null;
  bed_dimensions: string | null;
  bed_count: number | null;
  bathroom_type: string | null;
  has_bathtub: boolean | null;
  has_shower: boolean | null;
  desk_dimensions: string | null;
  room_area_sqm: number | null;
  view_type: string | null;
  amenities: string[];
  custom_fields: Record<string, any>;
  notes: string | null;
}

export interface RoomTypeTemplate {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  default_characteristics: Record<string, any>;
  default_amenities: string[];
  default_equipments: any[];
}

export function useEquipment(hotelId: string | null) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [spaces, setSpaces] = useState<CommonSpace[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [issues, setIssues] = useState<EquipmentIssue[]>([]);
  const [templates, setTemplates] = useState<RoomTypeTemplate[]>([]);
  const [characteristics, setCharacteristics] = useState<RoomCharacteristics[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hotelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [b, s, c, e, i, t, rc] = await Promise.all([
        supabase.from('buildings').select('*').eq('hotel_id', hotelId).order('display_order'),
        supabase.from('common_spaces').select('*').eq('hotel_id', hotelId).order('display_order'),
        supabase.from('equipment_categories').select('*').eq('hotel_id', hotelId).order('display_order'),
        supabase.from('equipments').select('*').eq('hotel_id', hotelId).order('name'),
        supabase.from('equipment_issues').select('*').eq('hotel_id', hotelId).neq('status', 'resolved').order('reported_at', { ascending: false }),
        supabase.from('room_type_templates').select('*').eq('hotel_id', hotelId).order('name'),
        supabase.from('room_characteristics').select('*').eq('hotel_id', hotelId),
      ]);
      const firstError = [b, s, c, e, i, t, rc].find((r) => r.error)?.error;
      if (firstError) throw firstError;
      setBuildings((b.data as any) || []);
      setSpaces((s.data as any) || []);
      setCategories((c.data as any) || []);
      setEquipments((e.data as any) || []);
      setIssues((i.data as any) || []);
      setTemplates((t.data as any) || []);
      setCharacteristics((rc.data as any) || []);
    } catch (err: any) {
      console.error('useEquipment refresh error', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refresh open issues so the plan stays in sync
  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase
      .channel(`equip-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_issues', filter: `hotel_id=eq.${hotelId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipments', filter: `hotel_id=eq.${hotelId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, refresh]);

  // Helpers
  const issuesForRoom = useCallback((roomRegistryId: string) =>
    issues.filter(i => i.room_registry_id === roomRegistryId), [issues]);
  const issuesForSpace = useCallback((spaceId: string) =>
    issues.filter(i => i.common_space_id === spaceId), [issues]);
  const equipmentsForRoom = useCallback((roomRegistryId: string) =>
    equipments.filter(e => e.room_registry_id === roomRegistryId), [equipments]);
  const equipmentsForSpace = useCallback((spaceId: string) =>
    equipments.filter(e => e.common_space_id === spaceId), [equipments]);
  const characteristicsForRoom = useCallback((roomRegistryId: string) =>
    characteristics.find(c => c.room_registry_id === roomRegistryId) || null, [characteristics]);

  // Mutations
  const upsertEquipment = async (e: Partial<Equipment> & { hotel_id: string; name: string }) => {
    const { data, error } = e.id
      ? await supabase.from('equipments').update(e).eq('id', e.id).select().single()
      : await supabase.from('equipments').insert(e as any).select().single();
    if (error) throw error;
    await refresh();
    return data;
  };

  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from('equipments').delete().eq('id', id);
    if (error) throw error;
    await refresh();
  };

  const createIssue = async (issue: Partial<EquipmentIssue> & { hotel_id: string; title: string }) => {
    const { data, error } = await supabase.from('equipment_issues').insert(issue as any).select().single();
    if (error) throw error;
    await refresh();
    return data;
  };

  const resolveIssue = async (id: string, notes?: string) => {
    const { error } = await supabase.from('equipment_issues').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_notes: notes ?? null,
    }).eq('id', id);
    if (error) throw error;
    await refresh();
  };

  const upsertCharacteristics = async (c: Partial<RoomCharacteristics> & { hotel_id: string; room_registry_id: string }) => {
    const { error } = await supabase.from('room_characteristics').upsert(c as any, { onConflict: 'room_registry_id' });
    if (error) throw error;
    await refresh();
  };

  return {
    loading,
    buildings,
    spaces,
    categories,
    equipments,
    issues,
    templates,
    characteristics,
    refresh,
    issuesForRoom,
    issuesForSpace,
    equipmentsForRoom,
    equipmentsForSpace,
    characteristicsForRoom,
    upsertEquipment,
    deleteEquipment,
    createIssue,
    resolveIssue,
    upsertCharacteristics,
  };
}
