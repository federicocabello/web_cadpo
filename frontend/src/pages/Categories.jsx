import { useEffect, useMemo, useState } from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import { championshipsApi } from '../services/api';

export default function Categories() {
  const [championships, setChampionships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await championshipsApi.getAll();
        setChampionships(res.data.data ?? []);
      } catch (err) {
        console.error('Error cargando categorías:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const categories = useMemo(() => {
    const map = new Map();

    championships.forEach(championship => {
      if (!championship.idcategoria || !championship.categoria) return;

      const current = map.get(championship.idcategoria) ?? {
        id: championship.idcategoria,
        categoria: championship.categoria,
        logo: championship.categoria_logo,
        campeonatos: 0,
      };

      current.campeonatos += 1;
      map.set(championship.idcategoria, current);
    });

    return [...map.values()].sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [championships]);

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Campeonatos</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Categorías <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Listado de categorías con campeonatos cargados en la base.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
              <article key={category.id} className="card-glass p-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg border border-racing-red/25 bg-black flex items-center justify-center overflow-hidden">
                  {category.logo ? (
                    <img src={category.logo} alt={category.categoria} className="h-full w-full object-contain p-2" />
                  ) : (
                    <TagIcon className="w-7 h-7 text-racing-red" />
                  )}
                </div>
                <div>
                  <h2 className="font-racing text-2xl font-bold text-white">{category.categoria}</h2>
                  <p className="text-sm text-gray-400">{category.campeonatos} campeonato{category.campeonatos !== 1 ? 's' : ''}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-glass p-16 text-center">
            <TagIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">Sin categorías</h3>
            <p className="text-gray-500 text-sm">Todavía no hay categorías con campeonatos cargados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
