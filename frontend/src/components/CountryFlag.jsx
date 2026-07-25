import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { countries, getCountryName, normalizeCountryCode } from '../data/countries';

export function CountryFlag({ country, className = '' }) {
  const code = normalizeCountryCode(country);
  if (!code) return null;

  return <span className={`fi fi-${code} shrink-0 ${className}`} aria-label={getCountryName(code)} title={getCountryName(code)} />;
}

export function CountrySelect({ value, onChange, disabled = false, className = '', options = countries }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const selectedCode = normalizeCountryCode(value) || 'ar';
  const selected = options.find(country => country.code === selectedCode)
    || countries.find(country => country.code === selectedCode);
  const filteredCountries = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase('es-AR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    if (!normalizedSearch) return options;

    return options.filter(country => {
      const normalizedName = country.name
        .toLocaleLowerCase('es-AR')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      return normalizedName.includes(normalizedSearch) || country.code.includes(normalizedSearch);
    });
  }, [options, search]);

  useEffect(() => {
    const close = event => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(current => !current);
          setSearch('');
        }}
        className="input-field flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-80"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <CountryFlag country={selectedCode} className="text-xl" />
          <span>{selected?.name}</span>
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full border border-racing-border bg-racing-dark p-1 shadow-2xl">
          <div className="relative m-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="input-field h-10 pl-9 text-sm"
              placeholder="Buscar país..."
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCountries.map(country => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onChange(country.code);
                  setOpen(false);
                  setSearch('');
                }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-racing-red/10 hover:text-white ${selectedCode === country.code ? 'bg-racing-red/10 text-racing-red' : 'text-gray-300'}`}
              >
                <CountryFlag country={country.code} className="text-xl" />
                {country.name}
              </button>
            ))}
            {!filteredCountries.length && (
              <p className="px-3 py-5 text-center text-sm text-gray-500">No se encontró el país.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
