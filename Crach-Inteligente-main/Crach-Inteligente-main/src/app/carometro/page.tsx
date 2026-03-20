"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CarometroRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Agora o Carômetro é a página inicial (/)
    router.replace("/");
  }, [router]);

  return null;
}
