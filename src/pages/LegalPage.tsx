import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

const LegalPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { language } = useTranslation();

  useEffect(() => {
    const loadPage = async () => {
      if (!slug) return;
      
      // Try requested language first, fallback to FR
      const { data: rows } = await supabase
        .from('legal_pages')
        .select('title, content, language')
        .eq('slug', slug);

      if (rows && rows.length) {
        const preferred = rows.find((r: any) => r.language === language) || rows.find((r: any) => r.language === 'fr') || rows[0];
        setTitle(preferred.title);
        setContent(preferred.content);
      }
      setLoading(false);
    };

    loadPage();
  }, [slug, language]);

  // Simple markdown to HTML converter
  const renderMarkdown = (md: string) => {
    return md
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-3 text-primary">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br/>');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground mb-4">
          {language === 'en' ? 'Page not found' : 'Page non trouvée'}
        </p>
        <Link to="/auth">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'en' ? 'Back' : 'Retour'}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/auth">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>

        {/* Content */}
        <div 
          className="prose prose-slate dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${renderMarkdown(content)}</p>` }}
        />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t">
          <Link to="/auth">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'en' ? 'Back to login' : 'Retour à la connexion'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
