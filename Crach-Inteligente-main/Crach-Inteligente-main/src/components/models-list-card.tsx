
"use client";

import React from "react";
import { type BadgeModel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout, Trash2, CheckCircle2, Plus, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ModelsListCardProps {
  models: BadgeModel[];
  activeModelId?: string;
  onSelect: (model: BadgeModel) => void;
  onDelete: (modelId: string) => void;
  onDuplicate: (model: BadgeModel) => void;
}

export default function ModelsListCard({ models, activeModelId, onSelect, onDelete, onDuplicate }: ModelsListCardProps) {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-primary">
                <Layout size={20} />
                Galeria de Modelos
            </CardTitle>
            <Badge variant="outline" className="font-mono">{models.length}</Badge>
        </div>
        <CardDescription>Gerencie seus designs salvos.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          {models.length > 0 ? (
            <div className="space-y-2">
              {models.map((model) => (
                <div 
                  key={model.id}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                    activeModelId === model.id ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                  )}
                  onClick={() => onSelect(model)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {activeModelId === model.id ? (
                      <CheckCircle2 size={18} className="text-primary shrink-0" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{model.nomeModelo}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(model);
                      }}
                      title="Duplicar Modelo"
                    >
                      <Copy size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(model.id);
                      }}
                      title="Excluir Modelo"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4 bg-muted/10 rounded-lg border border-dashed">
              <Plus size={24} className="mb-2 opacity-50" />
              <p className="text-xs">Nenhum modelo salvo ainda. Crie seu primeiro design abaixo!</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
