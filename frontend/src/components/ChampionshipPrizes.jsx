import { BanknotesIcon, TicketIcon, TrophyIcon } from '@heroicons/react/24/outline';

const prizeTypes = [
  { field: 'efectivo', label: 'Dinero en efectivo', Icon: BanknotesIcon, colors: 'border-green-400/30 bg-green-500/10 text-green-300' },
  { field: 'inscripcion', label: 'Inscripción bonificada', Icon: TicketIcon, colors: 'border-violet-400/30 bg-violet-500/10 text-violet-300' },
  { field: 'trofeo', label: 'Trofeo', Icon: TrophyIcon, colors: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300' },
];

const positionLabel = position => {
  const numericPosition = Number(position);
  return Number.isInteger(numericPosition) && numericPosition > 0 ? `${numericPosition}º puesto` : `Posición ${position}`;
};

export default function ChampionshipPrizes({ prizes, className = '' }) {
  if (!prizes?.length) return null;

  return (
    <section className={`overflow-hidden border border-yellow-400/30 bg-racing-card ${className}`}>
      <header className="flex items-center gap-3 border-b border-yellow-400/20 bg-yellow-400/[0.06] px-4 py-4 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-yellow-400 text-black">
          <TrophyIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">Premios del campeonato</p>
          <h3 className="font-racing text-xl font-bold uppercase text-white sm:text-2xl">Premios por posición</h3>
        </div>
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {prizes.map(prize => {
          const enabledPrizes = prizeTypes.filter(type => Boolean(Number(prize[type.field])));
          return (
            <article key={prize.posicion} className="border border-racing-border bg-black/25 p-4">
              <p className="font-racing text-2xl font-bold uppercase text-yellow-300">{positionLabel(prize.posicion)}</p>
              <div className="mt-3 grid gap-2">
                {enabledPrizes.map(({ field, label, Icon, colors }) => (
                  <div key={field} className={`flex items-center gap-3 border px-3 py-2.5 ${colors}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-current/30 bg-black/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
                  </div>
                ))}
                {!enabledPrizes.length ? <p className="text-sm text-gray-500">Premio pendiente de definir.</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
