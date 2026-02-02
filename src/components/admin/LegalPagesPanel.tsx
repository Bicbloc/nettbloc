import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, FileText, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LegalPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

export const LegalPagesPanel = () => {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<LegalPage | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .order('slug');

    if (!error && data) {
      setPages(data);
      if (data.length > 0 && !selectedPage) {
        selectPage(data[0]);
      }
    }
    setLoading(false);
  };

  const selectPage = (page: LegalPage) => {
    setSelectedPage(page);
    setEditedTitle(page.title);
    setEditedContent(page.content);
  };

  const savePage = async () => {
    if (!selectedPage) return;

    setSaving(true);
    const { error } = await supabase
      .from('legal_pages')
      .update({
        title: editedTitle,
        content: editedContent,
        updated_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', selectedPage.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder les modifications'
      });
    } else {
      toast({
        title: 'Sauvegardé',
        description: 'Les modifications ont été enregistrées'
      });
      loadPages();
    }
    setSaving(false);
  };

  const previewPage = () => {
    if (selectedPage) {
      window.open(`/legal/${selectedPage.slug}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pages légales
          </CardTitle>
          <CardDescription>
            Gérez les conditions générales de vente et autres pages légales
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Page selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {pages.map((page) => (
              <Button
                key={page.id}
                variant={selectedPage?.id === page.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectPage(page)}
              >
                {page.title}
              </Button>
            ))}
          </div>

          {selectedPage && (
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre de la page</Label>
                <Input
                  id="title"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Titre de la page"
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Contenu (Markdown)</Label>
                <Textarea
                  id="content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="Contenu de la page en Markdown..."
                  rows={20}
                  className="font-mono text-sm"
                />
              </div>

              {/* Meta info */}
              <p className="text-xs text-muted-foreground">
                Dernière modification : {format(new Date(selectedPage.updated_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={savePage} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
                <Button variant="outline" onClick={previewPage}>
                  <Eye className="h-4 w-4 mr-2" />
                  Prévisualiser
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
