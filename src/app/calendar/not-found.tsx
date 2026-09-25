import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <h2 className="text-3xl font-bold mb-2">Página não encontrada</h2>
      <p className="text-muted-foreground mb-4">A página que você procura não existe ou foi movida.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
