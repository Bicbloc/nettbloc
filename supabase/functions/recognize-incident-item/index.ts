import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageUrl, context } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare image content
    let imageContent: { type: string; image_url?: { url: string }; text?: string }[] = [];
    
    if (imageBase64) {
      imageContent.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` }
      });
    } else if (imageUrl) {
      imageContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    const systemPrompt = `Tu es un assistant expert en identification d'incidents dans les établissements hôteliers.
Analyse l'image fournie et identifie avec précision l'élément concerné.

CATÉGORIES DISPONIBLES (choisis celle qui correspond le mieux):
- Plomberie: WC, Lavabo, Douche, Baignoire, Robinetterie, Siphon, Chasse d'eau, Tuyauterie, Mitigeur, Flexible de douche, Pommeau de douche, Bonde, Joint, Bidet, Abattant WC
- Électricité: Prise électrique, Interrupteur, Éclairage plafonnier, Lampe de chevet, Lampe de bureau, Applique murale, Spot encastré, Ampoule, Variateur de lumière, Prise USB, Multiprise, Disjoncteur / Fusible, Détecteur de mouvement, Veilleuse
- Mobilier: Lit, Armoire / Penderie, Bureau, Chaise, Fauteuil, Canapé, Table de nuit, Table basse, Commode / Tiroirs, Étagère, Porte-bagages, Miroir, Cadre / Tableau, Patère / Crochet, Cintre, Poubelle, Porte-serviettes
- Ménage: Draps, Serviettes, Produits d'accueil, Papier toilette, Mouchoirs, Sac poubelle, Tache sur moquette, Tache sur mur, Mauvaise odeur, Insecte / Nuisible, Moisissure, Peignoir, Chaussons, Couverture supplémentaire, Oreiller supplémentaire
- Climatisation / Chauffage: Climatisation, Chauffage, Ventilation / VMC, Thermostat, Radiateur, Ventilateur, Filtre climatisation, Télécommande clim, Sèche-serviettes
- Serrurerie / Accès: Serrure de porte, Lecteur de carte, Poignée de porte, Verrou / Loquet, Clé, Badge / Carte magnétique, Judas, Chaîne de sécurité, Coffre-fort
- Salle de bain: Miroir salle de bain, Paroi de douche, Rideau de douche, Carrelage, Joint de silicone, Distributeur de savon, Sèche-cheveux, Balance, Tablette / Étagère SDB, Tapis de bain, Patère SDB, Dérouleur papier WC
- Literie: Matelas, Sommier, Oreiller, Couette, Drap housse, Protège-matelas, Tête de lit, Lit bébé / Lit d'appoint, Traversin
- Électroménager / Minibar: Minibar / Réfrigérateur, Bouilloire, Machine à café / Nespresso, Plateau de courtoisie, Fer à repasser, Table à repasser, Micro-ondes, Grille-pain, Aspirateur
- Revêtements / Murs / Sols: Moquette, Parquet, Carrelage sol, Lino / Vinyle, Peinture murale, Papier peint, Plafond, Plinthe, Faux plafond
- Menuiserie / Fenêtres: Fenêtre, Volet roulant, Store / Rideau, Porte intérieure, Porte de salle de bain, Porte coulissante, Porte de placard, Balcon / Garde-corps, Moustiquaire, Charnière / Gond
- Sécurité: Détecteur de fumée, Extincteur, Éclairage de secours, Plan d'évacuation, Caméra de surveillance, Alarme incendie, Issue de secours
- Extérieur / Espaces communs: Ascenseur, Escalier, Couloir, Parking, Piscine, Spa / Sauna, Salle de sport, Terrasse, Jardin, Hall / Réception, Salle de réunion, Restaurant / Bar, Buanderie
- Multimédia / TV / Téléphonie: Téléviseur, Télécommande TV, Téléphone fixe, Wi-Fi / Internet, Câble HDMI, Enceinte Bluetooth, Radio / Réveil, Chargeur sans fil, Tablette interactive
- Équipements chambre: Rideaux occultants, Voilage, Tringle à rideau, Store vénitien, Coussin, Plaid / Couverture, Tapis, Corbeille à fruits, Kit couture, Kit cirage, Papeterie / Bloc-notes, Parapluie, Adaptateur prise

TYPES DE PROBLÈME DISPONIBLES:
- Cassé / En panne (high)
- Manquant (medium)
- Sale / À nettoyer (low)
- Usé / À remplacer (medium)
- Fuite (high)
- Bruyant (medium)
- Bloqué / Coincé (medium)
- Dégât des eaux (urgent)
- Autre (low)

INSTRUCTIONS:
1. Identifie l'objet principal visible sur la photo
2. Choisis la CATÉGORIE et l'ITEM les plus précis parmi la liste ci-dessus
3. Détermine le TYPE de problème visible
4. Évalue la GRAVITÉ (low, medium, high, urgent)
5. Utilise EXACTEMENT les noms de catégories et items listés ci-dessus pour un matching parfait

Réponds UNIQUEMENT en JSON valide:
{
  "category": "nom exact de la catégorie",
  "item": "nom exact de l'item",
  "problem_type": "nom exact du type de problème",
  "severity": "low|medium|high|urgent",
  "description": "description courte du problème visible",
  "confidence": 0.0-1.0,
  "suggested_title": "titre court pour l'incident"
}`;

    const userPrompt = `Analyse cette image d'un incident dans un établissement hôtelier. Identifie précisément l'élément et le problème.${context ? `\n\nContexte supplémentaire: ${context}` : ''}`;

    imageContent.push({ type: "text", text: userPrompt });

    console.log('📸 Analyzing incident image with AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: imageContent }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requêtes atteinte, veuillez réessayer dans quelques instants' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Crédits insuffisants pour l\'analyse IA' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
void logAiUsage({ functionName: "recognize-incident-item", aiData: aiResponse, model: "google/gemini-2.5-flash", hotelId: context?.hotelId ?? null });
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('🤖 AI Response:', content);

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      result = {
        category: "Autre",
        item: "Non identifié",
        problem_type: "Autre",
        severity: "medium",
        description: "Impossible d'identifier précisément l'élément",
        confidence: 0.3,
        suggested_title: "Incident à vérifier"
      };
    }

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in recognize-incident-item:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
