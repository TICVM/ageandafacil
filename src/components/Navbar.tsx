"use client";

import React, { useState } from "react";
import { Camera, Calendar, GraduationCap, Menu, Plus, Sparkles, Table2, X } from "lucide-react";

export type AppTab = "calendar" | "control" | "scheduler";

interface NavbarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onNewPublication: () => void;
  onNewBooking: () => void;
  onGeneratePlan?: () => void;
  /** Gera o plano anual SEMI-AUTOMÁTICO de Eventos Pedagógicos */
  onGeneratePedagogicalPlan?: () => void;
}

const tabItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }[] = [
  { id: "calendar", label: "Calendário Editorial", icon: Calendar, iconColor: "text-blue-600" },
  { id: "control", label: "Controle de Publicações", icon: Table2, iconColor: "text-emerald-600" },
  { id: "scheduler", label: "Sessões de Fotos", icon: Camera, iconColor: "text-indigo-600" },
];

export function Navbar({
  currentTab,
  onTabChange,
  onNewPublication,
  onNewBooking,
  onGeneratePlan,
  onGeneratePedagogicalPlan,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectTab = (tab: AppTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & School Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-foreground">
                  SchoolLens
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hidden sm:inline">
                  Agenda Fácil
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block truncate">
                Colégio &amp; Marketing • Gestão Integrada
              </p>
            </div>
          </div>

          {/* Desktop Module Switcher Tabs */}
          <div className="hidden md:flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            {tabItems.map(({ id, label, icon: Icon, iconColor }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === id
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 ${iconColor}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {currentTab === "scheduler" ? (
              <button
                onClick={onNewBooking}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar Foto</span>
              </button>
            ) : (
              <>
                {onGeneratePlan && (
                  <button
                    onClick={onGeneratePlan}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar Plano Anual</span>
                  </button>
                )}
                {onGeneratePedagogicalPlan && (
                  <button
                    onClick={onGeneratePedagogicalPlan}
                    title="Gera automaticamente as publicações dos eventos pedagógicos que se repetem todos os anos"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Eventos Pedagógicos</span>
                  </button>
                )}
                <button
                  onClick={onNewPublication}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Publicação</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-background text-foreground active:scale-95 transition-transform"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card shadow-lg">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {tabItems.map(({ id, label, icon: Icon, iconColor }) => (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-left ${
                  currentTab === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className={`w-5 h-5 ${iconColor}`} />
                <span>{label}</span>
              </button>
            ))}

            <div className="h-px bg-border my-2" />

            <div className="flex flex-col gap-2 pb-1">
              {currentTab === "scheduler" ? (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    onNewBooking();
                  }}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agendar Foto</span>
                </button>
              ) : (
                <>
                  {onGeneratePlan && (
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        onGeneratePlan();
                      }}
                      className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar Plano Anual</span>
                    </button>
                  )}
                  {onGeneratePedagogicalPlan && (
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        onGeneratePedagogicalPlan();
                      }}
                      className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Eventos Pedagógicos</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      onNewPublication();
                    }}
                    className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nova Publicação</span>
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
