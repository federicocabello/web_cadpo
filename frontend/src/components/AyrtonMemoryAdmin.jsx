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

export default function AyrtonMemoryAdmin() {
  const [generalContext, setGeneralContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
