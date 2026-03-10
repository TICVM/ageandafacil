
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building2, ShieldCheck } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { AppSettings } from '@/lib/types';

export default function SettingsAdminPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [schoolName, setSchoolName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => db ? doc(db, 'app_settings', 'general') : null, [db]);
  const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);

  useEffect(() => {
    if (appSettings) {
      setSchoolName(appSettings.schoolName || '');
    }
  }, [appSettings]);

  const handleSave = () => {
    if (!db || !settingsRef) return;
    
    setIsSaving(true);
    setDocumentNonBlocking(settingsRef, { schoolName }, { merge: true });
    
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Configurações Salvas", description: "O nome da unidade foi atualizado em todo o sistema." });
    }, 500);
  };

  const isMaster = authUser?.email === 'herbertpacheco@cvmsp.com.br';

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie as informações globais exibidas no SchoolLens.</p>
      </div>

      <div className="max-w-2xl">
        <Card className="border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Identidade Visual</CardTitle>
                <CardDescription>Defina o nome da unidade escolar que aparece no topo das páginas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="school-name-input" className="text-sm font-bold uppercase tracking-wider text-slate-500">Nome da Unidade / Escola</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  id="school-name-input"
                  name="schoolName"
                  placeholder="Ex: Unidade Colégio VMS" 
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="pl-10 h-12 rounded-xl text-lg bg-[#F8FAFC] border-slate-200"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">Este texto aparecerá no cabeçalho superior de todas as páginas do dashboard.</p>
            </div>

            {isMaster && (
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-primary">Acesso Master Ativado</p>
                  <p className="text-xs text-slate-600">Você tem permissão total para alterar configurações globais do sistema.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="p-8 bg-[#F8FAFC] border-t flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="rounded-2xl h-12 px-8 gap-2 shadow-xl hover:scale-105 transition-transform"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Alterações
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
