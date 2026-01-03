import React, { useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Plus, X } from "lucide-react";

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

interface ReportCustomFieldsProps {
  onChange: (fields: ReportFields) => void;
}

const ReportCustomFields: React.FC<ReportCustomFieldsProps> = ({ onChange }) => {
  const [enableToDo, setEnableToDo] = useState<boolean>(false);
  const [enableToKnow, setEnableToKnow] = useState<boolean>(false);
  const [toDoItems, setToDoItems] = useState<string[]>([""]);
  const [toKnowItems, setToKnowItems] = useState<string[]>([""]);

  const updateToDoItem = (index: number, value: string) => {
    const newItems = [...toDoItems];
    newItems[index] = value;
    setToDoItems(newItems);
    onChange({ toDoItems: enableToDo ? newItems.filter(i => i.trim()) : [], toKnowItems: enableToKnow ? toKnowItems.filter(i => i.trim()) : [] });
  };

  const updateToKnowItem = (index: number, value: string) => {
    const newItems = [...toKnowItems];
    newItems[index] = value;
    setToKnowItems(newItems);
    onChange({ toDoItems: enableToDo ? toDoItems.filter(i => i.trim()) : [], toKnowItems: enableToKnow ? newItems.filter(i => i.trim()) : [] });
  };

  const addToDoItem = () => {
    if (toDoItems.length < 5) {
      setToDoItems([...toDoItems, ""]);
    }
  };

  const addToKnowItem = () => {
    if (toKnowItems.length < 5) {
      setToKnowItems([...toKnowItems, ""]);
    }
  };

  const removeToDoItem = (index: number) => {
    if (toDoItems.length > 1) {
      const newItems = toDoItems.filter((_, i) => i !== index);
      setToDoItems(newItems);
      onChange({ toDoItems: enableToDo ? newItems.filter(i => i.trim()) : [], toKnowItems: enableToKnow ? toKnowItems.filter(i => i.trim()) : [] });
    }
  };

  const removeToKnowItem = (index: number) => {
    if (toKnowItems.length > 1) {
      const newItems = toKnowItems.filter((_, i) => i !== index);
      setToKnowItems(newItems);
      onChange({ toDoItems: enableToDo ? toDoItems.filter(i => i.trim()) : [], toKnowItems: enableToKnow ? newItems.filter(i => i.trim()) : [] });
    }
  };

  const handleToDoToggle = (checked: boolean) => {
    setEnableToDo(checked);
    if (checked && toDoItems.length === 0) {
      setToDoItems([""]);
    }
    onChange({ toDoItems: checked ? toDoItems.filter(i => i.trim()) : [], toKnowItems: enableToKnow ? toKnowItems.filter(i => i.trim()) : [] });
  };

  const handleToKnowToggle = (checked: boolean) => {
    setEnableToKnow(checked);
    if (checked && toKnowItems.length === 0) {
      setToKnowItems([""]);
    }
    onChange({ toDoItems: enableToDo ? toDoItems.filter(i => i.trim()) : [], toKnowItems: checked ? toKnowItems.filter(i => i.trim()) : [] });
  };

  return (
    <div className="space-y-4">
      {/* Choses à faire */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="enable-todo" 
            checked={enableToDo} 
            onCheckedChange={handleToDoToggle} 
          />
          <Label htmlFor="enable-todo" className="text-sm cursor-pointer">Ajouter des choses à faire</Label>
        </div>
        
        {enableToDo && (
          <div className="space-y-2 pl-6">
            {toDoItems.map((item, index) => (
              <div key={`todo-${index}`} className="flex items-center gap-2">
                <Input
                  placeholder={`Chose à faire ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToDoItem(index, e.target.value)}
                  className="text-sm h-9"
                />
                {toDoItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeToDoItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {toDoItems.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={addToDoItem}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Choses à savoir */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="enable-toknow" 
            checked={enableToKnow} 
            onCheckedChange={handleToKnowToggle} 
          />
          <Label htmlFor="enable-toknow" className="text-sm cursor-pointer">Ajouter des choses à savoir</Label>
        </div>
        
        {enableToKnow && (
          <div className="space-y-2 pl-6">
            {toKnowItems.map((item, index) => (
              <div key={`toknow-${index}`} className="flex items-center gap-2">
                <Input
                  placeholder={`Chose à savoir ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToKnowItem(index, e.target.value)}
                  className="text-sm h-9"
                />
                {toKnowItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeToKnowItem(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {toKnowItems.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={addToKnowItem}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportCustomFields;
