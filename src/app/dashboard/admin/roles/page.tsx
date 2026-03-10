
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
import { ShieldCheck, Plus, Trash2, Edit2, Loader2, Save, Eye, XCircle, MapPin, Users, Clock, Camera, FileBarChart, UserCog, CheckCircle2, CheckCircle } from 'lucide-react';
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
  canCancelAppointments: false,
  canDeleteAppointments: false,
  canCreateBookings: true,
  canChangeStatus: false,
  canStatusPending: false,
  canStatusConfirmed: false,
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
      toast({ title: "Erro", description: "O perfil de Administrador Master não pode ser removido.", variant: "destructive" });
      return;
    }
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'roles_config', id));
    toast({ title: "Perfil removido do sistema." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestão de Perfis</h1>
          <p className="text-muted-foreground">Configure os níveis de acesso e as sub-permissões granulares.</p>
        </div>
        <Button id="add-role-modal-trigger" name="addRole" onClick={() => setIsAddDialogOpen(true)} className="rounded-xl h-11 gap-2 shadow-lg">
          <Plus className="w-4 h-4" />
          Novo Perfil
        </Button>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
        {isLoading ? (
          <div className="p-24 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
                    <div className="p-2.5 bg-primary/20 rounded-xl text-primary"><ShieldCheck className="w-4 h-4" /></div>
                    Administrador Master (Sistema)
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-widest px-3 border-none h-6">Acesso Total</Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground italic font-medium px-6">Protegido</TableCell>
              </TableRow>

              {roles?.map((role) => (
                <TableRow key={role.id} className="hover:bg-accent/5 transition-colors">
                  <TableCell className="font-bold text-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-muted rounded-xl text-muted-foreground"><ShieldCheck className="w-4 h-4" /></div>
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {role.canViewAllAppointments ? <Badge variant="outline" className="text-[9px] bg-blue-50 border-blue-100 text-blue-700 font-bold uppercase">Total</Badge> : 
                       role.canViewSegmentAppointments ? <Badge variant="outline" className="text-[9px] bg-purple-50 border-purple-100 text-purple-700 font-bold uppercase">Segmento</Badge> :
                       <Badge variant="outline" className="text-[9px] bg-orange-50 border-orange-100 text-orange-700 font-bold uppercase">Turma</Badge>}
                      {role.canChangeStatus && <Badge variant="secondary" className="text-[9px] bg-green-50 text-green-700 border-green-100 font-bold uppercase">Validador</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-primary hover:bg-primary/10" 
                        onClick={() => setEditingRole(role)} 
                        aria-label="Editar perfil"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-destructive hover:bg-destructive/10" 
                        onClick={() => handleRemove(role.id)} 
                        disabled={role.name.toUpperCase() === 'ADMIN'} 
                        aria-label="Remover perfil"
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
    const switchId = `perm-switch-${field}-${role.id || 'new-role'}`;
    return (
      <div className={`flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-primary/20 transition-all ${colorClass}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted/50 rounded-lg">
            {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          </div>
          <Label htmlFor={switchId} className="text-sm font-bold text-slate-700 cursor-pointer">{label}</Label>
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
        <DialogHeader className="p-10 bg-primary text-primary-foreground relative">
          <div className="absolute right-0 top-0 p-10 opacity-10">
            <ShieldCheck className="w-32 h-32" />
          </div>
          <DialogTitle className="text-3xl font-bold flex items-center gap-3 text-primary-foreground">
            <ShieldCheck className="w-8 h-8" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/70 text-base max-w-2xl mt-2 leading-relaxed">
            Defina detalhadamente as sub-permissões para cada módulo do sistema, controlando o que este perfil pode ver e fazer.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] bg-[#F8FAFC]">
          <div className="p-10 space-y-12">
            <div className="space-y-4 max-w-xl">
              <Label htmlFor={`role-name-input-${role.id || 'new-role'}`} className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Identificação do Perfil</Label>
              <Input 
                id={`role-name-input-${role.id || 'new-role'}`}
                name="name"
                placeholder="Ex: Coordenador Pedagógico" 
                value={role.name} 
                onChange={(e) => setRole({ ...role, name: e.target.value })} 
                className="rounded-2xl h-14 bg-white border-slate-200 text-xl font-bold shadow-sm" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-primary border-b border-primary/10 pb-3">
                    <Users className="w-5 h-5" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Equipe e Estrutura</h3>
                  </div>
                  <div className="space-y-3">
                    {renderPermissionToggle("Gerenciar Usuários", "canManageUsers", UserCog)}
                    {renderPermissionToggle("Gerenciar Locais", "canManageLocations", MapPin)}
                    {renderPermissionToggle("Gerenciar Turmas", "canManageClasses", Users)}
                    {renderPermissionToggle("Configurar Horários", "canConfigureSlots", Clock)}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-primary border-b border-primary/10 pb-3">
                    <FileBarChart className="w-5 h-5" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Estatísticas</h3>
                  </div>
                  {renderPermissionToggle("Ver Relatórios", "canViewReports", FileBarChart)}
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-orange-600 border-b border-orange-600/10 pb-3">
                    <Camera className="w-5 h-5" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Reservas e Agenda</h3>
                  </div>
                  <div className="space-y-4">
                    {renderPermissionToggle("Fazer Novas Reservas", "canCreateBookings", Plus)}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Nível de Visualização</p>
                      {renderPermissionToggle("Ver Agenda Total", "canViewAllAppointments", Eye)}
                      {renderPermissionToggle("Por Segmento", "canViewSegmentAppointments", Eye)}
                      {renderPermissionToggle("Por Turma", "canViewClassAppointments", Eye)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-destructive border-b border-destructive/10 pb-3">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Ações em Reservas</h3>
                  </div>
                  <div className="bg-destructive/5 p-6 rounded-3xl border border-destructive/10 space-y-3">
                    {renderPermissionToggle("Cancelar Sessões", "canCancelAppointments", XCircle)}
                    {renderPermissionToggle("Excluir Registro", "canDeleteAppointments", Trash2)}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-green-600 border-b border-green-600/10 pb-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Controle de Status</h3>
                  </div>
                  <div className="bg-green-50/50 p-6 rounded-3xl border border-green-200 space-y-4">
                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest border-b border-green-200 pb-2">Pode aplicar os status:</p>
                    {renderPermissionToggle("Habilitar Validação", "canChangeStatus", CheckCircle2)}
                    <Separator className="bg-green-200/50 my-2" />
                    <div className="space-y-2">
                       {renderPermissionToggle("Aguard. Confirmação", "canStatusPending", Clock)}
                       {renderPermissionToggle("Confirmar Sessão", "canStatusConfirmed", CheckCircle2)}
                       {renderPermissionToggle("Concluir Sessão", "canStatusCompleted", CheckCircle)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-10 bg-white border-t flex gap-4">
          <Button variant="outline" onClick={onClose} className="rounded-2xl h-14 px-10 font-bold border-slate-200">Cancelar</Button>
          <Button id="save-role-config-button" name="saveRole" onClick={onSave} className="rounded-2xl h-14 px-12 gap-3 shadow-xl hover:scale-105 transition-transform font-bold text-lg">
            <Save className="w-6 h-6" /> 
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
