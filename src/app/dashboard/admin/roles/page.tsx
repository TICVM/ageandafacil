
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Plus, Trash2, Edit2, Loader2, Save, Eye, Edit3, XCircle, ListTodo, MapPin, Users, Clock, Camera, FileBarChart, UserCog, CheckCircle2, AlertTriangle, CheckCircle } from 'lucide-react';
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
  canChangeStatus: false,
  canStatusPending: false,
  canStatusConfirmed: false,
  canStatusCancelled: false,
  canStatusRescheduled: false,
  canStatusReScheduleRequest: false,
  canStatusCompleted: false,
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
                <TableHead className="font-bold">Acesso de Agenda</TableHead>
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
                  <Badge className="bg-primary text-primary-foreground text-[10px]">Acesso Total</Badge>
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
                      {role.canViewAllAppointments ? <Badge variant="outline" className="text-[9px] bg-blue-50 border-blue-200 text-blue-700">Total</Badge> : 
                       role.canViewSegmentAppointments ? <Badge variant="outline" className="text-[9px] bg-purple-50 border-purple-200 text-purple-700">Segmento</Badge> :
                       <Badge variant="outline" className="text-[9px] bg-orange-50 border-orange-200 text-orange-700">Turma</Badge>}
                      {(role.canEditAppointments || role.canCancelAppointments) && <Badge variant="secondary" className="text-[9px]">Edição</Badge>}
                      {role.canChangeStatus && <Badge variant="secondary" className="text-[9px] bg-green-50 text-green-700 border-green-200">Validador</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => setEditingRole(role)} aria-label="Editar perfil">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => handleRemove(role.id)} disabled={role.name.toUpperCase() === 'ADMIN'} aria-label="Remover perfil">
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

  const renderPermissionToggle = (label: string, field: keyof AppPermissions, icon?: any, colorClass?: string) => {
    const Icon = icon;
    const switchId = `perm-${field}-${role.id || 'new'}`;
    return (
      <div className={`flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-transparent hover:border-primary/20 transition-all ${colorClass}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          <Label htmlFor={switchId} className="text-sm font-medium cursor-pointer">{label}</Label>
        </div>
        <Switch 
          id={switchId}
          name={field}
          checked={role[field]} 
          onCheckedChange={(v) => setRole({ ...role, [field]: v })}
        />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="rounded-3xl max-w-5xl p-0 overflow-hidden border-none shadow-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-8 bg-primary text-primary-foreground">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground">
            <ShieldCheck className="w-6 h-6" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80">
            Defina detalhadamente as sub-permissões para cada módulo do sistema.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] bg-[#F8FAFC]">
          <div className="p-8 space-y-10">
            <div className="space-y-3">
              <Label htmlFor={`role-name-input-${role.id || 'new'}`} className="text-sm font-bold text-slate-700 uppercase tracking-wider">Identificação do Perfil</Label>
              <Input 
                id={`role-name-input-${role.id || 'new'}`}
                name="name"
                placeholder="Ex: Coordenador Pedagógico" 
                value={role.name} 
                onChange={(e) => setRole({ ...role, name: e.target.value })} 
                className="rounded-2xl h-12 bg-white border-slate-200 text-lg" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary border-b border-primary/10 pb-2">
                    <Users className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase">Equipe e Estrutura</h3>
                  </div>
                  {renderPermissionToggle("Gerenciar Usuários", "canManageUsers", UserCog, "text-blue-700")}
                  {renderPermissionToggle("Gerenciar Locais", "canManageLocations", MapPin)}
                  {renderPermissionToggle("Gerenciar Turmas", "canManageClasses", Users)}
                  {renderPermissionToggle("Configurar Horários", "canConfigureSlots", Clock)}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary border-b border-primary/10 pb-2">
                    <FileBarChart className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase">Estatísticas</h3>
                  </div>
                  {renderPermissionToggle("Ver Relatórios", "canViewReports", FileBarChart, "text-green-700")}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-600 border-b border-orange-600/10 pb-2">
                    <Camera className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase">Reservas e Agenda</h3>
                  </div>
                  {renderPermissionToggle("Fazer Novas Reservas", "canCreateBookings", Plus, "text-orange-700")}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Visualização</p>
                    {renderPermissionToggle("Agenda Total", "canViewAllAppointments", Eye, "bg-blue-50/30")}
                    {renderPermissionToggle("Por Segmento", "canViewSegmentAppointments", Eye, "bg-purple-50/30")}
                    {renderPermissionToggle("Por Turma", "canViewClassAppointments", Eye, "bg-orange-50/30")}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-destructive border-b border-destructive/10 pb-2">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase">Ações em Reservas</h3>
                  </div>
                  <div className="bg-destructive/5 p-4 rounded-2xl border border-destructive/10 space-y-3">
                    {renderPermissionToggle("Editar/Reagendar", "canEditAppointments", Edit3, "text-destructive")}
                    {renderPermissionToggle("Cancelar Sessões", "canCancelAppointments", XCircle, "text-destructive")}
                    {renderPermissionToggle("Excluir Registro", "canDeleteAppointments", Trash2, "text-destructive")}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 border-b border-green-600/10 pb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase">Controle de Status</h3>
                  </div>
                  <div className="bg-green-50/50 p-4 rounded-2xl border border-green-200 space-y-3">
                    <p className="text-[10px] font-bold text-green-700 uppercase mb-2">Pode aplicar os status:</p>
                    {renderPermissionToggle("Validar Status", "canChangeStatus", CheckCircle2, "text-green-800")}
                    <Separator className="my-2" />
                    {renderPermissionToggle("Aguard. Confirmação", "canStatusPending", Clock)}
                    {renderPermissionToggle("Confirmar Sessão", "canStatusConfirmed", CheckCircle2, "text-green-700")}
                    {renderPermissionToggle("Concluir Sessão", "canStatusCompleted", CheckCircle, "text-slate-700")}
                    {renderPermissionToggle("Solicitar Reagendamento", "canStatusReScheduleRequest", AlertTriangle, "text-yellow-700")}
                    {renderPermissionToggle("Marcar como Reagendado", "canStatusRescheduled", Edit3, "text-blue-700")}
                    {renderPermissionToggle("Marcar como Cancelado", "canStatusCancelled", XCircle, "text-destructive")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-white border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-2xl h-12 px-8">Cancelar</Button>
          <Button onClick={handleUpdate} className="rounded-2xl h-12 px-10 gap-2 shadow-xl hover:scale-105 transition-transform">
            <Save className="w-5 h-5" /> 
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
