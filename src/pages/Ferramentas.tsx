function parseMovementDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }

    if (typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000);
    }
  }

  return null;
}

function formatMovementDate(date: Date | null) {
  if (!date) return '--/--/----';
  return format(date, 'dd/MM/yyyy');
}

function formatMovementTime(date: Date | null) {
  if (!date) return '--:--';
  return format(date, 'HH:mm');
}

function LogItem({
  log,
  tool,
  obra,
  showToolInfo = true
}: {
  key?: string | number,
  log: ToolLog,
  tool?: Tool,
  obra?: Obra,
  showToolInfo?: boolean
}) {

  const isPending = log.statusLog === 'Aberta';

  // HORÁRIOS FIXOS VINDOS DO BANCO
  const retiradaDate = parseMovementDate(log.dataSaida);
  const devolucaoDate = parseMovementDate(log.dataDevolucao);

  return (
    <div className="p-5 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0">

      <div className="flex flex-col gap-3">

        <div className="flex items-start justify-between gap-4">

          <div className="flex-1 min-w-0">

            {showToolInfo && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isPending
                      ? "bg-orange-500 animate-pulse"
                      : "bg-green-500"
                  )}
                />

                <span className="text-sm font-bold text-zinc-900 truncate">
                  {tool?.nome || 'Ferramenta Removida'}
                </span>

                <span className="text-[10px] text-zinc-400 font-mono">
                  #{tool?.codigo || '---'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                </div>

                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">
                    Responsável
                  </p>

                  <p className="text-xs font-bold text-zinc-900 truncate">
                    {log.responsavelNome}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                </div>

                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">
                    Obra / Local
                  </p>

                  <p className="text-xs font-bold text-zinc-900 truncate">
                    {obra?.nome || 'Obra Removida'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* HORÁRIOS FIXOS */}
          <div className="text-right shrink-0 min-w-[110px] space-y-3">

            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
                Retirada em
              </div>

              <div className="text-xs font-bold text-zinc-900">
                {formatMovementDate(retiradaDate)}
              </div>

              <div className="text-[10px] text-blue-600 font-bold">
                {formatMovementTime(retiradaDate)}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">
                Devolução em
              </div>

              <div className="text-xs font-bold text-zinc-900">
                {formatMovementDate(devolucaoDate)}
              </div>

              <div className="text-[10px] text-green-600 font-bold">
                {formatMovementTime(devolucaoDate)}
              </div>
            </div>

          </div>
        </div>

        <div className="flex items-center justify-between pt-1">

          <span
            className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight flex items-center gap-1",
              isPending
                ? "bg-orange-100 text-orange-700"
                : "bg-green-100 text-green-700"
            )}
          >
            {isPending ? (
              <>
                <Clock className="w-2.5 h-2.5" />
                Pendente
              </>
            ) : (
              <>
                <CheckCircle2 className="w-2.5 h-2.5" />
                Concluído
              </>
            )}
          </span>

        </div>

      </div>
    </div>
  );
}