import { Atividade } from '../types';
import { collection, db, doc, getDocs, serverTimestamp, setDoc } from './supabaseDb';

export function getLocalDateKey(date = new Date(), timeZone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function calculateProgressSnapshot(atividades: Atividade[]) {
  const totalPrevisto = atividades.reduce((sum, atividade) => (
    sum + Number(atividade.quantidadePrevista || 0)
  ), 0);
  const totalExecutado = atividades.reduce((sum, atividade) => (
    sum + Number(atividade.quantidadeExecutada || 0)
  ), 0);
  const percentual = totalPrevisto > 0
    ? Math.min(100, (totalExecutado / totalPrevisto) * 100)
    : 0;

  return {
    percentual: Number(percentual.toFixed(4)),
    totalPrevisto,
    totalExecutado,
  };
}

export async function refreshDailyProgressSnapshot() {
  const allAtivSnap = await getDocs(collection(db, 'atividades'));
  const atividades = allAtivSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Atividade[];
  const today = getLocalDateKey();
  const snapshot = calculateProgressSnapshot(atividades);

  await setDoc(doc(db, 'progresso_diario', today), {
    id: today,
    data: today,
    ...snapshot,
    updatedAt: serverTimestamp(),
  });
}
