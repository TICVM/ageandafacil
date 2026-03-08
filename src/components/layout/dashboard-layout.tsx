
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
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!db || !authUser) return;
      try {
        const userEmail = authUser.email?.toLowerCase().trim();
        if (userEmail === 'herbertpacheco@cvmsp.com.br') {
          setProfile({ id: authUser.uid, email: userEmail, name: 'Herbert Pacheco', role: 'ADMIN' });
          return;
        }
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setProfile({ ...userDoc.data() as User, id: authUser.uid });
        } else if (userEmail) {
          const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            setProfile({ ...docData.data() as User, id: docData.id });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar perfil lateral:", err);
      }
    }
    fetchProfile();
  }, [db, authUser]);

  const userEmail = authUser?.email?.toLowerCase().trim();
  const isAdmin = profile?.role === 'ADMIN' || userEmail === 'herbertpacheco@cvmsp.com.br';
  const isCoordinator = profile?.role === 'COORDINATOR';
  const hasManagementAccess = isAdmin || isCoordinator;

  const menuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { title: 'Fazer Reserva', icon: CalendarDays, href: '/reserva' },
    { title: 'Agenda Global', icon: ListTodo, href: '/dashboard/appointments' },
  ];

  const adminItems = [];
  
  if (hasManagementAccess) {
    adminItems.push({ title: 'Gestão de Usuários', icon: UserCog, href: '/dashboard/admin/users' });
  }
  
  if (isAdmin) {
    adminItems.push({ title: 'Configurar Horários', icon: Clock, href: '/dashboard/admin/slots' });
    adminItems.push({ title: 'Locais de Foto', icon: MapPin, href: '/dashboard/admin/locations' });
    adminItems.push({ title: 'Turmas e Segmentos', icon: Users, href: '/dashboard/admin/classes' });
    adminItems.push({ title: 'Relatórios', icon: PieChart, href: '/dashboard/admin/reports' });
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const getRoleLabel = (role?: UserRole) => {
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'COORDINATOR') return 'Coordenador';
    return 'Professor';
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-border/40">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg"><Camera className="w-5 h-5 text-primary-foreground" /></div>
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
                {getRoleLabel(profile?.role)}
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
            {isAdmin && <Badge className="bg-blue-600">Gestor Master</Badge>}
            {isCoordinator && <Badge className="bg-purple-600">Coordenador</Badge>}
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 bg-[#ECF1FA]">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
