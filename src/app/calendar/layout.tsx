import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchoolLens - Agenda Fácil",
  description: "Sistema inteligente de agendamento de sessões de fotos escolares e calendário de publicações.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
