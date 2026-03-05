
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit2, Search, Loader2, Building2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PhotoLocation } from '@/lib/types';

export default function LocationsAdminPage() {
  const db = useFirestore();
  const locationsRef = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const { data: locations, isLoading } = useCollection<PhotoLocation>(locationsRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', unit: '', description: '' });
  
  // Estado para Edição
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; unit: string; description: string } | null>(null);

  const handleAdd = () => {
    if (!newLoc.name || !db) return;
    
    addDocumentNonBlocking(collection(db, 'photo_locations'), {
      name: newLoc.name,
      unit: newLoc.unit,
      description: newLoc.description,
      isActive: true
    });
    
    setNewLoc({ name: '', unit: '', description: '' });
    setIsAddDialogOpen(false);
    toast({ title: "Local Adicionado", description: "O novo local de foto está salvo no banco de dados." });
  };

  const handleSaveEdit = () => {
    if (!editingItem || !db) return;
    
    updateDocumentNonBlocking(doc(db, 'photo_locations', editingItem.id), {
      name: editingItem.name,
      unit: editingItem.unit,
      description: editingItem.description
    });

    setEditingItem(null);
    toast({ title: "Local Atualizado", description: "As alterações foram salvas com sucesso." });
  };

  const handleRemove = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'photo_locations', id));
    toast({ title: "Local Removido", description: "O local foi excluído do banco de dados." });
  };

  const toggleStatus = (id: string, currentStatus: boolean) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'photo_locations', id), { isActive: !currentStatus });
    toast({ title: "Status Atualizado" });
  };

  const filtered = locations?.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.unit?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locais de Foto</h1>
          <p className="text-muted-foreground">Gerencie os espaços e unidades da escola.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-11 gap-2 shadow-lg">
              <Plus className="w-4 h-4" />
              Novo Local
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Local</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome do Local</label>
                  <Input 
                    placeholder="Ex: Pátio Central" 
                    value={newLoc.name} 
                    onChange={(e) => setNewLoc({...newLoc, name: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Unidade</label>
                  <Input 
                    placeholder="Ex: Unidade I" 
                    value={newLoc.unit} 
                    onChange={(e) => setNewLoc({...newLoc, unit: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Descrição/Dicas</label>
                <Textarea 
                  placeholder="Dicas de iluminação ou acesso..." 
                  value={newLoc.description} 
                  onChange={(e) => setNewLoc({...newLoc, description: e.target.value})}
                  className="rounded-xl min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleAdd} className="rounded-xl">Salvar Local</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <div className="p-4 border-b bg-muted/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar local ou unidade..." 
              className="pl-9 rounded-xl bg-white border-none shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold">Local</TableHead>
                <TableHead className="font-bold">Unidade</TableHead>
                <TableHead className="font-bold">Descrição</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loc) => (
                <TableRow key={loc.id} className="hover:bg-accent/5">
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <MapPin className="w-4 h-4" />
                      </div>
                      {loc.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {loc.unit ? (
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        {loc.unit}
                      </div>
                    ) : '---'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                    {loc.description}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={loc.isActive ? "default" : "secondary"} 
                      className={`rounded-lg cursor-pointer ${loc.isActive ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      onClick={() => toggleStatus(loc.id, !!loc.isActive)}
                    >
                      {loc.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-primary/10 text-primary"
                        onClick={() => setEditingItem({ id: loc.id, name: loc.name, unit: loc.unit || '', description: loc.description })}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(loc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum local encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal de Edição */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar Local</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Nome do Local</label>
                <Input 
                  value={editingItem?.name || ''} 
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Unidade</label>
                <Input 
                  value={editingItem?.unit || ''} 
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, unit: e.target.value} : null)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Descrição/Dicas</label>
              <Textarea 
                placeholder="Dicas de iluminação ou acesso..." 
                value={editingItem?.description || ''} 
                onChange={(e) => setEditingItem(prev => prev ? {...prev, description: e.target.value} : null)}
                className="rounded-xl min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveEdit} className="rounded-xl">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
