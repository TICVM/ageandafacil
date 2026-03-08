'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Plus, Trash2, Edit2, Loader2, Save } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { RoleConfig, AppPermissions } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const DEFAULT_PERMISSIONS: AppPermissions = {
  canManageUsers: false,
  canConfigureSlots: false,
  canManageLocations: false,
  canManageClasses: false,
  canViewReports: false,
  canViewAllAppointments: false,
  canCreateBookings: true,
};

export default function RolesAdminPage() {
  const db = useFirestore();
  const rolesRef = useMemoFirebase(() => db ? collection(db, 'roles_config') : null, [db]);
  const { data: roles, isLoading } = useCollection<RoleConfig>(rolesRef);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleConfig | null>(null);
  
  const [newRole, setNewRole] = useState({
    name: '',
    ...DEFAULT_PERMISSIONS
  });

  const handleAdd = () => {
    if (!newRole.name || !db) return;
    
    addDocumentNonBlocking(collection(db, 'roles_config'), newRole);
    setNewRole({ name: '', ...DEFAULT_PERMISSIONS });
    setIsAddDialogOpen(false);
    toast({ title: "Perfil criado com sucesso!" });
  };

  const handleUpdate = () => {
    if (!editingRole || !db) return;
    
    updateDocumentNonBlocking(doc(db, 'roles_config', editingRole.id), editingRole);
    setEditingRole(null);
    toast({ title: "Perfil atualizado!" });
  };

  const handleRemove = (id: string) => {
    if (id === 'ADMIN') {
      toast({ title: "Erro", description: "O perfil de Administrador não pode ser removido.", variant: "destructive" });
      return;
    }
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'roles_config', id));
    toast({ title: "Perfil removido." });
  };

  const renderPermissionToggle = (label: string, field: keyof AppPermissions, current: any, onChange: (val: boolean) => void) => (
    <div className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-transparent hover:border-primary/20 transition-all">
      <span className="text-sm font-medium">{label}</span>
      <Switch 
        checked={current[field]} 
        onCheckedChange={onChange}
      />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestão de Perfis</h1>
          <p className="text-muted-foreground">Determine quais ações cada tipo de usuário pode realizar no sistema.</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl h-11 gap-2 shadow-lg">
          <Plus className="w-4 h-4" />
          Novo Perfil
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-3 border-none shadow-md overflow-hidden bg-white">
          {isLoading ? (
            <div className="p-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="font-bold">Nome do Perfil</TableHead>
                  <TableHead className="font-bold">Permissões Ativas</TableHead>
                  <TableHead className="text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Linha Fixa do Master Admin para Contexto */}
                <TableRow className="bg-primary/5">
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      Administrador Master (Sistema)
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-primary text-primary-foreground text-[10px]">Acesso Total</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground italic">Protegido</TableCell>
                </TableRow>

                {roles?.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-bold">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.canManageUsers && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Usuários</span>}
                        {role.canViewAllAppointments && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Agenda</span>}
                        {role.canViewReports && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Relatórios</span>}
                        {role.canConfigureSlots && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Grade</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full text-primary" 
                          onClick={() => setEditingRole(role)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full text-destructive"
                          onClick={() => handleRemove(role.id)}
                          disabled={role.name.toUpperCase() === 'ADMIN'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="border-none shadow-md bg-white p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Dicas
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Crie perfis específicos como <strong>Coordenação</strong> para dar acesso apenas aos segmentos responsáveis, ou <strong>Secretaria</strong> para gerenciar apenas a agenda.
          </p>
          <Separator className="my-4" />
          <p className="text-[10px] text-muted-foreground italic">
            O cargo de Administrador Master é reservado para o e-mail oficial de gestão e não pode ser alterado por outros usuários.
          </p>
        </Card>
      </div>

      {/* Modal Adicionar */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Perfil</DialogTitle>
            <DialogDescription>Dê um nome ao cargo e defina suas permissões.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nome do Perfil</label>
              <Input 
                placeholder="Ex: Secretaria, Direção..." 
                value={newRole.name}
                onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <p className="text-xs font-bold uppercase text-muted-foreground mt-2">Permissões</p>
              {renderPermissionToggle("Gerenciar Equipe e Usuários", "canManageUsers", newRole, (v) => setNewRole({...newRole, canManageUsers: v}))}
              {renderPermissionToggle("Ver Agenda Global", "canViewAllAppointments", newRole, (v) => setNewRole({...newRole, canViewAllAppointments: v}))}
              {renderPermissionToggle("Gerenciar Turmas/Segmentos", "canManageClasses", newRole, (v) => setNewRole({...newRole, canManageClasses: v}))}
              {renderPermissionToggle("Configurar Locais", "canManageLocations", newRole, (v) => setNewRole({...newRole, canManageLocations: v}))}
              {renderPermissionToggle("Configurar Grade Horária", "canConfigureSlots", newRole, (v) => setNewRole({...newRole, canConfigureSlots: v}))}
              {renderPermissionToggle("Ver Relatórios", "canViewReports", newRole, (v) => setNewRole({...newRole, canViewReports: v}))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAdd} className="rounded-xl">Criar Perfil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>Atualize as permissões deste cargo.</DialogDescription>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Nome do Perfil</label>
                <Input 
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <p className="text-xs font-bold uppercase text-muted-foreground mt-2">Permissões</p>
                {renderPermissionToggle("Gerenciar Equipe e Usuários", "canManageUsers", editingRole, (v) => setEditingRole({...editingRole, canManageUsers: v}))}
                {renderPermissionToggle("Ver Agenda Global", "canViewAllAppointments", editingRole, (v) => setEditingRole({...editingRole, canViewAllAppointments: v}))}
                {renderPermissionToggle("Gerenciar Turmas/Segmentos", "canManageClasses", editingRole, (v) => setEditingRole({...editingRole, canManageClasses: v}))}
                {renderPermissionToggle("Configurar Locais", "canManageLocations", editingRole, (v) => setEditingRole({...editingRole, canManageLocations: v}))}
                {renderPermissionToggle("Configurar Grade Horária", "canConfigureSlots", editingRole, (v) => setEditingRole({...editingRole, canConfigureSlots: v}))}
                {renderPermissionToggle("Ver Relatórios", "canViewReports", editingRole, (v) => setEditingRole({...editingRole, canViewReports: v}))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleUpdate} className="rounded-xl gap-2">
              <Save className="w-4 h-4" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
