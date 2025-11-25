import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysisResult {
  suggestedTitle: string;
  category: string;
  item: string;
  type: string;
  description: string;
  confidence: number;
  isNewItem: boolean;
}

export const useIncidentAI = (hotelId: string) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeImage = async (imageFile: File): Promise<AIAnalysisResult | null> => {
    setIsAnalyzing(true);
    
    try {
      // Convertir l'image en base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      console.log('🔍 Envoi de l\'image pour analyse IA...');

      // Appel à l'edge function
      const { data, error } = await supabase.functions.invoke('analyze-incident', {
        body: { 
          imageBase64: base64,
          hotelId 
        }
      });

      if (error) {
        console.error('❌ Erreur edge function:', error);
        throw error;
      }

      console.log('✅ Analyse IA reçue:', data);

      // Si c'est un nouvel item détecté, créer l'item dans la base
      if (data.isNewItem) {
        await createNewItem(data.category, data.item);
      }

      toast({
        title: '🤖 Analyse IA terminée',
        description: `Confiance: ${Math.round(data.confidence * 100)}%`,
      });

      return data;
    } catch (error) {
      console.error('❌ Erreur analyse IA:', error);
      toast({
        title: 'Erreur analyse IA',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createNewItem = async (categoryName: string, itemName: string) => {
    try {
      // Chercher la catégorie "Autre" ou créer si nécessaire
      let categoryId: string | null = null;

      const { data: categories } = await supabase
        .from('incident_categories')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('name', 'Autre')
        .maybeSingle();

      if (categories) {
        categoryId = categories.id;
      } else {
        // Créer la catégorie "Autre"
        const { data: newCategory } = await supabase
          .from('incident_categories')
          .insert({
            hotel_id: hotelId,
            name: 'Autre',
            icon: '❓',
            is_system: false,
          })
          .select('id')
          .single();

        categoryId = newCategory?.id || null;
      }

      if (!categoryId) {
        console.error('❌ Impossible de créer/trouver la catégorie Autre');
        return;
      }

      // Créer le nouvel item
      const { data: newItem, error } = await supabase
        .from('incident_items')
        .insert({
          hotel_id: hotelId,
          category_id: categoryId,
          name: itemName,
          description: `Détecté automatiquement par IA (${categoryName})`,
          is_system: false,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création item:', error);
      } else {
        console.log('✅ Nouvel item créé:', newItem);
        toast({
          title: '✨ Nouvel élément créé',
          description: `"${itemName}" ajouté à la catégorie Autre`,
        });
      }
    } catch (error) {
      console.error('❌ Erreur création item:', error);
    }
  };

  return {
    analyzeImage,
    isAnalyzing,
  };
};
