"use client";

import React, { useState, useEffect } from "react";
import { Navbar, AppTab } from "@/components/Navbar";
import { DashboardCards, UpcomingPublicationsList } from "@/components/calendar/DashboardCards";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ControlTables } from "@/components/calendar/ControlTables";
import { PublicationModal } from "@/components/calendar/PublicationModal";
import { HolidaysModal } from "@/components/calendar/HolidaysModal";
import { DeadlinesModal } from "@/components/calendar/DeadlinesModal";
import { GeneratePlanModal } from "@/components/calendar/GeneratePlanModal";
import { RestorePublicationsModal } from "@/components/calendar/RestorePublicationsModal";
import { BookingModal } from "@/components/scheduler/BookingModal";
import { AppointmentsList } from "@/components/scheduler/AppointmentsList";
import {
  usePublications,
  useHolidays,
  useCategories,
  useSeries,
  useProductionDeadlines,
} from "@/lib/calendar";
import { useScheduler } from "@/lib/scheduler/hooks";
import { useAppointmentPublicationLink } from "@/lib/scheduler/useAppointmentPublicationLink";
import { Publication, PublicationStatus } from "@/lib/calendar/types";
import { formatDateToISO } from "@/lib/calendar/utils";

export function AppHome() {
  const [currentTab, setCurrentTab] = useState<AppTab>("calendar");

  // Calendar State (starts on the current month).
  // Renderiza primeiro no servidor com o mês fixado (fev/início do ano letivo)
  // e ajusta para a data real do cliente após a hidratação — evita o erro de
  // hidratação (#418) quando o fuso do build difere do fuso do navegador.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(1);
  useEffect(() => {
    if (!hydrated) return;
    const now = new Date();
    setSelectedYear((y) => (y === 2026 ? now.getFullYear() : y));
    setSelectedMonth((m) => (m === 1 ? now.getMonth() : m));
  }, [hydrated]);
  const [selectedPubForModal, setSelectedPubForModal] = useState<Publication | null>(null);
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [initialDateForPub, setInitialDateForPub] = useState<string | undefined>(undefined);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [isDeadlinesModalOpen, setIsDeadlinesModalOpen] = useState(false);
  const [isGeneratePlanOpen, setIsGeneratePlanOpen] = useState(false);
  // Abre o modal "Restaurar publicações do plano anual" (ex.: quando a
  // publicação do 5º Ano do Programa Bilíngue some da tabela após uma alteração).
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restoreYear, setRestoreYear] = useState<number>(new Date().getFullYear());
  const [isUpcomingCollapsed, setIsUpcomingCollapsed] = useState(false);

  // Scheduler State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Pausa temporária da sincronia automática quando o usuário altera o status
  // manualmente na aba "Controle de Publicações" (cascata vice-versa).
  const [manualSyncPauseId, setManualSyncPauseId] = useState<string | null>(null);

  // Calendar Hooks
  const {
    publications,
    loading: pubsLoading,
    createPublication,
    updatePublication,
    deletePublication,
    restorePublication,
    duplicatePublication,
    getStats,
  } = usePublications();

  const { holidays, createHoliday, deleteHoliday } = useHolidays();
  const { categories } = useCategories();
  const { series } = useSeries();
  const { deadlines, getDeadline } = useProductionDeadlines();

  // Scheduler Hooks
  const {
    appointments,
    locations,
    classes,
    segments,
    createAppointment,
    updateStatus,
    cancelAppointment,
    deleteAppointment,
  } = useScheduler();

  // Associação automática: o status das sessões fotográficas espelha-se nas
  // publicações obrigatórias correspondentes (mapeamento completo — ver
  // src/lib/scheduler/status-mapping.ts):
  //   Editar/Pendente → Produção de Conteúdo · Em aprovação → Revisão/Aprovação
  //   Aprovado → Aprovado para publicar · Confirmado → Agendado · Publicado → Publicado
  // A publicação em edição no momento é ignorada pela sincronia.
  useAppointmentPublicationLink({
    appointments,
    classes,
    publications,
    onUpdatePublication: updatePublication,
    publicationBeingEdited: isPubModalOpen ? selectedPubForModal?.id ?? null : manualSyncPauseId,
  });

  const stats = getStats(selectedYear);

  const handleOpenNewPublication = (dateStr?: string) => {
    setSelectedPubForModal(null);
    setInitialDateForPub(dateStr);
    setIsPubModalOpen(true);
  };

  const handleSelectPublication = (pub: Publication) => {
    setSelectedPubForModal(pub);
    setIsPubModalOpen(true);
  };

  const handleGeneratePlanConfirm = async (
    newPubs: Omit<Publication, "id">[],
    toRemove: Publication[]
  ) => {
    // Remove antigas publicações obrigatórias substituídas (se selecionado)
    for (const pub of toRemove) {
      await deletePublication(pub.id);
    }
    // Cria as novas em sequência (o hook já persiste local + Firestore)
    for (const pubData of newPubs) {
      await createPublication(pubData);
    }
    // Navega o calendário para o início do plano gerado
    if (newPubs.length > 0) {
      const firstDate = [...newPubs].sort((a, b) =>
        a.publicationDate.localeCompare(b.publicationDate)
      )[0].publicationDate;
      const [y, m] = firstDate.split("-").map(Number);
      setSelectedYear(y);
      setSelectedMonth(m - 1);
    }
  };

  /**
   * Persistência das restaurações feitas no modal "Restaurar publicações do
   * plano anual": cria as que sumiram e corrige a data das que foram movidas
   * para outro ano (caso do 5º Ano do Programa Bilíngue).
   */
  const handleRestoreConfirm = async (
    toCreate: Omit<Publication, "id">[],
    toUpdate: Array<{ id: string; updates: Partial<Publication> }>
  ) => {
    for (const u of toUpdate) {
      await updatePublication(u.id, u.updates);
    }
    for (const pubData of toCreate) {
      await restorePublication(pubData);
    }
  };

  const sortedAllPublications = [...publications]
    .filter((p) => !p.isDeleted)
    .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));

  const todayStr = formatDateToISO(new Date());
  // "Próximas Publicações" mostra apenas publicações do ano atual selecionado.
  const upcomingSorted = sortedAllPublications
    .filter(
      (p) =>
        p.publicationDate.slice(0, 4) === String(selectedYear) &&
        p.publicationDate >= todayStr &&
        p.status !== "CANCELADO"
    )
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onNewPublication={() => handleOpenNewPublication()}
        onNewBooking={() => setIsBookingModalOpen(true)}
        onGeneratePlan={() => setIsGeneratePlanOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {currentTab === "calendar" ? (
          <>
            {/* Top Dashboard Metric Cards */}
            <DashboardCards
              stats={stats}
              year={selectedYear}
              upcoming={upcomingSorted}
              categories={categories}
              onSelectPublication={handleSelectPublication}
              onNewPublication={() => handleOpenNewPublication()}
            />

            {/* Calendar and Upcoming layout (2/3 + 1/3). When the list is
                collapsed, the calendar expands to occupy all available space */}
            <div
              className={`grid grid-cols-1 gap-6 ${
                isUpcomingCollapsed
                  ? "lg:grid-cols-1"
                  : "lg:grid-cols-3"
              }`}
            >
              <div className={isUpcomingCollapsed ? "" : "lg:col-span-2"}>
                <CalendarView
                  publications={publications}
                  holidays={holidays}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onYearChange={setSelectedYear}
                  onMonthChange={setSelectedMonth}
                  onSelectPublication={handleSelectPublication}
                  onCreateOnDate={(dateStr) => handleOpenNewPublication(dateStr)}
                  onOpenDeadlines={() => setIsDeadlinesModalOpen(true)}
                  onOpenHolidays={() => setIsHolidaysModalOpen(true)}
                />
              </div>

              <div className={isUpcomingCollapsed ? "lg:w-14 lg:justify-self-end" : "lg:col-span-1"}>
                <UpcomingPublicationsList
                  upcoming={upcomingSorted}
                  allPublications={sortedAllPublications.filter(
                    (p) => p.publicationDate.slice(0, 4) === String(selectedYear)
                  )}
                  categories={categories}
                  onSelectPublication={handleSelectPublication}
                  onNewPublication={() => handleOpenNewPublication()}
                  onDeletePublication={deletePublication}
                  onStatusChange={async (id, status: string) => {
                    await updatePublication(id, { status: status as PublicationStatus });
                  }}
                  collapsed={isUpcomingCollapsed}
                  onToggleCollapsed={() => setIsUpcomingCollapsed((v) => !v)}
                />
              </div>
            </div>
          </>
        ) : currentTab === "control" ? (
          <ControlTables
            publications={publications}
            seriesList={series}
            categories={categories}
            onUpdatePublication={updatePublication}
            onSelectPublication={handleSelectPublication}
            appointments={appointments}
            classes={classes}
            onUpdateAppointmentStatus={updateStatus}
            editingPublicationId={manualSyncPauseId}
            onSetEditingPublicationId={setManualSyncPauseId}
            onRequestRestore={(year) => {
              setRestoreYear(year);
              setIsRestoreOpen(true);
            }}
            onCreatePublication={createPublication}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-black text-foreground">
                  Agendamento de Sessões Fotográficas
                </h1>
                <p className="text-sm text-muted-foreground">
                  Coordenação de horários com turmas, professores e locais fotográficos.
                </p>
              </div>
            </div>

            <AppointmentsList
              appointments={appointments}
              locations={locations}
              classes={classes}
              onOpenBooking={() => setIsBookingModalOpen(true)}
              onUpdateStatus={updateStatus}
              onCancel={(id) => cancelAppointment(id)}
              onDelete={deleteAppointment}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <PublicationModal
        isOpen={isPubModalOpen}
        onClose={() => setIsPubModalOpen(false)}
        publication={selectedPubForModal}
        initialDate={initialDateForPub}
        categories={categories}
        series={series}
        holidays={holidays}
        allPublications={publications}
        appointments={appointments}
        classes={classes}
        onUpdateAppointmentStatus={updateStatus}
        onSave={async (data) => {
          await createPublication(data);
        }}
        onUpdate={async (id, updates) => {
          await updatePublication(id, updates);
        }}
        onDelete={async (id) => {
          setSelectedPubForModal(null);
          setIsPubModalOpen(false);
          await deletePublication(id);
        }}
        onDuplicate={async (id, newDate) => {
          await duplicatePublication(id, newDate, holidays);
        }}
        getDeadline={getDeadline}
      />

      <HolidaysModal
        isOpen={isHolidaysModalOpen}
        onClose={() => setIsHolidaysModalOpen(false)}
        holidays={holidays}
        onCreateHoliday={createHoliday}
        onDeleteHoliday={deleteHoliday}
      />

      <DeadlinesModal
        isOpen={isDeadlinesModalOpen}
        onClose={() => setIsDeadlinesModalOpen(false)}
        deadlines={deadlines}
        series={series}
        categories={categories}
      />

      <GeneratePlanModal
        isOpen={isGeneratePlanOpen}
        onClose={() => setIsGeneratePlanOpen(false)}
        holidays={holidays}
        existingPublications={publications}
        onConfirm={handleGeneratePlanConfirm}
      />

      <RestorePublicationsModal
        isOpen={isRestoreOpen}
        onClose={() => setIsRestoreOpen(false)}
        year={restoreYear}
        holidays={holidays}
        publications={publications}
        onRestore={handleRestoreConfirm}
      />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        locations={locations}
        classes={classes}
        segments={segments}
        existingAppointments={appointments}
        onBook={createAppointment}
      />
    </div>
  );
}
