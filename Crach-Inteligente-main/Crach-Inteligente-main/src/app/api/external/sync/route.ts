
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

/**
 * Utilitário para converter o formato de turma do Activesoft
 * Ex: "EM / 3º Ano / A - M" -> Segmento: "Ensino Médio", Turma: "3º Ano A"
 */
function parseSigaTurma(raw: string) {
  if (!raw || !raw.includes('/')) return { segmento: 'Sincronizado', turma: raw || 'SIGA' };
  
  const parts = raw.split('/').map(p => p.trim());
  let segmento = parts[0];
  
  // Mapeamento de siglas para nomes amigáveis
  if (segmento === 'EI') segmento = 'Educação Infantil';
  else if (segmento === 'EF') segmento = 'Ensino Fundamental';
  else if (segmento === 'EM') segmento = 'Ensino Médio';
  
  const ano = parts[1] || '';
  const turmaLetra = parts[2]?.split('-')[0].trim() || '';
  const turma = `${ano} ${turmaLetra}`.trim();
  
  return { segmento, turma };
}

/**
 * Endpoint para espelhamento automático de alunos.
 * Suporta o formato padrão e o formato Activesoft (array 'results', 'turma_oficial' e 's3' para fotos).
 */
export async function POST(request: Request) {
  try {
    const { firestore } = initializeFirebase();
    const apiKey = request.headers.get('x-api-key');

    // 1. Validar chave de segurança
    const configSnap = await getDocs(query(collection(firestore, 'configuracoes'), where('apiSecret', '==', apiKey)));
    
    if (configSnap.empty || !apiKey) {
      return NextResponse.json({ error: 'Chave de API inválida ou ausente.' }, { status: 401 });
    }

    const body = await request.json();
    let studentsToSync = [];

    // 2. Detectar formato: Activesoft (results array) ou Objeto Único
    if (body.results && Array.isArray(body.results)) {
      studentsToSync = body.results;
    } else if (Array.isArray(body)) {
      studentsToSync = body;
    } else {
      studentsToSync = [body];
    }

    const stats = { created: 0, updated: 0, skipped: 0 };

    for (const item of studentsToSync) {
      const { nome, matricula, ativo, turma_oficial, s3, fotoUrl } = item;

      // Validação mínima para processar o registro
      if (!nome || !matricula) {
        stats.skipped++;
        continue;
      }

      // 3. Tratar segmento e turma a partir do campo oficial do SIGA se disponível
      let finalSegmento = item.segmento || 'Sincronizado';
      let finalTurma = item.turma || 'SIGA';

      if (turma_oficial) {
        const parsed = parseSigaTurma(turma_oficial);
        finalSegmento = parsed.segmento;
        finalTurma = parsed.turma;
      }

      // 4. Verificar se o aluno já existe (pela matrícula tratada como string)
      const matStr = String(matricula);
      const q = query(collection(firestore, 'alunos'), where('matricula', '==', matStr));
      const querySnapshot = await getDocs(q);

      const studentData = {
        nome: nome.trim(),
        matricula: matStr,
        segmento: finalSegmento,
        turma: finalTurma,
        fotoUrl: s3 || fotoUrl || '',
        ativo: ativo !== undefined ? !!ativo : true,
        visivelFila: true,
        enabled: true,
        updatedAt: new Date().toISOString()
      };

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(firestore, 'alunos', existingDoc.id), studentData);
        stats.updated++;
      } else {
        await addDoc(collection(firestore, 'alunos'), studentData);
        stats.created++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Processamento concluído',
      ...stats
    });

  } catch (error: any) {
    console.error('Erro no Mirroring:', error);
    return NextResponse.json({ error: 'Erro interno no servidor', details: error.message }, { status: 500 });
  }
}
