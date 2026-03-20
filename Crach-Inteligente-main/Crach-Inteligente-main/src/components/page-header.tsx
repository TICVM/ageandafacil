
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Grid3X3, 
  ShieldCheck, 
  ChevronDown,
  UserCog,
  LogOut,
  User,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import { type SystemConfig } from "@/lib/types";

export default function PageHeader() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  
  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'configuracoes', 'geral') : null, [firestore]);
  const { data: configData, isLoading: isConfigLoading } = useDoc<SystemConfig>(configRef);

  const fallbackLogoUrl = PlaceHolderImages.find(img => img.id === 'app-logo')?.imageUrl || "";
  const logoUrl = configData?.logoUrl || fallbackLogoUrl;
  const logoHeight = configData?.logoHeight || 48;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="bg-card shadow-sm no-print border-b">
        <div className="container mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-32 h-12 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </header>
    );
  }

  const isAdminActive = pathname.startsWith("/gestao");
  const isUserAdmin = user && !user.isAnonymous;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <header className="bg-card shadow-sm no-print border-b sticky top-0 z-50 backdrop-blur-sm bg-card/90">
      <div className="container mx-auto p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="relative min-w-48 overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity" style={{ height: `${Math.max(48, logoHeight)}px` }}>
            {isConfigLoading ? (
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
            ) : (
              <img 
                src={logoUrl} 
                alt="Logo do Sistema" 
                className="max-w-full object-contain"
                style={{ height: `${logoHeight}px` }}
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-text')) {
                    const span = document.createElement('span');
                    span.className = 'fallback-text text-xl font-bold text-primary text-center leading-tight uppercase';
                    span.innerText = 'Identifica\nmais';
                    parent.appendChild(span);
                  }
                }}
              />
            )}
          </Link>
          <div className="hidden lg:flex flex-col gap-0 border-l pl-6 py-1 border-border">
            <h1 className="text-xl font-bold text-primary tracking-tight">Identifica mais</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
              Seu crachá em um clique!
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
          <Link href="/">
            <Button 
              variant={pathname === "/" ? "default" : "ghost"} 
              size="sm" 
              className={cn("gap-2 h-8 text-xs", pathname === "/" && "shadow-sm")}
            >
              <Grid3X3 size={14} />
              Carômetro
            </Button>
          </Link>
          <Link href="/gerenciador">
            <Button 
              variant={pathname === "/gerenciador" ? "default" : "ghost"} 
              size="sm" 
              className={cn("gap-2 h-8 text-xs", pathname === "/gerenciador" && "shadow-sm")}
            >
              <LayoutDashboard size={14} />
              Crachás
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={isAdminActive ? "default" : "ghost"} 
                size="sm" 
                className={cn("gap-2 h-8 text-xs", isAdminActive && "shadow-sm")}
              >
                <ShieldCheck size={14} />
                Administrador
                <ChevronDown size={12} className="ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <DropdownMenuLabel className="flex items-center gap-2 px-2 py-3">
                <div className="bg-primary/10 p-2 rounded-full text-primary">
                  <User size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Ambiente Seguro</span>
                  <span className="text-[10px] text-muted-foreground">{isUserAdmin ? user.email : "Acesso restrito"}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <Link href="/gestao">
                <DropdownMenuItem className="cursor-pointer gap-3 py-3 rounded-md">
                  <div className="bg-primary/5 p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                    <UserCog size={18} className="text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Gestão Escolar</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Painel Administrativo</span>
                  </div>
                </DropdownMenuItem>
              </Link>
              
              {isUserAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer gap-3 py-3 rounded-md text-destructive focus:text-destructive focus:bg-destructive/5"
                    onClick={handleLogout}
                  >
                    <div className="bg-destructive/10 p-2 rounded-lg">
                      <LogOut size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">Sair</span>
                      <span className="text-[10px] leading-tight">Encerrar sessão</span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
