import { TrophyIcon } from '@heroicons/react/24/outline';

export default function Results() {
  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Competencia</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Resultados <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Sección preparada para listar resultados por campeonato, ronda, circuito y piloto.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card-glass p-12 text-center">
          <TrophyIcon className="w-14 h-14 mx-auto mb-4 text-racing-red" />
          <h2 className="font-racing text-2xl font-bold mb-2">Resultados en preparación</h2>
          <p className="text-gray-400">La API de resultados ya existe; falta armar los filtros y la vista final.</p>
        </div>
      </div>
    </div>
  );
}
