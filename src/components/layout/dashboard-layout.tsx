
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
  Loader2,
} from 'lucide-react';
import { User } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  // Referência memoizada para o documento do usuário logado
  const userProfileRef = useMemoFirebase(() => 
    authUser && db ? doc(db, 'users', authUser.uid) : null, 
    [authUser, db]
  );

  // Hook reativo para buscar os dados do perfil (incluindo o papel/role)
  const { data: profile, isLoading: loadingProfile } = useDoc<User>(userProfileRef);

  const isAdmin = profile?.role === 'ADMIN';

  const menuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { title: 'Fazer Reserva', icon: CalendarDays, href: '/reserva' },
    { title: 'Agenda Global', icon: ListTodo, href: '/dashboard/appointments' },
  ];

  const adminItems = [
    { title: 'Gestão de Usuários', icon: UserCog, href: '/dashboard/admin/users' },
    { title: 'Configurar Horários', icon: Clock, href: '/dashboard/admin/slots' },
    { title: 'Locais de Foto', icon: MapPin, href: '/dashboard/admin/locations' },
    { title: 'Turmas e Segmentos', icon: Users, href: '/dashboard/admin/classes' },
    { title: 'Relatórios', icon: PieChart, href: '/dashboard/admin/reports' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (loadingProfile && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-border/40">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Camera className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-lg leading-none">SchoolLens</span>
              <span className="text-xs text-muted-foreground">Painel de Controle</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.title}
                  className="rounded-xl"
                >
                  <a href={item.href}>
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {isAdmin && (
            <>
              <div className="mt-6 mb-2 px-4 group-data-[collapsible=icon]:hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Administração</span>
              </div>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                      className="rounded-xl"
                    >
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
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-accent text-accent-foreground font-bold">
                {profile?.name?.charAt(0) || authUser?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden max-w-[150px]">
              <span className="text-sm font-semibold truncate">{profile?.name || authUser?.email}</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">{profile?.role || 'PROFESSOR'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-auto p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors group-data-[collapsible=icon]:hidden"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center border-b px-6 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-muted-foreground font-medium">Bem-vindo</span>
              <span className="text-sm font-bold">{profile?.name || authUser?.email}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 md:p-8 bg-[#ECF1FA]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
