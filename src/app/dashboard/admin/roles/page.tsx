
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Plus, Trash2, Edit2, Loader2, Save, Eye, Edit3, XCircle, ListTodo } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { RoleConfig, AppPermissions } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_PERMISSIONS: AppPermissions = {
  canManageUsers: false,
  canConfigureSlots: false,
  canManageLocations: false,
  canManageClasses: false,
  canViewReports: false,
  canViewAllAppointments: false,
  canViewSegmentAppointments: false,
  canViewClassAppointments: false,
  canEditAppointments: false,
  canCancelAppointments: false,
  canDeleteAppointments: false,
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestão de Perfis</h1>
          <p className="text-muted-foreground">Configure os níveis de acesso e sub-permissões dinamicamente.</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl h-11 gap-2 shadow-lg">
          <Plus className="w-4 h-4" />
          Novo Perfil
        </Button>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow>
                <TableHead className="font-bold">Nome do Perfil</TableHead>
                <TableHead className="font-bold">Nível de Agenda</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-primary/5">
                <TableCell className="font-bold">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg text-primary"><ShieldCheck className="w-4 h-4" /></div>
                    Administrador Master (Sistema)
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-primary text-primary-foreground text-[10px]">Acesso Total Irrestrito</Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground italic">Protegido</TableCell>
              </TableRow>

              {roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg text-muted-foreground"><ShieldCheck className="w-4 h-4" /></div>
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.canViewAllAppointments ? <Badge variant="outline" className="text-[9px] bg-blue-50">Global</Badge> : 
                       role.canViewSegmentAppointments ? <Badge variant="outline" className="text-[9px] bg-purple-50">Segmento</Badge> :
                       <Badge variant="outline" className="text-[9px] bg-orange-50">Individual</Badge>}
                      {(role.canEditAppointments || role.canCancelAppointments) && <Badge variant="secondary" className="text-[9px]">Ações Ativas</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => setEditingRole(role)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => handleRemove(role.id)} disabled={role.name.toUpperCase() === 'ADMIN'}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RoleDialog 
        isOpen={isAddDialogOpen} 
        onClose={() => setIsAddDialogOpen(false)} 
        role={newRole} 
        setRole={setNewRole} 
        onSave={handleAdd} 
        title="Criar Novo Perfil"
      />

      <RoleDialog 
        isOpen={!!editingRole} 
        onClose={() => setEditingRole(null)} 
        role={editingRole} 
        setRole={setEditingRole} 
        onSave={handleUpdate} 
        title="Editar Perfil"
      />
    </div>
  );
}

function RoleDialog({ isOpen, onClose, role, setRole, onSave, title }: any) {
  if (!role) return null;

  const renderPermissionToggle = (label: string, field: keyof AppPermissions, icon?: any) => {
    const Icon = icon;
    return (
      <div className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-transparent hover:border-primary/20 transition-all">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Switch 
          checked={role[field]} 
          onCheckedChange={(v) => setRole({ ...role, [field]: v })}
        />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-primary text-primary-foreground">
          <DialogTitle className="text-xl text-primary-foreground">{title}</DialogTitle>
          <DialogDescription className="text-primary-foreground/80">Configure os módulos e as sub-permissões detalhadas da agenda.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] p-6">
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-sm font-bold">Nome do Cargo</label>
              <Input placeholder="Ex: Coordenação de Ensino" value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CATEGORIA: MÓDULOS DE GESTÃO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Módulos de Gestão</h3>
                </div>
                {renderPermissionToggle("Gestão de Equipe", "canManageUsers")}
                {renderPermissionToggle("Configurar Locais", "canManageLocations")}
                {renderPermissionToggle("Configurar Grade Horária", "canConfigureSlots")}
                {renderPermissionToggle("Gerenciar Turmas/Segmentos", "canManageClasses")}
                {renderPermissionToggle("Ver Relatórios e Estatísticas", "canViewReports")}
              </div>

              {/* CATEGORIA: AGENDA GLOBAL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <ListTodo className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Agenda Global</h3>
                </div>
                
                <div className="space-y-3 bg-primary/5 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-primary uppercase">Nível de Visualização</p>
                  {renderPermissionToggle("Ver Agenda de TODA a escola", "canViewAllAppointments", Eye)}
                  {renderPermissionToggle("Ver só do meu SEGMENTO", "canViewSegmentAppointments", Eye)}
                  {renderPermissionToggle("Ver só da minha TURMA", "canViewClassAppointments", Eye)}
                </div>

                <div className="space-y-3 bg-destructive/5 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-destructive uppercase">Ações e Controles</p>
                  {renderPermissionToggle("Editar / Reagendar", "canEditAppointments", Edit3)}
                  {renderPermissionToggle("Cancelar Sessão", "canCancelAppointments", XCircle)}
                  {renderPermissionToggle("Excluir Definitivamente", "canDeleteAppointments", Trash2)}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-xl gap-2"><Save className="w-4 h-4" /> Salvar Perfil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
