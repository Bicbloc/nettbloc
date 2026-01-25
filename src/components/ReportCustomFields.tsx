import React, { useState, useEffect } from "react";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ListTodo, Info, Plus, Star, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface LinenInventoryItem {
  linenTypeId: string;
  linenTypeName: string;
  quantity: number;
  assignedTo: string[];
}

export interface ReportFields {
  toDoItems: string[];
  toKnowItems: string[];
  instructions?: string;
  generalInstructions?: string;
  housekeeperInstructions?: Record<string, string>;
  linenInventory?: LinenInventoryItem[];
}

interface Template {
  id: string;
  name: string;
  template_type: 'todo' | 'toknow' | 'instructions';
  content: string[];
  is_default: boolean;
}

interface ReportCustomFieldsProps {
  onChange: (fields: ReportFields) => void;
  hotelId?: string;
  initialToDoItems?: string[];
  initialToKnowItems?: string[];
}

const ReportCustomFields: React.FC<ReportCustomFieldsProps> = ({ 
  onChange, 
  hotelId, 
  initialToDoItems, 
  initialToKnowItems 
}) => {
  const [enableToDo, setEnableToDo] = useState<boolean>(false);
  const [enableToKnow, setEnableToKnow] = useState<boolean>(false);
  const [toDoItems, setToDoItems] = useState<string[]>(Array(5).fill(""));
  const [toKnowItems, setToKnowItems] = useState<string[]>(Array(5).fill(""));
  const [hasAppliedInitial, setHasAppliedInitial] = useState(false);
  
  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedToDoTemplate, setSelectedToDoTemplate] = useState<string>("");
  const [selectedToKnowTemplate, setSelectedToKnowTemplate] = useState<string>("");

  // Apply initial values from parent if provided
  useEffect(() => {
    if (!hasAppliedInitial) {
      if (initialToDoItems && initialToDoItems.some(item => item.trim())) {
        const items = [...initialToDoItems];
        while (items.length < 5) items.push("");
        setToDoItems(items);
        setEnableToDo(true);
      }
      if (initialToKnowItems && initialToKnowItems.some(item => item.trim())) {
        const items = [...initialToKnowItems];
        while (items.length < 5) items.push("");
        setToKnowItems(items);
        setEnableToKnow(true);
      }
      setHasAppliedInitial(true);
    }
  }, [initialToDoItems, initialToKnowItems, hasAppliedInitial]);

  // Load templates when hotelId is available
  useEffect(() => {
    if (hotelId) {
      loadTemplates();
    }
  }, [hotelId]);

  // Auto-apply default templates on load (only if no initial values provided)
  useEffect(() => {
    if (templates.length > 0 && hasAppliedInitial) {
      // Only apply default templates if we don't already have content from initial values
      const hasInitialTodo = initialToDoItems && initialToDoItems.some(item => item.trim());
      const hasInitialToKnow = initialToKnowItems && initialToKnowItems.some(item => item.trim());
      
      const defaultTodo = templates.find(t => t.template_type === 'todo' && t.is_default);
      const defaultToKnow = templates.find(t => t.template_type === 'toknow' && t.is_default);
      
      if (defaultTodo && !hasInitialTodo && !enableToDo) {
        applyTemplate(defaultTodo, 'todo');
        setSelectedToDoTemplate(defaultTodo.id);
      }
      if (defaultToKnow && !hasInitialToKnow && !enableToKnow) {
        applyTemplate(defaultToKnow, 'toknow');
        setSelectedToKnowTemplate(defaultToKnow.id);
      }
    }
  }, [templates, hasAppliedInitial]);

  const loadTemplates = async () => {
    if (!hotelId) return;
    
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('hotel_id', hotelId)
        .in('template_type', ['todo', 'toknow'])
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      
      setTemplates((data || []).map(t => ({
        ...t,
        content: Array.isArray(t.content) ? t.content : []
      })) as Template[]);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const applyTemplate = (template: Template, type: 'todo' | 'toknow') => {
    // Expand content to fill 5 slots (or more if template has more)
    const content = [...template.content];
    while (content.length < 5) {
      content.push("");
    }
    
    if (type === 'todo') {
      setToDoItems(content);
      setEnableToDo(true);
      onChange({
        toDoItems: content,
        toKnowItems: enableToKnow ? toKnowItems : [],
      });
    } else {
      setToKnowItems(content);
      setEnableToKnow(true);
      onChange({
        toDoItems: enableToDo ? toDoItems : [],
        toKnowItems: content,
      });
    }
    
    toast({
      title: "Template appliqué",
      description: `"${template.name}" a été chargé`,
    });
  };

  const handleTemplateSelect = (templateId: string, type: 'todo' | 'toknow') => {
    if (templateId === 'none') {
      if (type === 'todo') {
        setSelectedToDoTemplate("");
        setToDoItems(Array(5).fill(""));
      } else {
        setSelectedToKnowTemplate("");
        setToKnowItems(Array(5).fill(""));
      }
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      if (type === 'todo') {
        setSelectedToDoTemplate(templateId);
      } else {
        setSelectedToKnowTemplate(templateId);
      }
      applyTemplate(template, type);
    }
  };

  const updateToDoItem = (index: number, value: string) => {
    const newItems = [...toDoItems];
    newItems[index] = value;
    setToDoItems(newItems);
    onChange({
      toDoItems: enableToDo ? newItems : [],
      toKnowItems: enableToKnow ? toKnowItems : [],
    });
  };

  const updateToKnowItem = (index: number, value: string) => {
    const newItems = [...toKnowItems];
    newItems[index] = value;
    setToKnowItems(newItems);
    onChange({
      toDoItems: enableToDo ? toDoItems : [],
      toKnowItems: enableToKnow ? newItems : [],
    });
  };

  const handleToDoToggle = (checked: boolean) => {
    setEnableToDo(checked);
    onChange({
      toDoItems: checked ? toDoItems : [],
      toKnowItems: enableToKnow ? toKnowItems : [],
    });
  };

  const handleToKnowToggle = (checked: boolean) => {
    setEnableToKnow(checked);
    onChange({
      toDoItems: enableToDo ? toDoItems : [],
      toKnowItems: checked ? toKnowItems : [],
    });
  };

  const todoTemplates = templates.filter(t => t.template_type === 'todo');
  const toKnowTemplates = templates.filter(t => t.template_type === 'toknow');

  return (
    <div className="space-y-4">
      {/* Todo Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-todo"
              checked={enableToDo}
              onCheckedChange={handleToDoToggle}
            />
            <Label htmlFor="enable-todo" className="text-sm cursor-pointer flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-blue-600" />
              Ajouter des choses à faire
            </Label>
          </div>
          
          {/* Template selector for ToDo */}
          {hotelId && todoTemplates.length > 0 && (
            <Select 
              value={selectedToDoTemplate} 
              onValueChange={(v) => handleTemplateSelect(v, 'todo')}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Charger un template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Aucun template</span>
                </SelectItem>
                {todoTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="flex items-center gap-1">
                      {template.is_default && <Star className="h-3 w-3 text-amber-500" />}
                      {template.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {isLoadingTemplates && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {enableToDo && (
          <div className="space-y-2 pl-6 max-h-56 overflow-y-auto pr-2">
            {toDoItems.map((item, index) => (
              <div key={`todo-${index}`}>
                <Textarea
                  placeholder={`Chose à faire ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToDoItem(index, e.target.value)}
                  className="resize-none min-h-[52px] text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ToKnow Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-toknow"
              checked={enableToKnow}
              onCheckedChange={handleToKnowToggle}
            />
            <Label htmlFor="enable-toknow" className="text-sm cursor-pointer flex items-center gap-2">
              <Info className="h-4 w-4 text-green-600" />
              Ajouter des choses à savoir
            </Label>
          </div>
          
          {/* Template selector for ToKnow */}
          {hotelId && toKnowTemplates.length > 0 && (
            <Select 
              value={selectedToKnowTemplate} 
              onValueChange={(v) => handleTemplateSelect(v, 'toknow')}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Charger un template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Aucun template</span>
                </SelectItem>
                {toKnowTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="flex items-center gap-1">
                      {template.is_default && <Star className="h-3 w-3 text-amber-500" />}
                      {template.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {enableToKnow && (
          <div className="space-y-2 pl-6 max-h-56 overflow-y-auto pr-2">
            {toKnowItems.map((item, index) => (
              <div key={`toknow-${index}`}>
                <Textarea
                  placeholder={`Chose à savoir ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToKnowItem(index, e.target.value)}
                  className="resize-none min-h-[52px] text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hint for creating templates */}
      {hotelId && templates.length === 0 && !isLoadingTemplates && (
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Astuce: Créez des templates dans l'onglet "Rapports" pour les réutiliser ici.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReportCustomFields;
