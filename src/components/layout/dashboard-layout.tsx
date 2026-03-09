
'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  LogOut,
  Camera,
  MapPin,
  Users,
  Clock,
  PieChart,
  UserCog,
  ShieldAlert,
} from 'lucide-react';
import { User, RoleConfig, AppPermissions } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { useState, useEffect } from 'react';

const DEFAULT_PERMS: AppPermissions = {
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

const ADMIN_PERMS: AppPermissions = {
  canManageUsers: true,
  canConfigureSlots: true,
  canManageLocations: true,
  canManageClasses: true,
  canViewReports: true,
  canViewAllAppointments: true,
  canViewSegmentAppointments: true,
  canViewClassAppointments: true,
  canEditAppointments: true,
  canCancelAppointments: true,
  canDeleteAppointments: true,
  canCreateBookings: true,
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions>(DEFAULT_PERMS);
  const [roleName, setRoleName] = useState('');

  useEffect(() => {
    async function fetchProfileAndPerms() {
      if (!db || !authUser) return;
      try {
        const userEmail = authUser.email?.toLowerCase().trim();
        let userDocData: User | null = null;

        // Verificação Master Admin por E-mail (Garante acesso absoluto)
        if (userEmail === 'herbertpacheco@cvmsp.com.br') {
          setProfile({
            id: authUser.uid,
            email: userEmail,
            name: 'Herbert Pacheco',
            roleId: 'ADMIN'
          });
          setUserPerms(ADMIN_PERMS);
          setRoleName('Administrador Master');
          return;
        }

        // 1. Busca perfil do usuário pelo UID
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          userDocData = { ...userDoc.data() as User, id: authUser.uid };
        } else if (userEmail) {
          // Fallback por e-mail
          const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            userDocData = { ...docData.data() as User, id: docData.id };
          }
        }

        if (userDocData) {
          setProfile(userDocData);
          
          // 2. Busca permissões baseadas no cargo (Role)
          if (userDocData.roleId) {
            // Se for string "ADMIN", dá perms totais
            if (userDocData.roleId.toUpperCase() === 'ADMIN') {
              setUserPerms(ADMIN_PERMS);
              setRoleName('Administrador');
            } else {
              const roleDoc = await getDoc(doc(db, 'roles_config', userDocData.roleId));
              if (roleDoc.exists()) {
                const roleData = roleDoc.data() as RoleConfig;
                setUserPerms({
                  canManageUsers: !!roleData.canManageUsers,
                  canConfigureSlots: !!roleData.canConfigureSlots,
                  canManageLocations: !!roleData.canManageLocations,
                  canManageClasses: !!roleData.canManageClasses,
                  canViewReports: !!roleData.canViewReports,
                  canViewAllAppointments: !!roleData.canViewAllAppointments,
                  canViewSegmentAppointments: !!roleData.canViewSegmentAppointments,
                  canViewClassAppointments: !!roleData.canViewClassAppointments,
                  canEditAppointments: !!roleData.canEditAppointments,
                  canCancelAppointments: !!roleData.canCancelAppointments,
                  canDeleteAppointments: !!roleData.canDeleteAppointments,
                  canCreateBookings: !!roleData.canCreateBookings,
                });
                setRoleName(roleData.name);
              } else {
                setUserPerms(DEFAULT_PERMS);
                setRoleName('Usuário Padrão');
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar permissões laterais:", err);
      }
    }
    fetchProfileAndPerms();
  }, [db, authUser]);

  const menuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { title: 'Fazer Reserva', icon: CalendarDays, href: '/reserva' },
  ];

  if (userPerms.canViewAllAppointments || userPerms.canViewSegmentAppointments || userPerms.canViewClassAppointments) {
    menuItems.push({ title: 'Agenda Global', icon: ListTodo, href: '/dashboard/appointments' });
  }

  const adminItems = [];
  
  if (userPerms.canManageUsers) {
    adminItems.push({ title: 'Gestão de Equipe', icon: UserCog, href: '/dashboard/admin/users' });
    adminItems.push({ title: 'Perfis e Permissões', icon: ShieldAlert, href: '/dashboard/admin/roles' });
  }
  
  if (userPerms.canConfigureSlots) {
    adminItems.push({ title: 'Configurar Horários', icon: Clock, href: '/dashboard/admin/slots' });
  }

  if (userPerms.canManageLocations) {
    adminItems.push({ title: 'Locais de Foto', icon: MapPin, href: '/dashboard/admin/locations' });
  }

  if (userPerms.canManageClasses) {
    adminItems.push({ title: 'Turmas e Segmentos', icon: Users, href: '/dashboard/admin/classes' });
  }

  if (userPerms.canViewReports) {
    adminItems.push({ title: 'Relatórios', icon: PieChart, href: '/dashboard/admin/reports' });
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-border/40">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg shadow-sm"><Camera className="w-5 h-5 text-primary-foreground" /></div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-lg leading-none text-primary">SchoolLens</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Scheduler</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className="rounded-xl">
                  <a href={item.href}>
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {adminItems.length > 0 && (
            <>
              <div className="mt-8 mb-2 px-4 group-data-[collapsible=icon]:hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Administração</span>
              </div>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className="rounded-xl">
                      <a href={item.href}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </>
          )}
        </SidebarContent>
        <SidebarFooter className="p-4">
          <Separator className="mb-4" />
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center overflow-hidden">
            <Avatar className="w-9 h-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold uppercase">
                {profile?.name?.charAt(0) || authUser?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden max-w-[130px]">
              <span className="text-sm font-bold truncate">{profile?.name || authUser?.email?.split('@')[0]}</span>
              <span className="text-[9px] text-primary font-bold uppercase tracking-tighter">
                {roleName || 'Perfil Padrão'}
              </span>
            </div>
            <button onClick={handleLogout} className="ml-auto p-2 hover:text-destructive transition-colors group-data-[collapsible=icon]:hidden">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center border-b px-6 bg-white/70 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger className="text-primary" />
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Unidade Colégio VMS</span>
              <span className="text-sm font-bold text-primary">{profile?.name || authUser?.email}</span>
            </div>
            {roleName && (
              <Badge variant="secondary" className={roleName.includes('Admin') ? "bg-primary text-primary-foreground" : "bg-purple-100 text-purple-700"}>
                {roleName}
              </Badge>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 bg-[#ECF1FA]">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
