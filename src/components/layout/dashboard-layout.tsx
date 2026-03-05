
'use client';

import { useEffect, useState } from 'react';
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
  Settings,
  LogOut,
  Camera,
  MapPin,
  Users,
  Clock,
  PieChart,
} from 'lucide-react';
import { User } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      router.push('/');
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [router]);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const menuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { title: 'Agendar Foto', icon: CalendarDays, href: '/dashboard/schedule' },
    { title: 'Meus Agendamentos', icon: ListTodo, href: '/dashboard/appointments' },
  ];

  const adminItems = [
    { title: 'Configurar Horários', icon: Clock, href: '/dashboard/admin/slots' },
    { title: 'Locais de Foto', icon: MapPin, href: '/dashboard/admin/locations' },
    { title: 'Turmas e Segmentos', icon: Users, href: '/dashboard/admin/classes' },
    { title: 'Relatórios', icon: PieChart, href: '/dashboard/admin/reports' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

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
              <span className="text-xs text-muted-foreground">Admin Panel</span>
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
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold truncate max-w-[120px]">{user.name}</span>
              <span className="text-[10px] text-muted-foreground">{user.role}</span>
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
              <span className="text-xs text-muted-foreground font-medium">Hoje</span>
              <span className="text-sm font-bold">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
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
