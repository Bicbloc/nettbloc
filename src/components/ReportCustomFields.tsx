
import React, { useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";

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
  const [toDoItems, setToDoItems] = useState<string[]>(Array(5).fill(""));
  const [toKnowItems, setToKnowItems] = useState<string[]>(Array(5).fill(""));

  const updateToDoItem = (index: number, value: string) => {
    const newItems = [...toDoItems];
    newItems[index] = value;
    setToDoItems(newItems);
    onChange({ toDoItems: enableToDo ? newItems : [], toKnowItems: enableToKnow ? toKnowItems : [] });
  };

  const updateToKnowItem = (index: number, value: string) => {
    const newItems = [...toKnowItems];
    newItems[index] = value;
    setToKnowItems(newItems);
    onChange({ toDoItems: enableToDo ? toDoItems : [], toKnowItems: enableToKnow ? newItems : [] });
  };

  const handleToDoToggle = (checked: boolean) => {
    setEnableToDo(checked);
    onChange({ toDoItems: checked ? toDoItems : [], toKnowItems: enableToKnow ? toKnowItems : [] });
  };

  const handleToKnowToggle = (checked: boolean) => {
    setEnableToKnow(checked);
    onChange({ toDoItems: enableToDo ? toDoItems : [], toKnowItems: checked ? toKnowItems : [] });
  };

  return (
    <div className="space-y-6 mt-6">
      <h3 className="text-lg font-semibold">Informations supplémentaires pour le rapport</h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="enable-todo" 
            checked={enableToDo} 
            onCheckedChange={handleToDoToggle} 
          />
          <Label htmlFor="enable-todo">Ajouter des choses à faire</Label>
        </div>
        
        {enableToDo && (
          <div className="space-y-2 pl-6">
            {toDoItems.map((item, index) => (
              <div key={`todo-${index}`} className="mb-2">
                <Textarea
                  placeholder={`Chose à faire ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToDoItem(index, e.target.value)}
                  className="resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="enable-toknow" 
            checked={enableToKnow} 
            onCheckedChange={handleToKnowToggle} 
          />
          <Label htmlFor="enable-toknow">Ajouter des choses à savoir</Label>
        </div>
        
        {enableToKnow && (
          <div className="space-y-2 pl-6">
            {toKnowItems.map((item, index) => (
              <div key={`toknow-${index}`} className="mb-2">
                <Textarea
                  placeholder={`Chose à savoir ${index + 1}`}
                  value={item}
                  onChange={(e) => updateToKnowItem(index, e.target.value)}
                  className="resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportCustomFields;
