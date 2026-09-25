"use client";

import React from "react";
import { Camera, Calendar, Plus, Sparkles } from "lucide-react";

interface NavbarProps {
  currentTab: "calendar" | "scheduler";
  onTabChange: (tab: "calendar" | "scheduler") => void;
  onNewPublication: () => void;
  onNewBooking: () => void;
}

export function Navbar({
  currentTab,
  onTabChange,
  onNewPublication,
  onNewBooking,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & School Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-foreground">
                  SchoolLens
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  Agenda Fácil
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Colégio &amp; Marketing • Gestão Integrada
              </p>
            </div>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            <button
              onClick={() => onTabChange("calendar")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentTab === "calendar"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Calendário Editorial</span>
            </button>

            <button
              onClick={() => onTabChange("scheduler")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentTab === "scheduler"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-4 h-4 text-indigo-600" />
              <span>Sessões de Fotos</span>
            </button>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2">
            {currentTab === "calendar" ? (
              <button
                onClick={onNewPublication}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Publicação</span>
                <span className="sm:hidden">Publicação</span>
              </button>
            ) : (
              <button
                onClick={onNewBooking}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Agendar Foto</span>
                <span className="sm:hidden">Agendar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
