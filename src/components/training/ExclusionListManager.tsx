import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, UserMinus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExclusionListManagerProps {
  excludeList: string[];
  onChange: (list: string[]) => void;
  detectedNames?: string[]; // Noms détectés dans le rapport pour suggestion
}

export const ExclusionListManager = ({
  excludeList,
  onChange,
  detectedNames = []
}: ExclusionListManagerProps) => {
  const [newName, setNewName] = useState("");

  const addName = (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed && !excludeList.includes(trimmed)) {
      onChange([...excludeList, trimmed]);
    }
    setNewName("");
  };

  const removeName = (name: string) => {
    onChange(excludeList.filter(n => n !== name));
  };

  // Filtrer les noms suggérés qui ne sont pas déjà dans la liste
  const suggestedNames = detectedNames.filter(name => 
    !excludeList.some(excluded => 
      name.toLowerCase().includes(excluded) || 
      excluded.includes(name.toLowerCase().split(' ')[0])
    )
  );

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserMinus className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Liste d'exclusion</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Ajoutez ici les noms des responsables housekeeping (gouvernantes, etc.) 
                pour qu'ils ne soient pas confondus avec les noms des clients.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Input pour ajouter un nom */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom à exclure (ex: Axel Merle)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addName(newName);
            }
          }}
          className="flex-1"
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => addName(newName)}
          disabled={!newName.trim()}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Liste des noms exclus */}
      {excludeList.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Noms exclus :</p>
          <div className="flex flex-wrap gap-2">
            {excludeList.map((name) => (
              <Badge
                key={name}
                variant="secondary"
                className="pl-3 pr-1 py-1 flex items-center gap-1"
              >
                <span className="capitalize">{name}</span>
                <button
                  onClick={() => removeName(name)}
                  className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions de noms détectés */}
      {suggestedNames.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Noms détectés dans le rapport (cliquez pour exclure) :
          </p>
          <ScrollArea className="max-h-24">
            <div className="flex flex-wrap gap-1">
              {suggestedNames.slice(0, 20).map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted transition-colors text-xs"
                  onClick={() => addName(name.split(' ')[0])} // Ajouter juste le prénom
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {name}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </Card>
  );
};
