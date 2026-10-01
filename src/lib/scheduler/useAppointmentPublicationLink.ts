"use client";

import { useEffect, useRef } from "react";
import { Appointment, SchoolClass } from "./types";
import { Publication, PublicationStatus } from "../calendar/types";
import {
  computeAssociations,
  linkKey,
  targetPublicationStatus,
} from "./association";

/**
 * Hook que sincroniza automaticamente os Agendamentos de Sessões Fotográficas
 * com as publicações obrigatórias do Controle de Publicações.
 *
 * Regras aplicadas sempre que uma sessão ou turma muda:
 *  - Sessão Confirmada/Concluída → publicação da série correspondente muda
 *    para AGENDADO (nunca rebaixa uma publicação já PUBLICADO).
 *  - Sessão Publicada no scheduler → publicação também vira PUBLICADO.
 *  - Disciplina de idioma (Inglês/Bilíngue) → Programa Bilíngue;
 *    demais disciplinas → Atividades Variadas.
 *  - O vínculo fica registrado na publicação como tag "apt:<id da sessão>",
 *    permitindo auditoria e evitando processar a mesma sessão duas vezes.
 */
export function useAppointmentPublicationLink({
  appointments,
  classes,
  publications,
  onUpdatePublication,
}: {
  appointments: Appointment[];
  classes: SchoolClass[];
  publications: Publication[];
  onUpdatePublication: (id: string, updates: Partial<Publication>) => Promise<void> | void;
}) {
  // Guarda o que já foi processado para não regravar em loop (o listener do
  // Firestore atualiza as listas e o efeito rodaria novamente a cada snapshot).
  const processedRef = useRef<Map<string, string>>(new Map());
  const busyRef = useRef(false);

  useEffect(() => {
    if (busyRef.current) return;
    if (!publications || publications.length === 0) return;

    const links = computeAssociations(appointments, classes);
    const aptById = new Map(appointments.map((a) => [a.id, a]));

    // Trabalha apenas sobre uma cópia — nunca dentro do setState do Firestore.
    const pending = links.filter((link) => {
      const key = linkKey(link.appointmentId);
      const apt = aptById.get(link.appointmentId);
      if (!apt) return false;
      const target = targetPublicationStatus(apt);

      // Publicação obrigatória correspondente (categoria + série), do mesmo
      // ano da sessão quando possível.
      const year = apt.appointmentDate.slice(0, 4);
      const candidates = publications.filter(
        (p) =>
          !p.isDeleted &&
          p.categoryId === link.categoryId &&
          p.seriesId === link.seriesId &&
          (p.tags ?? []).includes("obrigatoria")
      );
      const pub =
        candidates.find((p) => p.publicationDate.startsWith(year)) ?? candidates[0];
      if (!pub) return false;

      const alreadyLinked = (pub.tags ?? []).includes(key);
      const statusOk =
        pub.status === "AGENDADO" || pub.status === "PUBLICADO";
      const fingerprint = `${pub.id}:${key}:${target}`;

      if (alreadyLinked && statusOk) {
        processedRef.current.set(link.appointmentId, fingerprint);
        return false;
      }
      if (processedRef.current.get(link.appointmentId) === fingerprint) return false;
      return true;
    });

    if (pending.length === 0) return;

    let cancelled = false;
    busyRef.current = true;

    (async () => {
      for (const link of pending) {
        if (cancelled) break;
        const key = linkKey(link.appointmentId);
        const apt = aptById.get(link.appointmentId);
        if (!apt) continue;
        const target = targetPublicationStatus(apt) as PublicationStatus;

        const year = apt.appointmentDate.slice(0, 4);
        const candidates = publications.filter(
          (p) =>
            !p.isDeleted &&
            p.categoryId === link.categoryId &&
            p.seriesId === link.seriesId &&
            (p.tags ?? []).includes("obrigatoria")
        );
        const pub =
          candidates.find((p) => p.publicationDate.startsWith(year)) ?? candidates[0];
        if (!pub) continue;

        const tags = Array.from(new Set([...(pub.tags ?? []), key]));
        const currentIsPublished = pub.status === "PUBLICADO";
        const nextStatus: PublicationStatus =
          currentIsPublished && target !== "PUBLICADO" ? pub.status : target;

        const updates: Partial<Publication> = {};
        if (!(pub.tags ?? []).includes(key)) updates.tags = tags;
        if (pub.status !== nextStatus) updates.status = nextStatus;

        if (Object.keys(updates).length > 0) {
          try {
            await onUpdatePublication(pub.id, updates);
            processedRef.current.set(link.appointmentId, `${pub.id}:${key}:${target}`);
          } catch (err) {
            console.warn("Associação sessão→publicação falhou:", err);
          }
        } else {
          processedRef.current.set(link.appointmentId, `${pub.id}:${key}:${target}`);
        }
      }
      busyRef.current = false;
    })();

    return () => {
      cancelled = true;
      busyRef.current = false;
    };
  }, [appointments, classes, publications, onUpdatePublication]);
}
