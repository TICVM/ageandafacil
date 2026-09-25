"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DashboardCards, UpcomingPublicationsList } from "@/components/calendar/DashboardCards";
import { CalendarView } from "@/components/calendar/CalendarView";
import { PublicationModal } from "@/components/calendar/PublicationModal";
import { HolidaysModal } from "@/components/calendar/HolidaysModal";
import { DeadlinesModal } from "@/components/calendar/DeadlinesModal";
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
import { Publication } from "@/lib/calendar/types";

export function AppHome() {
  const [currentTab, setCurrentTab] = useState<"calendar" | "scheduler">("calendar");

  // Calendar State
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(2); // March 2026
  const [selectedPubForModal, setSelectedPubForModal] = useState<Publication | null>(null);
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [initialDateForPub, setInitialDateForPub] = useState<string | undefined>(undefined);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [isDeadlinesModalOpen, setIsDeadlinesModalOpen] = useState(false);

  // Scheduler State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Calendar Hooks
  const {
    publications,
    loading: pubsLoading,
    createPublication,
    updatePublication,
    deletePublication,
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

  const upcomingSorted = [...publications]
    .filter((p) => !p.isDeleted)
    .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onNewPublication={() => handleOpenNewPublication()}
        onNewBooking={() => setIsBookingModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {currentTab === "calendar" ? (
          <>
            {/* Top Dashboard Metric Cards */}
            <DashboardCards
              stats={stats}
              upcoming={upcomingSorted}
              categories={categories}
              onSelectPublication={handleSelectPublication}
              onNewPublication={() => handleOpenNewPublication()}
            />

            {/* Calendar & Upcoming Layout (2/3 + 1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
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

              <div className="lg:col-span-1">
                <UpcomingPublicationsList
                  upcoming={upcomingSorted}
                  categories={categories}
                  onSelectPublication={handleSelectPublication}
                  onNewPublication={() => handleOpenNewPublication()}
                  onDeletePublication={deletePublication}
                />
              </div>
            </div>
          </>
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
