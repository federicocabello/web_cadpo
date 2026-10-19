import { useEffect, useState } from 'react';
import { ayrtonApi } from '../services/api';

const normalizeGeneralContext = value => String(value || '')
  .toUpperCase()
  .replace(/\r\n?/g, '\n')
  .replace(/\.+(?=\s|$)|\n+/g, '; ')
  .replace(/\s*;\s*/g, '; ')
  .replace(/(?:;\s*){2,}/g, '; ')
  .trim()
  .replace(/;\s*$/, '')
  .slice(0, 12000);

const formatGeneralContext = value => normalizeGeneralContext(value)
  .split(';')
  .map(sentence => sentence.trim())
  .filter(Boolean)
  .map(sentence => `${sentence};`)
  .join('\n');

const formatNumber = value => new Intl.NumberFormat('es-AR').format(Number(value || 0));

const formatCloudflareDate = value => {
  if (!value) return 'Sin registros todavía';
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(normalized));
};

const formatUsageDay = value => new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  day: '2-digit',
}).format(new Date(`${value}T00:00:00Z`));

const formatUsageMonth = value => {
  if (!value) return 'MES ACTUAL';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00Z`)).toUpperCase();
};

export default function AyrtonMemoryAdmin() {
  const [generalContext, setGeneralContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageMessage, setUsageMessage] = useState('');

  const loadUsage = async () => {
    setUsageLoading(true);
    setUsageMessage('');
    try {
      const response = await ayrtonApi.getAdminUsage();
      setUsage(response.data.data || null);
    } catch (error) {
      setUsageMessage(error.response?.data?.error || 'No se pudo consultar el consumo de Cloudflare');
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
      try {
        const response = await ayrtonApi.getAdminContext();
        if (active) setGeneralContext(formatGeneralContext(response.data.data?.content || ''));
      } catch (error) {
        if (active) setMessage(error.response?.data?.error || 'No se pudo cargar el contexto de Ayrton');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadContext();
    loadUsage();
    return () => { active = false; };
  }, []);

  const saveGeneralContext = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const normalizedContext = normalizeGeneralContext(generalContext);
      const response = await ayrtonApi.updateAdminContext(normalizedContext);
      setGeneralContext(formatGeneralContext(normalizedContext));
      setMessage(response.data.message || 'Contexto general actualizado.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo guardar el contexto general');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-racing-border pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#20f4d0]">CADPO Team Radio</p>
        <h2 className="font-racing text-3xl font-bold uppercase text-white">Contexto de Ayrton</h2>
      </header>

      {message ? <div className="border border-[#20f4d0]/30 bg-[#20f4d0]/[0.07] px-4 py-3 text-sm text-[#9fffee]">{message}</div> : null}

      <section className="border border-[#f48120]/30 bg-[#f48120]/[0.035] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#f48120]">Cloudflare Workers AI</p>
            <h3 className="font-racing text-xl font-bold uppercase text-white">Consumo de Ayrton</h3>
            <p className="mt-1 text-xs text-gray-500">Tokens informados por Cloudflare y consumo diario convertido a neuronas para el modelo activo.</p>
          </div>
          <button type="button" onClick={loadUsage} disabled={usageLoading} className="border border-[#f48120]/40 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[#ffad66] transition hover:bg-[#f48120]/10 disabled:opacity-40">
            {usageLoading ? 'Consultando…' : 'Actualizar'}
          </button>
        </div>

        {usageMessage ? <div className="mt-4 border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">{usageMessage}</div> : null}

        {!usageLoading && usage ? <div className="mt-4 border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500">Utilizado hoy</p>
              <p className={`font-racing text-4xl font-bold ${Number(usage.neurons?.percentageToday || 0) >= 90 ? 'text-red-400' : Number(usage.neurons?.percentageToday || 0) >= 70 ? 'text-amber-300' : 'text-[#20f4d0]'}`}>
                {Number(usage.neurons?.percentageToday || 0).toFixed(1).replace('.', ',')}%
              </p>
            </div>
            <div className="text-left text-[10px] uppercase leading-relaxed text-gray-500 sm:text-right">
              <p>Límite diario: <strong className="text-white">{formatNumber(usage.neurons?.dailyLimit)} neuronas</strong></p>
              <p>Disponible: <strong className="text-[#20f4d0]">{Math.max(0, 100 - Number(usage.neurons?.percentageToday || 0)).toFixed(1).replace('.', ',')}%</strong></p>
              <p>Reinicia: <strong className="text-gray-300">{formatCloudflareDate(usage.neurons?.resetAt)} H</strong></p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500">Consumo diario del mes</p>
                <p className="mt-0.5 text-[10px] font-bold tracking-[0.08em] text-white">{formatUsageMonth(usage.month)}</p>
              </div>
              <p className="text-[9px] uppercase text-gray-600">100% = límite diario</p>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="relative h-64 min-w-[760px] border-b border-l border-white/15 px-3 pt-7">
                {[100, 75, 50, 25].map(level => (
                  <div key={level} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-white/[0.07]" style={{ bottom: `${22 + (level * 1.92)}px` }}>
                    <span className="absolute -top-3 left-1 bg-[#121317] px-1 text-[7px] tabular-nums text-gray-700">{level}%</span>
                  </div>
                ))}
                <div className="relative z-10 flex h-full items-end gap-1.5 pl-5">
                  {(usage.currentMonth || []).map(day => {
                    const percentage = Math.max(0, Number(day.percentage || 0));
                    const visibleHeight = percentage > 0 ? Math.max(3, Math.min(100, percentage)) : 0;
                    const isToday = day.day === new Date().toISOString().slice(0, 10);
                    return <div key={day.day} className={`group flex h-full min-w-0 flex-1 flex-col items-center justify-end ${day.isFuture ? 'opacity-25' : ''}`}>
                      <div className="relative flex h-48 w-full items-end overflow-hidden bg-white/[0.018]">
                        <div
                          title={`${formatUsageDay(day.day)} • ${percentage.toFixed(1).replace('.', ',')}% • ${formatNumber(Math.round(day.neurons))} neuronas • ${formatNumber(day.requests)} consultas`}
                          className={`w-full transition-all duration-500 group-hover:brightness-125 ${percentage >= 90 ? 'bg-gradient-to-t from-red-700 to-red-400' : percentage >= 70 ? 'bg-gradient-to-t from-amber-600 to-amber-300' : isToday ? 'bg-gradient-to-t from-[#087f70] to-[#20f4d0]' : 'bg-gradient-to-t from-[#8c3f0d] to-[#f48120]'}`}
                          style={{ height: `${visibleHeight}%` }}
                        />
                      </div>
                      <span className={`mt-1.5 text-center text-[7px] font-bold tabular-nums ${isToday ? 'text-[#20f4d0]' : 'text-gray-600'}`}>{formatUsageDay(day.day)}</span>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[9px] uppercase leading-relaxed text-gray-600">Al llegar al 100%, Ayrton se bloquea hasta el reinicio diario. Los porcentajes se calculan con el consumo informado por Cloudflare.</p>
          {Number(usage.requests?.previousUntracked || 0) > 0 ? <p className="mt-1 text-[9px] text-amber-400/70">Las {formatNumber(usage.requests.previousUntracked)} consultas anteriores a esta medición no se incluyen en el gráfico.</p> : null}
        </div> : null}
      </section>

      <form onSubmit={saveGeneralContext} className="border border-[#20f4d0]/25 bg-[#20f4d0]/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-racing text-xl font-bold uppercase text-white">Contexto general de CADPO</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500">Escribí acá las reglas, aclaraciones y datos que Ayrton debe considerar al responder. El historial de conversaciones no se utiliza como contexto.</p>
          </div>
          <span className="shrink-0 text-[9px] tabular-nums text-gray-600">{generalContext.length}/12.000</span>
        </div>

        <textarea
          value={generalContext}
          onChange={event => setGeneralContext(event.target.value.toUpperCase().slice(0, 12000))}
          rows={12}
          maxLength={12000}
          disabled={loading}
          placeholder="ESCRIBÍ EL CONTEXTO QUE AYRTON DEBE TENER EN CUENTA..."
          className="input-field mt-4 min-h-72 resize-y uppercase disabled:opacity-50"
        />

        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={loading || saving} className="bg-[#20f4d0] px-5 py-2.5 font-racing text-xs font-bold uppercase text-black disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar contexto'}
          </button>
        </div>
      </form>
    </div>
  );
}
