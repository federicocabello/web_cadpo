import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArchiveBoxIcon,
  BellAlertIcon,
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  PlayCircleIcon,
  FireIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  TagIcon,
  TrashIcon,
  TrophyIcon,
  XMarkIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';
import { carBrandsApi, carsApi, categoriesApi, championshipsApi, circuitsApi, driversApi, eventsApi, monitorApi, registrationFormsApi, registrationsApi, replaysApi, resultsApi, templatesApi } from '../services/api';
import { CountryFlag, CountrySelect } from '../components/CountryFlag';
import { circuitCountries, driverCountries, getCountryName, normalizeCountryCode } from '../data/countries';
import { formatCalendarDate, parseCalendarDate, toDateTimeInputValue } from '../utils/calendarDate';
import { formatInstagramHandle, getInstagramUrl } from '../utils/instagram';
import { formatPrice } from '../utils/currency';

const toMySqlDateTime = value => {
  if (!value) return '';

  return `${value.replace('T', ' ')}:00`;
};

const formatEventDateTime = value => {
  if (!value) return '-';

  return `${formatCalendarDate(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).replace(',', '')} H`;
};

const adminSections = [
  { id: 'resultados', label: 'RESULTADOS', icon: TrophyIcon },
  { id: 'replays', label: 'REPETICIONES', icon: ArrowDownTrayIcon },
  { id: 'plantillas', label: 'PLANTILLAS', icon: ArchiveBoxIcon },
  { id: 'pilotos', label: 'PILOTOS', icon: UsersIcon },
  { id: 'categorias', label: 'CATEGORÍAS', icon: TagIcon },
  { id: 'marcas', label: 'MARCAS', icon: TagIcon },
  { id: 'autos', label: 'AUTOS', icon: WrenchIcon },
  { id: 'campeonatos', label: 'CAMPEONATOS', icon: FireIcon },
  { id: 'inscriptos', label: 'INSCRIPTOS', icon: UsersIcon },
  { id: 'formularios', label: 'FORMULARIOS', icon: ClipboardDocumentListIcon },
  { id: 'circuitos', label: 'CIRCUITOS', icon: FlagIcon },
  { id: 'fechas', label: 'FECHAS', icon: CalendarDaysIcon },
  { id: 'monitoreo', label: 'MONITOREO', icon: BellAlertIcon },
];
const adminSectionStorageKey = 'cadpo-admin-section';
const resultPointFields = [
  { key: 'presentismo', shortLabel: 'P', label: 'Presentismo' },
  { key: 'pts_qualy_sprint', shortLabel: 'QS', label: 'Qualy Sprint' },
  { key: 'pts_sprint', shortLabel: 'S', label: 'Sprint', decimal: true },
  { key: 'pts_qualy_final', shortLabel: 'QF', label: 'Qualy Final' },
  { key: 'pts_final', shortLabel: 'F', label: 'Final', decimal: true },
];
const resultSpreadsheetColumns = [
  { key: 'presentismo', label: 'Presentismo', type: 'integer' },
  { key: 'pos_qualy_sprint', label: 'Pos. QS', type: 'position' },
  { key: 'pts_qualy_sprint', label: 'Pts. QS', type: 'integer' },
  { key: 'pos_qualy_final', label: 'Pos. QF', type: 'position' },
  { key: 'pts_qualy_final', label: 'Pts. QF', type: 'integer' },
  { key: 'pos_sprint', label: 'Pos. Sprint', type: 'position' },
  { key: 'piloto_sprint', label: 'Piloto', type: 'pilot' },
  { key: 'pts_sprint', label: 'Pts. Sprint', type: 'decimal' },
  { key: 'pos_final', label: 'Pos. Final', type: 'position' },
  { key: 'piloto_final', label: 'Piloto', type: 'pilot' },
  { key: 'pts_final', label: 'Pts. Final', type: 'decimal' },
];
const resultAchievementFields = [
  { key: 'pole_sprint', label: 'Pole Sprint' },
  { key: 'ganador_sprint', label: 'Ganó Sprint' },
  { key: 'pole_final', label: 'Pole Final' },
  { key: 'ganador_final', label: 'Ganó Final' },
  { key: 'campeon', label: 'Campeón' },
];
const resultSanctionFields = [
  { key: 'desc_sancion_qualy_sprint', label: 'Clasificación Sprint' },
  { key: 'desc_sancion_sprint', label: 'Sprint' },
  { key: 'desc_sancion_qualy_final', label: 'Clasificación Final' },
  { key: 'desc_sancion_final', label: 'Final' },
];
const resultGridColumns = [
  { key: 'piloto', label: 'Piloto', type: 'pilot' },
  ...resultSpreadsheetColumns,
];
const parseNumericPosition = value => {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) && Number(normalized) > 0 ? Number(normalized) : null;
};

const buildEditableResultRows = rows => {
  const byRound = new Map();
  rows.forEach(result => {
    const roundKey = String(result.ronda);
    if (!byRound.has(roundKey)) byRound.set(roundKey, []);
    byRound.get(roundKey).push(result);
  });

  return [...byRound.values()].flatMap(roundRows => {
    const baseRows = [...roundRows].sort((a, b) => Number(a.id) - Number(b.id));
    const sortSession = field => [...roundRows].sort((a, b) => {
      const positionA = parseNumericPosition(a[field]);
      const positionB = parseNumericPosition(b[field]);
      if (positionA || positionB) return (positionA || Number.MAX_SAFE_INTEGER) - (positionB || Number.MAX_SAFE_INTEGER);
      return Number(a.id) - Number(b.id);
    });
    const sprintRows = sortSession('pos_sprint');
    const finalRows = sortSession('pos_final');

    return baseRows.map((result, index) => ({
      ...result,
      piloto_sprint: sprintRows[index]?.piloto || '',
      pos_sprint: sprintRows[index]?.pos_sprint ?? '',
      pts_sprint: sprintRows[index]?.pts_sprint ?? '',
      piloto_final: finalRows[index]?.piloto || '',
      pos_final: finalRows[index]?.pos_final ?? '',
      pts_final: finalRows[index]?.pts_final ?? '',
    }));
  });
};

const parseResultPoints = value => {
  const number = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const getResultPoints = result => Math.round(resultPointFields.reduce(
  (total, field) => total + parseResultPoints(result?.[field.key]),
  0
) * 100) / 100;
const formatResultPoints = value => Number(value || 0).toLocaleString('es-AR', {
  maximumFractionDigits: 2,
});
const formatResultPointsCell = value => parseResultPoints(value) === 0 ? '' : formatResultPoints(value);

const emptyCircuitForm = {
  nombre: '',
  localidad: '',
  provincia: '',
  pais: 'ar',
  variante: '',
};

const emptyCategoryForm = {
  categoria: '',
};

const championshipPlatforms = [
  'rFactor',
  'Automobilista',
  'ACTC 2Pez',
  'Simulador V3',
  'Assetto Corsa',
];
const championshipYears = Array.from(
  { length: new Date().getFullYear() - 2018 + 1 },
  (_, index) => new Date().getFullYear() - index,
);
const adminPageSize = 25;
const replaySessionOptions = ['Entrenamiento', 'Clasificación Sprint', 'Sprint', 'Clasificación Final', 'Final'];

const emptyChampionshipForm = {
  idcategoria: '',
  temporada: '',
  anio: new Date().getFullYear(),
  plataforma: '',
  puerto: '',
  n_server: '',
  servidor: '',
};
const createEmptyPrize = position => ({ posicion: String(position || ''), efectivo: false, inscripcion: false, trofeo: false });

const getNextChampionshipSeason = (championships, categoryId) => {
  if (!categoryId) return '';
  const highestSeason = championships.reduce((highest, championship) => {
    if (String(championship.idcategoria) !== String(categoryId)) return highest;
    const season = Number.parseInt(championship.temporada, 10);
    return Number.isFinite(season) ? Math.max(highest, season) : highest;
  }, 0);
  return String(highestSeason + 1);
};

const emptyCarForm = {
  idcategoria: '',
  marca: '',
  modelo: '',
};

const emptyCarBrandForm = { marca: '' };
const defaultRegistrationPlans = [
  { id: 'extra', titulo: 'Extra sin diseño', descripcion: 'Participás con un auto genérico completamente gris, sin diseño personalizado.', precio_adicional: '0', tipo: 'sin_numero', habilitado: true, autos_habilitados: [] },
  { id: 'personalizado', titulo: 'Personalizado', descripcion: 'Vos mismo diseñás y presentás el diseño de tu auto.', precio_adicional: '0', tipo: 'con_numero', habilitado: true, autos_habilitados: [] },
  { id: 'diseno_liga', titulo: 'Diseño de la liga', descripcion: 'Nuestro diseñador te asesora y diseña el auto a tu gusto, con tus colores, publicidades y detalles.', precio_adicional: '0', tipo: 'con_numero', habilitado: true, autos_habilitados: [] },
  { id: 'diseno_oficial', titulo: 'Diseño oficial', descripcion: 'Elegís un diseño oficial de la categoría utilizado en la realidad.', precio_adicional: '0', tipo: 'pintura_oficial', habilitado: false, autos_habilitados: [] },
];
const legacyRegistrationPlanDescriptions = new Set([
  'Participás sin pintura personalizada y sin elegir número.',
  'Presentás tu propio diseño y elegís el número del auto.',
  'Nuestro diseñador te asesora y prepara el diseño del auto.',
  'El diseñador de la liga te asesora y prepara el auto.',
  'Competís con uno de los diseños oficiales disponibles.',
]);
const cloneRegistrationPlans = plans => plans.map(plan => ({ ...plan, autos_habilitados: [...(plan.autos_habilitados || [])] }));
const planAliases = {
  extra: ['extra', 'extra-sin-diseno'],
  personalizado: ['personalizado', 'diseno-propio'],
  diseno_liga: ['diseno_liga', 'diseno-liga', 'personalizado_liga'],
  diseno_oficial: ['diseno_oficial', 'pintura_oficial'],
};
const normalizeRegistrationPlanId = value => {
  const normalized = String(value || '').trim().toLocaleLowerCase('es-AR');
  return Object.entries(planAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] || '';
};
const getRegistrationPlanId = registration => (
  registration?.es_diseno_oficial || registration?.idauto_oficial
    ? 'diseno_oficial'
    : normalizeRegistrationPlanId(
      registration?.plan_id || registration?.tipo_inscripcion || registration?.modalidad_diseno,
    ) || (Number(registration?.numero) === 0 ? 'extra' : 'personalizado')
);
const normalizeAdminRegistrationPlans = plans => defaultRegistrationPlans.map(defaultPlan => {
  const existing = (plans || []).find(plan => planAliases[defaultPlan.id].includes(plan.id));
  return {
    ...defaultPlan,
    ...(existing || {}),
    id: defaultPlan.id,
    tipo: defaultPlan.tipo,
    descripcion: !existing?.descripcion || legacyRegistrationPlanDescriptions.has(existing.descripcion)
      ? defaultPlan.descripcion
      : existing.descripcion,
    habilitado: existing ? existing.habilitado !== false : defaultPlan.habilitado,
    precio_adicional: String(existing?.precio_adicional ?? defaultPlan.precio_adicional),
    autos_habilitados: existing?.autos_habilitados || [],
  };
});
const emptyOfficialCarForm = { id: '', idmarca: '', idauto: '', numero: '', descripcion: '', foto: null };

const emptyRegistrationConfig = {
  fecha_apertura: '',
  fecha_cierre: '',
  precio: '0',
  precio_diseno: '0',
  precio_pintura_oficial: '0',
  setup_detalle: '',
  limite_inscriptos: '30',
  limite_por_modelo: '10',
  preinscriptos: '0',
  autos_habilitados: [],
  planes: cloneRegistrationPlans(defaultRegistrationPlans),
  permite_personalizado: true,
  permite_diseno_liga: true,
  permite_pintura_oficial: false,
  permite_extra: true,
};

const emptyEventForm = {
  idcampeonato: '',
  fecha: '',
  ronda: '',
  idcircuito: '',
  especial: false,
  especialidad: '',
  coronacion: false,
  transmision: '',
};

const emptyEventBatch = {
  idcampeonato: '',
  cantidad: '1',
  primeraFecha: '',
  hora: '21',
  minuto: '00',
};

const emptyDriverForm = {
  nombre: '',
  localidad: '',
  provincia: '',
  telefono: '',
  nacionalidad: 'ar',
  steam: '',
  ig: '',
};

const eventMinuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

const getEventDatePart = value => value?.slice(0, 10) || '';
const getEventHourPart = value => value?.slice(11, 13) || '21';
const getEventMinutePart = value => value?.slice(14, 16) || '00';
const buildEventDateTime = (date, hour, minute) => (date ? `${date}T${hour}:${minute}` : '');

const addWeeksToDate = (dateValue, weeks) => {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + (weeks * 7));

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const capitalizeInputValue = value =>
  String(value || '')
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const normalizeCircuitForm = form => ({
  nombre: capitalizeValue(form.nombre),
  localidad: capitalizeValue(form.localidad),
  provincia: capitalizeValue(form.provincia),
  pais: normalizeCountryCode(form.pais),
  variante: String(form.variante || '').trim().toLocaleLowerCase('es-AR'),
});

const defaultCropSettings = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

const loadImage = file =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo procesar la imagen.'));
    };
    image.src = url;
  });

const createSquarePngFile = async (file, settings, filename) => {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const size = 1024;
  const context = canvas.getContext('2d');
  const zoom = Number(settings.zoom || 1);
  const offsetX = Number(settings.offsetX || 0);
  const offsetY = Number(settings.offsetY || 0);
  const baseScale = Math.min(size / image.width, size / image.height) * zoom;

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  context.translate(
    size / 2 + (size * offsetX) / 100,
    size / 2 + (size * offsetY) / 100,
  );
  context.scale(baseScale, baseScale);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar el PNG recortado.');

  return new File([blob], filename, { type: 'image/png' });
};

function SquareCropEditor({ file, settings, onChange, label }) {
  const previewUrl = useMemo(() => {
    if (!file) return '';

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) return undefined;

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!file || !previewUrl) return null;

  const updateSetting = (name, value) => {
    onChange(current => ({ ...current, [name]: value }));
  };

  return (
    <div className="mt-4 rounded-lg border border-racing-border bg-racing-card p-4">
      <div className="relative mx-auto mb-4 aspect-square max-w-72 overflow-hidden rounded-lg border border-dashed border-racing-border bg-transparent">
        <img
          src={previewUrl}
          alt={label}
          className="absolute h-full w-full object-contain"
          style={{
            left: `calc(50% + ${settings.offsetX || 0}%)`,
            top: `calc(50% + ${settings.offsetY || 0}%)`,
            transform: `translate(-50%, -50%) scale(${settings.zoom})`,
            transformOrigin: 'center',
          }}
        />
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-500">Zoom</span>
          <input
            type="range"
            min="0.2"
            max="4"
            step="0.05"
            value={settings.zoom}
            onChange={event => updateSetting('zoom', Number(event.target.value))}
            className="mt-2 w-full accent-racing-red"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-500">Mover horizontalmente</span>
          <input
            type="range"
            min="-75"
            max="75"
            step="1"
            value={settings.offsetX || 0}
            onChange={event => updateSetting('offsetX', Number(event.target.value))}
            className="mt-2 w-full accent-racing-red"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-500">Mover verticalmente</span>
          <input
            type="range"
            min="-75"
            max="75"
            step="1"
            value={settings.offsetY || 0}
            onChange={event => updateSetting('offsetY', Number(event.target.value))}
            className="mt-2 w-full accent-racing-red"
          />
        </label>

        <button type="button" className="btn-secondary w-full justify-center px-3 py-2 text-xs" onClick={() => onChange(defaultCropSettings)}>
          Restablecer posición
        </button>
      </div>
    </div>
  );
}

function AdminPagination({ page, pageCount, total, onPageChange }) {
  if (!total) return null;
  const first = (page - 1) * adminPageSize + 1;
  const last = Math.min(page * adminPageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-racing-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-400">Mostrando {first}-{last} de {total}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-30" aria-label="Página anterior">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <span className="min-w-24 text-center font-racing text-sm font-bold text-white">Página {page} de {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-30" aria-label="Página siguiente">
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ClearFiltersButton({ active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
      aria-label="Limpiar filtros"
      title="Limpiar filtros"
    >
      <XMarkIcon className="h-4 w-4" />
    </button>
  );
}

function ResultSpreadsheetCell({
  value,
  type,
  disabled,
  label,
  rowIndex,
  columnIndex,
  selected,
  error,
  onCommit,
  onSelect,
  onExtendSelection,
  onPaste,
  onClearSelection,
}) {
  const cellRef = useRef(null);
  const displayValue = String(value ?? '');

  useEffect(() => {
    if (cellRef.current && document.activeElement !== cellRef.current) {
      cellRef.current.textContent = displayValue;
    }
  }, [displayValue]);

  const commitValue = () => {
    if (!cellRef.current || disabled) return;
    let nextValue = cellRef.current.textContent?.trim() || '';
    if (type === 'position') nextValue = nextValue.toLocaleUpperCase('es-AR');
    cellRef.current.textContent = nextValue;
    if (nextValue !== displayValue) {
      const accepted = onCommit(nextValue);
      if (accepted === false) cellRef.current.textContent = displayValue;
      else if (typeof accepted === 'string') cellRef.current.textContent = accepted;
    }
  };

  return (
    <div
      ref={cellRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={label}
      onMouseDown={event => onSelect(rowIndex, columnIndex, event.shiftKey)}
      onMouseEnter={event => {
        if (event.buttons === 1) onExtendSelection(rowIndex, columnIndex);
      }}
      onPaste={event => {
        event.preventDefault();
        onPaste(rowIndex, columnIndex, event.clipboardData.getData('text/plain'));
        event.currentTarget.blur();
      }}
      onBlur={commitValue}
      onKeyDown={event => {
        if (event.key === 'Delete') {
          event.preventDefault();
          onClearSelection();
          event.currentTarget.blur();
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.textContent = displayValue;
          event.currentTarget.blur();
        }
      }}
      title={error || undefined}
      className={`flex h-10 min-w-full items-center px-2 text-sm outline-none focus:ring-1 focus:ring-inset focus:ring-racing-red ${type === 'pilot' ? 'justify-start font-semibold' : 'justify-center font-racing'} ${error ? 'bg-red-500/25 ring-2 ring-inset ring-red-500' : selected ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400' : 'focus:bg-racing-dark'} ${disabled ? 'cursor-cell text-transparent' : 'cursor-cell text-white'}`}
    />
  );
}

export default function Admin() {
  const imageInputRef = useRef(null);
  const layoutInputRef = useRef(null);
  const categoryLogoInputRef = useRef(null);
  const categoryGalleryInputRef = useRef(null);
  const carBrandLogoInputRef = useRef(null);
  const championshipRulesInputRef = useRef(null);
  const carImageInputRef = useRef(null);
  const registrationImagesInputRef = useRef(null);
  const officialCarPhotoInputRef = useRef(null);
  const registrationSectionAutoSelectRef = useRef(false);
  const replayInputRef = useRef(null);
  const templateInputRef = useRef(null);
  const [authorized, setAuthorized] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [monitorMessage, setMonitorMessage] = useState('');
  const [savingMonitor, setSavingMonitor] = useState(false);
  const [registrationConfigs, setRegistrationConfigs] = useState([]);
  const [registrationConfigChampionshipId, setRegistrationConfigChampionshipId] = useState('');
  const [registrationConfig, setRegistrationConfig] = useState(emptyRegistrationConfig);
  const [registrationConfigMessage, setRegistrationConfigMessage] = useState('');
  const [savingRegistrationConfig, setSavingRegistrationConfig] = useState(false);
  const [registrationGallery, setRegistrationGallery] = useState([]);
  const [registrationGalleryPath, setRegistrationGalleryPath] = useState('');
  const [registrationImageFiles, setRegistrationImageFiles] = useState([]);
  const [registrationGalleryMessage, setRegistrationGalleryMessage] = useState('');
  const [savingRegistrationImages, setSavingRegistrationImages] = useState(false);
  const [officialCars, setOfficialCars] = useState([]);
  const [officialCarForm, setOfficialCarForm] = useState(emptyOfficialCarForm);
  const [officialCarCollapsedBrands, setOfficialCarCollapsedBrands] = useState({});
  const [registrationFormCollapsed, setRegistrationFormCollapsed] = useState({ backgrounds: true, enabledCars: true });
  const [officialCarsMessage, setOfficialCarsMessage] = useState('');
  const [savingOfficialCar, setSavingOfficialCar] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    const savedSection = window.localStorage.getItem(adminSectionStorageKey);
    return adminSections.some(section => section.id === savedSection)
      ? savedSection
      : adminSections[0].id;
  });
  const [events, setEvents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [circuits, setCircuits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [championships, setChampionships] = useState([]);
  const [carBrands, setCarBrands] = useState([]);
  const [cars, setCars] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [results, setResults] = useState([]);
  const [savedResults, setSavedResults] = useState([]);
  const [replays, setReplays] = useState([]);
  const [replayForm, setReplayForm] = useState({ idcampeonato: '', ronda: '', tanda: '' });
  const [replayFile, setReplayFile] = useState(null);
  const [replayMessage, setReplayMessage] = useState('');
  const [savingReplay, setSavingReplay] = useState(false);
  const [replayUploadProgress, setReplayUploadProgress] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [templateChampionshipId, setTemplateChampionshipId] = useState('');
  const [templateFile, setTemplateFile] = useState(null);
  const [templateMessage, setTemplateMessage] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateUploadProgress, setTemplateUploadProgress] = useState(0);
  const [resultChampionshipId, setResultChampionshipId] = useState('');
  const [resultRoundId, setResultRoundId] = useState('');
  const [resultSheetSize, setResultSheetSize] = useState(35);
  const [resultGridSelection, setResultGridSelection] = useState(null);
  const [resultCellErrors, setResultCellErrors] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [dirtyResults, setDirtyResults] = useState({});
  const [savingResults, setSavingResults] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [circuitMessage, setCircuitMessage] = useState('');
  const [categoryMessage, setCategoryMessage] = useState('');
  const [championshipMessage, setChampionshipMessage] = useState('');
  const [carBrandMessage, setCarBrandMessage] = useState('');
  const [carMessage, setCarMessage] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCircuit, setSavingCircuit] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingChampionship, setSavingChampionship] = useState(false);
  const [savingCarBrand, setSavingCarBrand] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [circuitForm, setCircuitForm] = useState(emptyCircuitForm);
  const [circuitImageFile, setCircuitImageFile] = useState(null);
  const [circuitLayoutFile, setCircuitLayoutFile] = useState(null);
  const [circuitLayoutCrop, setCircuitLayoutCrop] = useState(defaultCropSettings);
  const [editingCircuitId, setEditingCircuitId] = useState(null);
  const [circuitSearch, setCircuitSearch] = useState('');
  const [circuitCountryFilter, setCircuitCountryFilter] = useState('');
  const [circuitPage, setCircuitPage] = useState(1);
  const [circuitSort, setCircuitSort] = useState('nombre');
  const [circuitSortDirection, setCircuitSortDirection] = useState('asc');
  const [showCircuitNameSuggestions, setShowCircuitNameSuggestions] = useState(false);
  const [lockedCircuitName, setLockedCircuitName] = useState(false);
  const [baseCircuitImagePath, setBaseCircuitImagePath] = useState('');
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categoryLogoFile, setCategoryLogoFile] = useState(null);
  const [categoryLogoCrop, setCategoryLogoCrop] = useState(defaultCropSettings);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categorySortDirection, setCategorySortDirection] = useState('asc');
  const [categoryGalleryCategoryId, setCategoryGalleryCategoryId] = useState('');
  const [categoryGalleryChampionshipId, setCategoryGalleryChampionshipId] = useState('');
  const [categoryGallerySeasons, setCategoryGallerySeasons] = useState([]);
  const [categoryGalleryFiles, setCategoryGalleryFiles] = useState([]);
  const [categoryGalleryMessage, setCategoryGalleryMessage] = useState('');
  const [savingCategoryGallery, setSavingCategoryGallery] = useState(false);
  const [championshipForm, setChampionshipForm] = useState(emptyChampionshipForm);
  const [championshipPrizes, setChampionshipPrizes] = useState([]);
  const [championshipPrizesId, setChampionshipPrizesId] = useState('');
  const [loadingChampionshipPrizes, setLoadingChampionshipPrizes] = useState(false);
  const [savingChampionshipPrizes, setSavingChampionshipPrizes] = useState(false);
  const [championshipPrizesMessage, setChampionshipPrizesMessage] = useState('');
  const [championshipRulesFile, setChampionshipRulesFile] = useState(null);
  const [editingChampionshipId, setEditingChampionshipId] = useState(null);
  const [championshipSearch, setChampionshipSearch] = useState('');
  const [championshipCategoryFilter, setChampionshipCategoryFilter] = useState('');
  const [championshipYearFilter, setChampionshipYearFilter] = useState('');
  const [championshipPage, setChampionshipPage] = useState(1);
  const [carBrandForm, setCarBrandForm] = useState(emptyCarBrandForm);
  const [carBrandLogoFile, setCarBrandLogoFile] = useState(null);
  const [carBrandLogoCrop, setCarBrandLogoCrop] = useState(defaultCropSettings);
  const [editingCarBrandId, setEditingCarBrandId] = useState(null);
  const [carBrandSearch, setCarBrandSearch] = useState('');
  const [carForm, setCarForm] = useState(emptyCarForm);
  const [carImageFile, setCarImageFile] = useState(null);
  const [editingCarId, setEditingCarId] = useState(null);
  const [carSearch, setCarSearch] = useState('');
  const [carCategoryFilter, setCarCategoryFilter] = useState('');
  const [carBrandFilter, setCarBrandFilter] = useState('');
  const [carPage, setCarPage] = useState(1);
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationChampionshipFilter, setRegistrationChampionshipFilter] = useState('');
  const [registrationPlanFilter, setRegistrationPlanFilter] = useState('');
  const [registrationReadyFilter, setRegistrationReadyFilter] = useState('');
  const [registrationEdits, setRegistrationEdits] = useState({});
  const [registrationNumberAvailability, setRegistrationNumberAvailability] = useState({});
  const [registrationOfficialCars, setRegistrationOfficialCars] = useState([]);
  const [savingRegistrationChanges, setSavingRegistrationChanges] = useState(false);
  const [editingRegistrationNumbers, setEditingRegistrationNumbers] = useState({});
  const [selectedRegistrationDriverId, setSelectedRegistrationDriverId] = useState(null);
  const [registrationDriverDetails, setRegistrationDriverDetails] = useState(emptyDriverForm);
  const [savingRegistrationDriver, setSavingRegistrationDriver] = useState(false);
  const [registrationDriverDetailsMessage, setRegistrationDriverDetailsMessage] = useState('');
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [eventBatch, setEventBatch] = useState(emptyEventBatch);
  const [eventBatchRows, setEventBatchRows] = useState([]);
  const [editingEventKey, setEditingEventKey] = useState(null);
  const [eventMessage, setEventMessage] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventChampionshipFilter, setEventChampionshipFilter] = useState('');
  const [eventCircuitFilter, setEventCircuitFilter] = useState('');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [eventSort, setEventSort] = useState('fecha');
  const [eventSortDirection, setEventSortDirection] = useState('desc');
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [driverMessage, setDriverMessage] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverPage, setDriverPage] = useState(1);
  const [showDriverLocalitySuggestions, setShowDriverLocalitySuggestions] = useState(false);
  const [lockedDriverLocality, setLockedDriverLocality] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(adminSectionStorageKey, activeSection);
  }, [activeSection]);

  const resultChampionship = useMemo(
    () => championships.find(item => String(item.id) === String(resultChampionshipId)),
    [championships, resultChampionshipId]
  );

  const resultRounds = useMemo(
    () => events
      .filter(event => String(event.idcampeonato) === String(resultChampionshipId))
      .sort((a, b) => Number(a.ronda) - Number(b.ronda)),
    [events, resultChampionshipId]
  );

  const resultRound = useMemo(
    () => resultRounds.find(round => String(round.id) === String(resultRoundId)) || null,
    [resultRoundId, resultRounds]
  );

  const resultRegisteredDrivers = useMemo(() => {
    const byDriver = new Map();
    registrations
      .filter(registration => String(registration.idcampeonato) === String(resultChampionshipId))
      .forEach(registration => {
        if (!registration.idpiloto) return;
        byDriver.set(String(registration.idpiloto), {
          id: registration.idpiloto,
          nombre: registration.nombre,
          marca: registration.marca,
          modelo: registration.modelo,
          autoLogo: registration.auto_logo,
        });
      });
    return [...byDriver.values()].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es-AR', { sensitivity: 'base' }));
  }, [registrations, resultChampionshipId]);

  const resultRoundResults = useMemo(
    () => results.filter(result => !result._delete && resultRound && Number(result.ronda) === Number(resultRound.ronda)),
    [resultRound, results]
  );

  const resultAchievementRows = useMemo(() => [...new Map(resultRoundResults
    .filter(result => result.idpiloto && result.piloto)
    .map(result => [String(result.idpiloto), result])).values()]
    .sort((a, b) => String(a.piloto).localeCompare(String(b.piloto), 'es-AR', { sensitivity: 'base' })), [resultRoundResults]);

  const savedResultRoundResults = useMemo(
    () => savedResults.filter(result => resultRound && Number(result.ronda) === Number(resultRound.ronda)),
    [resultRound, savedResults]
  );

  const resultSheetRows = useMemo(() => {
    if (!resultRound) return [];
    const positioned = new Map();
    const savedIds = new Set(savedResultRoundResults.map(result => String(result.id)));
    const currentById = new Map(resultRoundResults
      .filter(result => result.id)
      .map(result => [String(result.id), result]));

    [...savedResultRoundResults]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((savedResult, index) => {
      const currentResult = currentById.get(String(savedResult.id));
      if (!currentResult) return;
      positioned.set(index + 1, currentResult);
      });

    resultRoundResults
      .filter(result => !result.id || !savedIds.has(String(result.id)))
      .forEach(result => {
        const sheetPosition = parseNumericPosition(result._sheetPosition);
        let targetPosition = sheetPosition || 1;
        while (positioned.has(targetPosition)) targetPosition += 1;
        positioned.set(targetPosition, result);
      });

    const maxPosition = Math.max(0, ...positioned.keys());
    const size = Math.max(resultSheetSize, maxPosition);
    const rows = Array.from({ length: size }, (_, index) => ({
      position: index + 1,
      result: positioned.get(index + 1) || null,
      unpositioned: false,
    }));

    return rows;
  }, [resultRound, resultRoundResults, resultSheetSize, savedResultRoundResults]);

  const resultChampionshipStandings = useMemo(() => {
    const byDriver = new Map(resultRegisteredDrivers.map(driver => [String(driver.id), {
      idpiloto: driver.id,
      piloto: driver.nombre,
      marca: driver.marca,
      modelo: driver.modelo,
      autoLogo: driver.autoLogo,
      rounds: new Map(),
      total: 0,
      campeon: false,
    }]));

    savedResults.filter(result => !result._delete).forEach(result => {
      const driverKey = String(result.idpiloto);
      if (!byDriver.has(driverKey)) {
        byDriver.set(driverKey, {
          idpiloto: result.idpiloto,
          piloto: result.piloto,
          rounds: new Map(),
          total: 0,
          campeon: false,
        });
      }
      const standing = byDriver.get(driverKey);
      const roundKey = String(result.ronda);
      const points = getResultPoints(result);
      const roundDetail = standing.rounds.get(roundKey) || {
        presentismo: 0,
        qualy: 0,
        sprint: 0,
        final: 0,
        points: 0,
        position: '',
      };
      roundDetail.presentismo += parseResultPoints(result.presentismo);
      roundDetail.qualy += parseResultPoints(result.pts_qualy_sprint) + parseResultPoints(result.pts_qualy_final);
      roundDetail.sprint += parseResultPoints(result.pts_sprint);
      roundDetail.final += parseResultPoints(result.pts_final);
      roundDetail.points += points;
      roundDetail.position = result.pos_final || roundDetail.position;
      standing.rounds.set(roundKey, roundDetail);
      standing.total += points;
      standing.campeon = standing.campeon || Boolean(Number(result.campeon));
    });

    return [...byDriver.values()]
      .sort((a, b) => b.total - a.total || String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es-AR', { sensitivity: 'base' }))
      .map((standing, index) => ({ ...standing, position: index + 1 }));
  }, [resultRegisteredDrivers, savedResults]);

  const resultTotalColumnWidth = useMemo(() => {
    const characters = Math.max('TOTAL'.length, ...resultChampionshipStandings.map(standing => formatResultPoints(standing.total).length));
    return Math.max(7, characters + 2);
  }, [resultChampionshipStandings]);

  useEffect(() => {
    if (!resultRounds.length) {
      setResultRoundId('');
      return;
    }
    if (!resultRounds.some(round => String(round.id) === String(resultRoundId))) {
      setResultRoundId(String(resultRounds[0].id));
    }
  }, [resultRoundId, resultRounds]);

  useEffect(() => {
    setResultSheetSize(current => Math.max(current, savedResultRoundResults.length, 35));
  }, [savedResultRoundResults]);

  const displayedCircuits = useMemo(() => {
    const search = circuitSearch.trim().toLocaleLowerCase('es-AR');

    return [...circuits]
      .filter(circuit => {
        if (circuitCountryFilter && normalizeCountryCode(circuit.pais) !== circuitCountryFilter) return false;
        if (!search) return true;

        return [circuit.nombre, circuit.variante, circuit.localidad, circuit.provincia, circuit.pais, circuit.imagen, circuit.trazado]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => {
        const primary = String(a[circuitSort] || '').localeCompare(String(b[circuitSort] || ''), 'es-AR', { sensitivity: 'base' });
        const direction = circuitSortDirection === 'asc' ? 1 : -1;
        if (primary !== 0) return primary * direction;

        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es-AR', { sensitivity: 'base' }) * direction;
      });
  }, [circuitCountryFilter, circuitSearch, circuitSort, circuitSortDirection, circuits]);

  const availableCircuitCountries = useMemo(() => {
    const countryCodes = new Set(circuits.map(circuit => normalizeCountryCode(circuit.pais)).filter(Boolean));
    return [...countryCodes]
      .map(code => ({
        code,
        name: circuitCountries.find(country => country.code === code)?.name || getCountryName(code) || code.toUpperCase(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es-AR', { sensitivity: 'base' }));
  }, [circuits]);

  const circuitPageCount = Math.max(1, Math.ceil(displayedCircuits.length / adminPageSize));
  const paginatedCircuits = useMemo(
    () => displayedCircuits.slice((circuitPage - 1) * adminPageSize, circuitPage * adminPageSize),
    [circuitPage, displayedCircuits],
  );

  useEffect(() => setCircuitPage(1), [circuitCountryFilter, circuitSearch]);
  useEffect(() => setCircuitPage(current => Math.min(current, circuitPageCount)), [circuitPageCount]);

  const circuitNameSuggestions = useMemo(() => {
    const search = circuitForm.nombre.trim().toLocaleLowerCase('es-AR');
    if (!search || editingCircuitId) return [];

    return circuits
      .filter(circuit => String(circuit.nombre || '').toLocaleLowerCase('es-AR').includes(search))
      .slice(0, 6);
  }, [circuitForm.nombre, circuits, editingCircuitId]);

  const displayedCategories = useMemo(() => {
    const search = categorySearch.trim().toLocaleLowerCase('es-AR');
    const direction = categorySortDirection === 'asc' ? 1 : -1;

    return [...categories]
      .filter(category => {
        if (!search) return true;

        return [category.categoria, category.logo]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || ''), 'es-AR', { sensitivity: 'base' }) * direction);
  }, [categories, categorySearch, categorySortDirection]);

  const displayedChampionships = useMemo(() => {
    const search = championshipSearch.trim().toLocaleLowerCase('es-AR');

    return [...championships]
      .filter(championship => {
        if (championshipCategoryFilter && String(championship.idcategoria) !== String(championshipCategoryFilter)) return false;
        if (championshipYearFilter && String(championship.anio) !== String(championshipYearFilter)) return false;
        if (!search) return true;

        return [
          championship.categoria,
          championship.temporada,
          championship.anio,
          championship.reglamento,
          championship.plataforma,
          championship.puerto,
          championship.n_server,
          championship.servidor,
        ]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => {
        const yearOrder = Number(b.anio || 0) - Number(a.anio || 0);
        if (yearOrder !== 0) return yearOrder;

        return String(b.temporada || '').localeCompare(String(a.temporada || ''), 'es-AR', { sensitivity: 'base' });
      });
  }, [championshipCategoryFilter, championshipSearch, championshipYearFilter, championships]);

  const availableChampionshipYears = useMemo(
    () => [...new Set(championships.map(championship => Number(championship.anio)).filter(Boolean))].sort((a, b) => b - a),
    [championships],
  );

  const championshipPageCount = Math.max(1, Math.ceil(displayedChampionships.length / adminPageSize));
  const paginatedChampionships = useMemo(
    () => displayedChampionships.slice((championshipPage - 1) * adminPageSize, championshipPage * adminPageSize),
    [championshipPage, displayedChampionships],
  );

  useEffect(() => setChampionshipPage(1), [championshipCategoryFilter, championshipSearch, championshipYearFilter]);
  useEffect(() => setChampionshipPage(current => Math.min(current, championshipPageCount)), [championshipPageCount]);

  const championshipsWithoutEvents = useMemo(() => {
    const championshipsWithEvents = new Set(
      events.map(event => String(event.idcampeonato)),
    );
    return championships.filter(
      championship => !championshipsWithEvents.has(String(championship.id)),
    );
  }, [championships, events]);

  const displayedCars = useMemo(() => {
    const search = carSearch.trim().toLocaleLowerCase('es-AR');

    return [...cars]
      .filter(car => {
        if (carCategoryFilter && String(car.idcategoria) !== String(carCategoryFilter)) return false;
        if (carBrandFilter && String(car.idmarca) !== String(carBrandFilter)) return false;
        if (!search) return true;

        return [car.categoria, car.marca, car.modelo, car.logo, car.imagen]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => {
        const categoryOrder = String(a.categoria || '').localeCompare(String(b.categoria || ''), 'es-AR', { sensitivity: 'base' });
        if (categoryOrder !== 0) return categoryOrder;

        const brandOrder = String(a.marca || '').localeCompare(String(b.marca || ''), 'es-AR', { sensitivity: 'base' });
        if (brandOrder !== 0) return brandOrder;

        return String(a.modelo || '').localeCompare(String(b.modelo || ''), 'es-AR', { sensitivity: 'base' });
      });
  }, [carBrandFilter, carCategoryFilter, carSearch, cars]);

  const carPageCount = Math.max(1, Math.ceil(displayedCars.length / adminPageSize));
  const paginatedCars = useMemo(
    () => displayedCars.slice((carPage - 1) * adminPageSize, carPage * adminPageSize),
    [carPage, displayedCars],
  );

  useEffect(() => {
    setCarPage(1);
  }, [carBrandFilter, carCategoryFilter, carSearch]);

  useEffect(() => {
    setCarPage(current => Math.min(current, carPageCount));
  }, [carPageCount]);

  const displayedCarBrands = useMemo(() => {
    const search = carBrandSearch.trim().toLocaleLowerCase('es-AR');
    return [...carBrands]
      .filter(brand => !search || [brand.marca, brand.logo]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('es-AR').includes(search)))
      .sort((a, b) => String(a.marca || '').localeCompare(String(b.marca || ''), 'es-AR', { sensitivity: 'base' }));
  }, [carBrandSearch, carBrands]);

  const registrationChampionshipGroups = useMemo(() => championships
    .map(championship => ({
      ...championship,
      registrationsCount: registrations.filter(registration => String(registration.idcampeonato) === String(championship.id)).length,
    }))
    .sort((a, b) => Number(b.id) - Number(a.id)), [championships, registrations]);

  const selectedRegistrationChampionship = useMemo(
    () => registrationChampionshipGroups.find(championship => String(championship.id) === String(registrationChampionshipFilter)) || null,
    [registrationChampionshipFilter, registrationChampionshipGroups],
  );

  const displayedRegistrations = useMemo(() => {
    if (!registrationChampionshipFilter) return [];
    const search = registrationSearch.trim().toLocaleLowerCase('es-AR');
    return registrations.filter(registration => {
      if (String(registration.idcampeonato) !== String(registrationChampionshipFilter)) return false;

      const registrationKey = `${registration.idcampeonato}-${registration.idpiloto}`;
      const planId = registrationEdits[registrationKey]?.plan_id || getRegistrationPlanId(registration);
      if (registrationPlanFilter && planId !== registrationPlanFilter) return false;
      const ready = registrationEdits[registrationKey]?.listo ?? Boolean(registration.listo);
      if (registrationReadyFilter === 'ready' && !ready) return false;
      if (registrationReadyFilter === 'pending' && ready) return false;

      if (!search) return true;
      return [
        registration.nombre,
        registration.numero,
        registration.marca,
        registration.modelo,
        registration.plan_titulo,
        registration.auto_oficial_descripcion,
        registration.categoria,
        registration.temporada,
        registration.anio,
      ]
        .filter(value => value !== null && value !== undefined)
        .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
    });
  }, [registrationChampionshipFilter, registrationEdits, registrationPlanFilter, registrationReadyFilter, registrationSearch, registrations]);

  useEffect(() => {
    if (registrationChampionshipFilter && !selectedRegistrationChampionship) {
      setRegistrationChampionshipFilter('');
      setRegistrationSearch('');
      setRegistrationPlanFilter('');
      setRegistrationReadyFilter('');
    }
  }, [registrationChampionshipFilter, selectedRegistrationChampionship]);

  useEffect(() => {
    if (activeSection !== 'inscriptos') {
      registrationSectionAutoSelectRef.current = false;
      return;
    }
    if (registrationSectionAutoSelectRef.current || !registrationChampionshipGroups.length) return;

    registrationSectionAutoSelectRef.current = true;
    const latestChampionshipId = String(registrationChampionshipGroups[0].id);
    setRegistrationChampionshipFilter(latestChampionshipId);
    setRegistrationSearch('');
    setRegistrationPlanFilter('');
    setRegistrationReadyFilter('');
    setRegistrationMessage('');
    setRegistrationEdits({});
    setEditingRegistrationNumbers({});
    setRegistrationOfficialCars([]);
    setSelectedRegistrationDriverId(null);
    setRegistrationDriverDetails(emptyDriverForm);
    setRegistrationDriverDetailsMessage('');
    registrationFormsApi.getOfficialCars(latestChampionshipId)
      .then(response => setRegistrationOfficialCars(response.data.data || []))
      .catch(error => setRegistrationMessage(error.response?.data?.error || 'No se pudieron cargar las pinturas oficiales.'));
  }, [activeSection, registrationChampionshipGroups]);

  const displayedEvents = useMemo(() => {
    const search = eventSearch.trim().toLocaleLowerCase('es-AR');

    return [...events]
      .filter(event => {
        const eventDate = String(event.fecha || '').slice(0, 10);
        if (eventChampionshipFilter && String(event.idcampeonato) !== String(eventChampionshipFilter)) return false;
        if (eventCircuitFilter && String(event.idcircuito) !== String(eventCircuitFilter)) return false;
        if (eventDateFrom && eventDate < eventDateFrom) return false;
        if (eventDateTo && eventDate > eventDateTo) return false;
        if (!search) return true;

        return [
          event.categoria,
          event.temporada,
          event.anio,
          event.ronda,
          event.circuito,
          event.especialidad,
        ]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => {
        const direction = eventSortDirection === 'asc' ? 1 : -1;

        if (eventSort === 'circuito') {
          const circuitOrder = String(a.circuito || '').localeCompare(String(b.circuito || ''), 'es-AR', { sensitivity: 'base' });
          if (circuitOrder !== 0) return circuitOrder * direction;

          return (parseCalendarDate(b.fecha)?.getTime() || 0) - (parseCalendarDate(a.fecha)?.getTime() || 0);
        }

        return ((parseCalendarDate(a.fecha)?.getTime() || 0) - (parseCalendarDate(b.fecha)?.getTime() || 0)) * direction;
      });
  }, [eventChampionshipFilter, eventCircuitFilter, eventDateFrom, eventDateTo, eventSearch, eventSort, eventSortDirection, events]);

  const eventPageCount = Math.max(1, Math.ceil(displayedEvents.length / adminPageSize));
  const paginatedEvents = useMemo(
    () => displayedEvents.slice((eventPage - 1) * adminPageSize, eventPage * adminPageSize),
    [displayedEvents, eventPage],
  );

  useEffect(() => setEventPage(1), [eventChampionshipFilter, eventCircuitFilter, eventDateFrom, eventDateTo, eventSearch]);
  useEffect(() => setEventPage(current => Math.min(current, eventPageCount)), [eventPageCount]);

  const displayedDrivers = useMemo(() => {
    const search = driverSearch.trim().toLocaleLowerCase('es-AR');

    return [...drivers]
      .filter(driver => {
        if (!search) return true;

        return [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, driver.ig]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search));
      })
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es-AR', { sensitivity: 'base' }));
  }, [driverSearch, drivers]);

  const driverPageCount = Math.max(1, Math.ceil(displayedDrivers.length / adminPageSize));
  const paginatedDrivers = useMemo(
    () => displayedDrivers.slice((driverPage - 1) * adminPageSize, driverPage * adminPageSize),
    [displayedDrivers, driverPage],
  );

  useEffect(() => setDriverPage(1), [driverSearch]);
  useEffect(() => setDriverPage(current => Math.min(current, driverPageCount)), [driverPageCount]);

  const driverDuplicate = useMemo(() => {
    const normalizedName = capitalizeValue(driverForm.nombre).toLocaleLowerCase('es-AR');
    const normalizedPhone = String(driverForm.telefono || '').replace(/\D/g, '');

    for (const driver of drivers) {
      if (String(driver.id) === String(editingDriverId)) continue;

      const sameName = Boolean(normalizedName)
        && String(driver.nombre || '').trim().toLocaleLowerCase('es-AR') === normalizedName;
      const samePhone = Boolean(normalizedPhone)
        && String(driver.telefono || '').replace(/\D/g, '') === normalizedPhone;

      if (sameName || samePhone) {
        return {
          driver,
          fields: [sameName ? 'el nombre' : '', samePhone ? 'el teléfono' : ''].filter(Boolean),
        };
      }
    }

    return null;
  }, [driverForm.nombre, driverForm.telefono, drivers, editingDriverId]);

  const driverLocalitySuggestions = useMemo(() => {
    const search = driverForm.localidad.trim().toLocaleLowerCase('es-AR');
    if (!search || lockedDriverLocality) return [];

    const uniqueLocalities = new Map();
    drivers.forEach(driver => {
      if (!driver.localidad) return;

      const key = `${driver.localidad}|${driver.provincia || ''}`.toLocaleLowerCase('es-AR');
      if (!uniqueLocalities.has(key)) {
        uniqueLocalities.set(key, {
          localidad: driver.localidad,
          provincia: driver.provincia || '',
        });
      }
    });

    return [...uniqueLocalities.values()]
      .filter(item =>
        [item.localidad, item.provincia]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('es-AR').includes(search))
      )
      .slice(0, 6);
  }, [driverForm.localidad, drivers, lockedDriverLocality]);

  useEffect(() => {
    setAuthorized(
      localStorage.getItem('cadpo_admin_auth') === 'true'
      && Boolean(localStorage.getItem('cadpo_admin_token'))
    );
  }, []);

  useEffect(() => {
    if (!authorized) {
      setLoading(false);
      return;
    }

    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const [eventsRes, driversRes, circuitsRes, categoriesRes, championshipsRes, carBrandsRes, carsRes, registrationsRes, monitorRes, registrationConfigsRes, replaysRes, templatesRes] = await Promise.all([
          eventsApi.getAll(),
          driversApi.getAll(),
          circuitsApi.getAll(),
          categoriesApi.getAll(),
          championshipsApi.getAll(),
          carBrandsApi.getAll(),
          carsApi.getAll(),
          registrationsApi.getAll(),
          monitorApi.getStatus(),
          registrationFormsApi.getAdminAll(),
          replaysApi.getAll(),
          templatesApi.getAll(),
        ]);

        const eventRows = eventsRes.data.data ?? [];
        setEvents(eventRows);
        setDrivers(driversRes.data.data ?? []);
        setCircuits(circuitsRes.data.data ?? []);
        setCategories(categoriesRes.data.data ?? []);
        const championshipRows = championshipsRes.data.data ?? [];
        setChampionships(championshipRows);
        setCarBrands(carBrandsRes.data.data ?? []);
        setCars(carsRes.data.data ?? []);
        setRegistrations(registrationsRes.data.data ?? []);
        setMonitorStatus(monitorRes.data.data ?? null);
        setRegistrationConfigs(registrationConfigsRes.data.data ?? []);
        setReplays(replaysRes.data.data ?? []);
        setTemplates(templatesRes.data.data ?? []);
        setResultChampionshipId(current => current || String(championshipsRes.data.data?.[0]?.id ?? ''));
      } catch (err) {
        console.error('Error cargando administración:', err);
        setResultMessage('No se pudieron cargar los datos de administración.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [authorized]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!authorized || !resultChampionshipId) {
        setResults([]);
        setSavedResults([]);
        setResultCellErrors({});
        return;
      }

      setLoadingResults(true);
      setResultMessage('');
      setResults([]);
      setSavedResults([]);
      setDirtyResults({});
      setResultCellErrors({});
      try {
        const res = await resultsApi.getAll({
          idcampeonato: resultChampionshipId,
        });
        const loadedResults = res.data.data ?? [];
        setResults(buildEditableResultRows(loadedResults));
        setSavedResults(loadedResults);
        setDirtyResults({});
      } catch (err) {
        console.error('Error cargando resultados:', err);
        setResultMessage(err.response?.data?.error || 'No se pudieron cargar los resultados.');
      } finally {
        setLoadingResults(false);
      }
    };

    fetchResults();
  }, [authorized, resultChampionshipId]);

  const handleCircuitChange = event => {
    const { name, value } = event.target;
    setCircuitForm(current => ({ ...current, [name]: name === 'variante' ? value.toLocaleLowerCase('es-AR') : value }));
    if (name === 'nombre') {
      setLockedCircuitName(false);
      setBaseCircuitImagePath('');
    }
  };

  const handleMonitorToggle = async () => {
    if (!monitorStatus || savingMonitor) return;
    setSavingMonitor(true);
    setMonitorMessage('');
    try {
      const response = await monitorApi.update(!monitorStatus.enabled);
      setMonitorStatus(response.data.data);
      setMonitorMessage(response.data.message);
    } catch (error) {
      setMonitorMessage(error.response?.data?.error || 'No se pudo cambiar el estado del monitoreo.');
    } finally {
      setSavingMonitor(false);
    }
  };

  const loadRegistrationGallery = async id => {
    if (!id) { setRegistrationGallery([]); setRegistrationGalleryPath(''); return; }
    try {
      const response = await registrationFormsApi.getImages(id);
      setRegistrationGallery(response.data.data || []);
      setRegistrationGalleryPath(response.data.path || '');
    } catch (error) {
      setRegistrationGallery([]);
      setRegistrationGalleryMessage(error.response?.data?.error || 'No se pudieron cargar las fotos.');
    }
  };

  const loadOfficialCars = async id => {
    if (!id) { setOfficialCars([]); return; }
    try {
      const response = await registrationFormsApi.getOfficialCars(id);
      setOfficialCars(response.data.data || []);
    } catch (error) {
      setOfficialCars([]);
      setOfficialCarsMessage(error.response?.data?.error || 'No se pudieron cargar los autos oficiales.');
    }
  };

  const selectRegistrationConfigChampionship = id => {
    setRegistrationConfigChampionshipId(id);
    setRegistrationConfigMessage('');
    setRegistrationGalleryMessage('');
    setOfficialCarsMessage('');
    setOfficialCarForm(emptyOfficialCarForm);
    setOfficialCarCollapsedBrands({});
    setRegistrationFormCollapsed({ backgrounds: true, enabledCars: true });
    loadChampionshipPrizes(id);
    if (officialCarPhotoInputRef.current) officialCarPhotoInputRef.current.value = '';
    setRegistrationImageFiles([]);
    if (registrationImagesInputRef.current) registrationImagesInputRef.current.value = '';
    const existing = registrationConfigs.find(item => String(item.idcampeonato) === String(id));
    if (existing) {
      loadRegistrationGallery(id);
      loadOfficialCars(id);
    } else {
      setRegistrationGallery([]);
      setRegistrationGalleryPath('');
      setOfficialCars([]);
    }
    setRegistrationConfig(existing ? {
      fecha_apertura: toDateTimeInputValue(existing.fecha_apertura),
      fecha_cierre: toDateTimeInputValue(existing.fecha_cierre),
      precio: String(existing.precio ?? 0),
      precio_diseno: String(existing.precio_diseno ?? 0),
      precio_pintura_oficial: String(existing.precio_pintura_oficial ?? 0),
      setup_detalle: existing.setup_detalle || '',
      limite_inscriptos: String(existing.limite_inscriptos ?? 30),
      limite_por_modelo: String(existing.limite_por_modelo ?? 10),
      preinscriptos: String(existing.preinscriptos ?? 0),
      autos_habilitados: existing.autos_habilitados || [],
      planes: normalizeAdminRegistrationPlans(existing.planes),
      permite_personalizado: existing.permite_personalizado,
      permite_diseno_liga: existing.permite_diseno_liga,
      permite_pintura_oficial: existing.permite_pintura_oficial,
      permite_extra: existing.permite_extra,
    } : emptyRegistrationConfig);
  };

  const handleRegistrationConfigChange = event => {
    const { name, type, checked, value } = event.target;
    setRegistrationConfig(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleRegistrationCar = id => {
    setRegistrationConfig(current => {
      const numericId = Number(id);
      const removing = current.autos_habilitados.includes(numericId);
      return {
        ...current,
        autos_habilitados: removing
          ? current.autos_habilitados.filter(carId => carId !== numericId)
          : [...current.autos_habilitados, numericId],
        planes: removing
          ? current.planes.map(plan => ({ ...plan, autos_habilitados: plan.autos_habilitados.filter(carId => carId !== numericId) }))
          : current.planes,
      };
    });
  };

  const updateRegistrationPlan = (id, field, value) => {
    setRegistrationConfig(current => ({
      ...current,
      planes: current.planes.map(plan => plan.id === id ? { ...plan, [field]: value } : plan),
    }));
  };

  const saveRegistrationConfig = async event => {
    event.preventDefault();
    if (!registrationConfigChampionshipId) return;
    setSavingRegistrationConfig(true);
    setRegistrationConfigMessage('');
    try {
      const payload = {
        ...registrationConfig,
        fecha_apertura: toMySqlDateTime(registrationConfig.fecha_apertura),
        fecha_cierre: toMySqlDateTime(registrationConfig.fecha_cierre),
      };
      const response = await registrationFormsApi.saveConfig(registrationConfigChampionshipId, payload);
      const saved = response.data.data;
      setRegistrationConfigs(current => [saved, ...current.filter(item => String(item.idcampeonato) !== String(saved.idcampeonato))]);
      setRegistrationConfigMessage(response.data.message);
      await loadRegistrationGallery(registrationConfigChampionshipId);
      await loadOfficialCars(registrationConfigChampionshipId);
    } catch (error) {
      setRegistrationConfigMessage(error.response?.data?.error || 'No se pudo guardar el formulario.');
    } finally {
      setSavingRegistrationConfig(false);
    }
  };

  const uploadRegistrationGallery = async () => {
    if (!registrationImageFiles.length || !registrationConfigChampionshipId) return;
    setSavingRegistrationImages(true);
    setRegistrationGalleryMessage('');
    try {
      const data = new FormData();
      registrationImageFiles.forEach(file => data.append('images', file));
      const response = await registrationFormsApi.uploadImages(registrationConfigChampionshipId, data);
      setRegistrationGallery(response.data.data || []);
      setRegistrationGalleryPath(response.data.path || '');
      setRegistrationGalleryMessage(response.data.message);
      setRegistrationImageFiles([]);
      if (registrationImagesInputRef.current) registrationImagesInputRef.current.value = '';
    } catch (error) {
      setRegistrationGalleryMessage(error.response?.data?.error || 'No se pudieron subir las fotos.');
    } finally {
      setSavingRegistrationImages(false);
    }
  };

  const deleteRegistrationGalleryImage = async image => {
    if (!window.confirm('¿Eliminar esta foto del carrusel de inscripciones?')) return;
    setRegistrationGalleryMessage('');
    try {
      const response = await registrationFormsApi.removeImage(registrationConfigChampionshipId, image.filename);
      setRegistrationGallery(response.data.data || []);
      setRegistrationGalleryMessage(response.data.message);
    } catch (error) {
      setRegistrationGalleryMessage(error.response?.data?.error || 'No se pudo eliminar la foto.');
    }
  };

  const resetOfficialCarForm = () => {
    setOfficialCarForm(emptyOfficialCarForm);
    if (officialCarPhotoInputRef.current) officialCarPhotoInputRef.current.value = '';
  };

  const editOfficialCar = car => {
    setOfficialCarForm({
      id: car.id,
      idmarca: String(car.idmarca),
      idauto: String(car.idauto),
      numero: String(car.numero),
      descripcion: car.descripcion || '',
      foto: null,
    });
    setOfficialCarsMessage('');
    if (officialCarPhotoInputRef.current) officialCarPhotoInputRef.current.value = '';
  };

  const saveOfficialCar = async () => {
    if (!registrationConfigChampionshipId) return;
    setSavingOfficialCar(true);
    setOfficialCarsMessage('');
    try {
      const data = new FormData();
      data.append('idauto', officialCarForm.idauto);
      data.append('numero', officialCarForm.numero);
      data.append('descripcion', capitalizeValue(officialCarForm.descripcion));
      if (officialCarForm.foto) data.append('foto', officialCarForm.foto);
      const response = officialCarForm.id
        ? await registrationFormsApi.updateOfficialCar(registrationConfigChampionshipId, officialCarForm.id, data)
        : await registrationFormsApi.createOfficialCar(registrationConfigChampionshipId, data);
      setOfficialCars(response.data.data || []);
      setOfficialCarsMessage(response.data.message);
      if (officialCarForm.id) resetOfficialCarForm();
      else {
        const selectedBrand = officialCarForm.idmarca;
        setOfficialCarForm({ ...emptyOfficialCarForm, idmarca: selectedBrand });
        if (officialCarPhotoInputRef.current) officialCarPhotoInputRef.current.value = '';
      }
    } catch (error) {
      setOfficialCarsMessage(error.response?.data?.error || 'No se pudo guardar el auto oficial.');
    } finally {
      setSavingOfficialCar(false);
    }
  };

  const deleteOfficialCar = async car => {
    if (!window.confirm(`¿Eliminar el diseño oficial Nº ${car.numero}?`)) return;
    setSavingOfficialCar(true);
    setOfficialCarsMessage('');
    try {
      const response = await registrationFormsApi.removeOfficialCar(registrationConfigChampionshipId, car.id);
      setOfficialCars(response.data.data || []);
      setOfficialCarsMessage(response.data.message);
      if (String(officialCarForm.id) === String(car.id)) resetOfficialCarForm();
    } catch (error) {
      setOfficialCarsMessage(error.response?.data?.error || 'No se pudo eliminar el auto oficial.');
    } finally {
      setSavingOfficialCar(false);
    }
  };

  const deleteRegistrationConfig = async id => {
    const current = registrationConfigs.find(item => String(item.idcampeonato) === String(id));
    if (!window.confirm(`¿Eliminar el formulario de ${current?.categoria || 'este campeonato'}? Las inscripciones ya realizadas se conservarán.`)) return;
    setSavingRegistrationConfig(true);
    setRegistrationConfigMessage('');
    try {
      const response = await registrationFormsApi.removeConfig(id);
      setRegistrationConfigs(items => items.filter(item => String(item.idcampeonato) !== String(id)));
      if (String(registrationConfigChampionshipId) === String(id)) {
        setRegistrationConfigChampionshipId('');
        setRegistrationConfig(emptyRegistrationConfig);
        setRegistrationGallery([]);
        setRegistrationGalleryPath('');
        setRegistrationImageFiles([]);
        setOfficialCars([]);
        setChampionshipPrizes([]);
        setChampionshipPrizesId('');
        setChampionshipPrizesMessage('');
        resetOfficialCarForm();
      }
      setRegistrationConfigMessage(response.data.message);
    } catch (error) {
      setRegistrationConfigMessage(error.response?.data?.error || 'No se pudo eliminar el formulario.');
    } finally {
      setSavingRegistrationConfig(false);
    }
  };

  const handleMonitorTest = async () => {
    setSavingMonitor(true);
    setMonitorMessage('Enviando correo de prueba...');
    try {
      const response = await monitorApi.sendTestEmail();
      setMonitorMessage(response.data.message);
    } catch (error) {
      setMonitorMessage(error.response?.data?.error || 'No se pudo enviar el correo de prueba. Revisá la configuración SMTP.');
    } finally {
      setSavingMonitor(false);
    }
  };

  const handleSelectCircuitSuggestion = circuit => {
    setEditingCircuitId(null);
    setLockedCircuitName(true);
    setBaseCircuitImagePath(circuit.imagen || '');
    setCircuitForm({
      nombre: circuit.nombre || '',
      localidad: circuit.localidad || '',
      provincia: circuit.provincia || '',
      pais: normalizeCountryCode(circuit.pais) || 'ar',
      variante: '',
    });
    setCircuitImageFile(null);
    setCircuitLayoutFile(null);
    setCircuitLayoutCrop(defaultCropSettings);
    setShowCircuitNameSuggestions(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (layoutInputRef.current) layoutInputRef.current.value = '';
    setCircuitMessage(`Agregando una nueva variante de ${circuit.nombre}. Se conserva la imagen del autódromo, cargá el trazado de esta variante.`);
  };

  const handleCircuitNameKeyDown = event => {
    if (event.key !== 'Enter' || !circuitNameSuggestions.length) return;

    event.preventDefault();
    handleSelectCircuitSuggestion(circuitNameSuggestions[0]);
  };

  const handleCategoryChange = event => {
    const { name, value } = event.target;
    setCategoryForm(current => ({ ...current, [name]: value }));
  };

  const handleChampionshipChange = event => {
    const { name, value } = event.target;
    setChampionshipForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'idcategoria' && !editingChampionshipId
        ? { temporada: getNextChampionshipSeason(championships, value) }
        : {}),
    }));
  };

  const handleCarChange = event => {
    const { name, value } = event.target;
    setCarForm(current => ({ ...current, [name]: value }));
  };

  const handleCarBrandFormChange = event => {
    setCarBrandForm({ marca: event.target.value });
  };

  const selectRegistrationChampionship = value => {
    const championshipId = String(value || '');
    setRegistrationChampionshipFilter(championshipId);
    setRegistrationSearch('');
    setRegistrationPlanFilter('');
    setRegistrationReadyFilter('');
    setRegistrationMessage('');
    setRegistrationEdits({});
    setEditingRegistrationNumbers({});
    setRegistrationOfficialCars([]);
    if (championshipId) {
      registrationFormsApi.getOfficialCars(championshipId)
        .then(response => setRegistrationOfficialCars(response.data.data || []))
        .catch(error => setRegistrationMessage(error.response?.data?.error || 'No se pudieron cargar las pinturas oficiales.'));
    }
    setSelectedRegistrationDriverId(null);
    setRegistrationDriverDetails(emptyDriverForm);
    setRegistrationDriverDetailsMessage('');
  };

  const handleEventChange = event => {
    const { name, type, checked, value } = event.target;
    setEventForm(current => {
      const nextValue = type === 'checkbox' ? checked : value;
      const next = { ...current, [name]: nextValue };

      if (name === 'especial' && !checked) next.especialidad = '';
      if (name === 'especialidad') next.especialidad = value.toLocaleUpperCase('es-AR');

      return next;
    });
  };

  const handleEventDatePartChange = event => {
    const date = event.target.value;
    setEventForm(current => ({
      ...current,
      fecha: buildEventDateTime(date, getEventHourPart(current.fecha), getEventMinutePart(current.fecha)),
    }));
  };

  const handleEventHourChange = event => {
    const hour = event.target.value;
    setEventForm(current => ({
      ...current,
      fecha: buildEventDateTime(getEventDatePart(current.fecha), hour, getEventMinutePart(current.fecha)),
    }));
  };

  const handleEventMinuteChange = event => {
    const minute = event.target.value;
    setEventForm(current => ({
      ...current,
      fecha: buildEventDateTime(getEventDatePart(current.fecha), getEventHourPart(current.fecha), minute),
    }));
  };

  const handleGenerateEventBatch = () => {
    const cantidad = Math.min(30, Math.max(1, Number(eventBatch.cantidad) || 1));
    if (!eventBatch.idcampeonato || !eventBatch.primeraFecha) {
      setEventMessage('Seleccioná el campeonato y la fecha de la primera ronda.');
      return;
    }

    setEventBatchRows(Array.from({ length: cantidad }, (_, index) => ({
      ronda: index + 1,
      fecha: buildEventDateTime(
        addWeeksToDate(eventBatch.primeraFecha, index),
        eventBatch.hora,
        eventBatch.minuto,
      ),
      idcircuito: '',
      especial: false,
      especialidad: '',
      coronacion: index === cantidad - 1,
      transmision: '',
    })));
    setEventMessage('');
  };

  const handleEventBatchRowChange = (index, field, value) => {
    setEventBatchRows(current => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;

      const next = { ...row, [field]: value };
      if (field === 'especial' && !value) next.especialidad = '';
      if (field === 'especialidad') next.especialidad = value.toLocaleUpperCase('es-AR');
      return next;
    }));
  };

  const handleDriverChange = event => {
    const { name, value } = event.target;
    if (name === 'localidad') setLockedDriverLocality(false);
    const nextValue = name === 'telefono'
      ? value.replace(/\D/g, '')
      : name === 'ig'
        ? formatInstagramHandle(value)
      : ['nombre', 'localidad', 'provincia'].includes(name)
        ? capitalizeInputValue(value)
        : value;

    setDriverForm(current => ({
      ...current,
      [name]: nextValue,
    }));
  };

  const alertDriverDuplicate = () => {
    if (!driverDuplicate) return;

    const message = `Ya existe el piloto ${driverDuplicate.driver.nombre} con ${driverDuplicate.fields.join(' y ')} ingresado.`;
    window.alert(message);
    setDriverMessage(message);
  };

  const handleSelectDriverLocality = locality => {
    setDriverForm(current => ({
      ...current,
      localidad: locality.localidad,
      provincia: locality.provincia,
    }));
    setLockedDriverLocality(true);
    setShowDriverLocalitySuggestions(false);
  };

  const handleCircuitSort = field => {
    if (circuitSort === field) {
      setCircuitSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setCircuitSort(field);
    setCircuitSortDirection('asc');
  };

  const handleEventSort = field => {
    if (eventSort === field) {
      setEventSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setEventSort(field);
    setEventSortDirection(field === 'fecha' ? 'desc' : 'asc');
  };

  const resetCircuitForm = () => {
    setCircuitForm(emptyCircuitForm);
    setCircuitImageFile(null);
    setCircuitLayoutFile(null);
    setCircuitLayoutCrop(defaultCropSettings);
    setEditingCircuitId(null);
    setLockedCircuitName(false);
    setBaseCircuitImagePath('');
    setShowCircuitNameSuggestions(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (layoutInputRef.current) layoutInputRef.current.value = '';
  };

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setCategoryLogoFile(null);
    setCategoryLogoCrop(defaultCropSettings);
    setEditingCategoryId(null);
    if (categoryLogoInputRef.current) categoryLogoInputRef.current.value = '';
  };

  const resetChampionshipForm = () => {
    setChampionshipForm(emptyChampionshipForm);
    setChampionshipRulesFile(null);
    setEditingChampionshipId(null);
    if (championshipRulesInputRef.current) championshipRulesInputRef.current.value = '';
  };

  const resetCarBrandForm = () => {
    setCarBrandForm(emptyCarBrandForm);
    setCarBrandLogoFile(null);
    setCarBrandLogoCrop(defaultCropSettings);
    setEditingCarBrandId(null);
    if (carBrandLogoInputRef.current) carBrandLogoInputRef.current.value = '';
  };

  const resetCarForm = () => {
    setCarForm(emptyCarForm);
    setCarImageFile(null);
    setEditingCarId(null);
    if (carImageInputRef.current) carImageInputRef.current.value = '';
  };

  const resetEventForm = () => {
    setEventForm(emptyEventForm);
    setEditingEventKey(null);
  };

  const resetEventBatch = () => {
    setEventBatch(emptyEventBatch);
    setEventBatchRows([]);
  };

  const resetDriverForm = () => {
    setDriverForm(emptyDriverForm);
    setEditingDriverId(null);
    setLockedDriverLocality(false);
    setShowDriverLocalitySuggestions(false);
  };

  const handleResultFieldChange = (standing, round, currentResult, field, value) => {
    const resultKey = currentResult?._key
      || (currentResult?.id ? `id-${currentResult.id}` : `new-${standing.idpiloto}-${round.ronda}`);
    const normalizedValue = field.startsWith('pos_') ? value.toLocaleUpperCase('es-AR') : value;

    setResults(current => {
      const index = current.findIndex(result =>
        result._key === resultKey
        || (currentResult?.id && result.id === currentResult.id)
      );

      if (index >= 0) {
        return current.map((result, resultIndex) =>
          resultIndex === index
            ? { ...result, _key: resultKey, [field]: normalizedValue }
            : result
        );
      }

      return [
        ...current,
        {
          _key: resultKey,
          _isNew: true,
          idcampeonato: Number(resultChampionshipId),
          fecha: String(round.fecha || '').slice(0, 10),
          ronda: Number(round.ronda),
          idcircuito: Number(round.idcircuito),
          idpiloto: Number(standing.idpiloto),
          piloto: standing.piloto,
          circuito: round.circuito,
          _sheetPosition: null,
          [field]: normalizedValue,
        },
      ];
    });
    setDirtyResults(current => ({ ...current, [resultKey]: true }));
    setResultMessage('');
  };

  const handleResultAchievementChange = (result, field) => {
    if (!result) return;
    const resultKey = result._key || `id-${result.id}`;
    const nextValue = Number(result[field]) === 0;
    const dirty = { [resultKey]: true };
    setResults(current => current.map(item => {
      const itemKey = item._key || `id-${item.id}`;
      const isTarget = itemKey === resultKey;
      const sameScope = field === 'campeon'
        ? String(item.idcampeonato) === String(result.idcampeonato)
        : String(item.ronda) === String(result.ronda);
      if (nextValue && sameScope && Number(item[field]) !== 0) {
        dirty[itemKey] = true;
        return { ...item, [field]: 0 };
      }
      return isTarget ? { ...item, [field]: nextValue ? 1 : 0 } : item;
    }));
    setDirtyResults(current => ({ ...current, ...dirty }));
    setResultMessage('');
  };

  const handleResultPilotChange = (row, currentResult, value, pilotField = 'piloto') => {
    const requestedName = String(value || '').trim();
    const matchedDriver = resultRegisteredDrivers.find(driver =>
      String(driver.nombre || '').localeCompare(requestedName, 'es-AR', { sensitivity: 'base' }) === 0
    );

    const resultKey = currentResult?._key
      || (currentResult?.id ? `id-${currentResult.id}` : `new-row-${resultRound.ronda}-${row.position || results.length + 1}`);

    setResults(current => {
      const index = current.findIndex(result =>
        result._key === resultKey
        || (currentResult?.id && result.id === currentResult.id)
      );
      const driverData = {
        _key: resultKey,
        ...(pilotField === 'piloto' ? { idpiloto: matchedDriver ? Number(matchedDriver.id) : null } : {}),
        [pilotField]: requestedName,
      };

      if (index >= 0) {
        return current.map((result, resultIndex) =>
          resultIndex === index ? { ...result, ...driverData } : result
        );
      }

      return [
        ...current,
        {
          ...driverData,
          _isNew: true,
          idcampeonato: Number(resultChampionshipId),
          fecha: String(resultRound.fecha || '').slice(0, 10),
          ronda: Number(resultRound.ronda),
          idcircuito: Number(resultRound.idcircuito),
          circuito: resultRound.circuito,
          _sheetPosition: row.position,
        },
      ];
    });
    setDirtyResults(current => ({ ...current, [resultKey]: true }));
    setResultMessage('');
    return requestedName;
  };

  const handleResultCellSelect = (rowIndex, columnIndex, extend = false) => {
    setResultGridSelection(current => {
      if (extend && current) {
        return { ...current, focusRow: rowIndex, focusColumn: columnIndex };
      }
      return {
        anchorRow: rowIndex,
        anchorColumn: columnIndex,
        focusRow: rowIndex,
        focusColumn: columnIndex,
      };
    });
  };

  const handleResultCellSelectionExtend = (rowIndex, columnIndex) => {
    setResultGridSelection(current => current
      ? { ...current, focusRow: rowIndex, focusColumn: columnIndex }
      : current);
  };

  const getResultSelectionBounds = () => {
    if (!resultGridSelection) return null;
    return {
      firstRow: Math.min(resultGridSelection.anchorRow, resultGridSelection.focusRow),
      lastRow: Math.max(resultGridSelection.anchorRow, resultGridSelection.focusRow),
      firstColumn: Math.min(resultGridSelection.anchorColumn, resultGridSelection.focusColumn),
      lastColumn: Math.max(resultGridSelection.anchorColumn, resultGridSelection.focusColumn),
    };
  };

  const isResultCellSelected = (rowIndex, columnIndex) => {
    const bounds = getResultSelectionBounds();
    return Boolean(bounds
      && rowIndex >= bounds.firstRow
      && rowIndex <= bounds.lastRow
      && columnIndex >= bounds.firstColumn
      && columnIndex <= bounds.lastColumn);
  };

  const getResultGridCellValue = (row, column) => {
    if (!row?.result) return '';
    if (column.type === 'pilot') return row.result[column.key] ?? row.result.piloto ?? '';
    const value = row.result[column.key] ?? '';
    return String(value);
  };

  const handleResultGridCopy = event => {
    const bounds = getResultSelectionBounds();
    if (!bounds) return;

    const copiedRows = [];
    for (let rowIndex = bounds.firstRow; rowIndex <= bounds.lastRow; rowIndex += 1) {
      const row = resultSheetRows[rowIndex];
      copiedRows.push(resultGridColumns
        .slice(bounds.firstColumn, bounds.lastColumn + 1)
        .map(column => getResultGridCellValue(row, column))
        .join('\t'));
    }

    event.preventDefault();
    event.clipboardData.setData('text/plain', copiedRows.join('\n'));
  };

  const handleResultGridPaste = (startRow, startColumn, clipboardText) => {
    if (!resultRound || !clipboardText) return;

    const selectionBounds = getResultSelectionBounds();
    if (selectionBounds) {
      startRow = selectionBounds.firstRow;
      startColumn = selectionBounds.firstColumn;
    }

    const matrix = clipboardText
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.split('\t'));
    if (matrix.length > 1 && matrix.at(-1).every(value => value === '')) matrix.pop();

    const maxRows = Math.min(matrix.length, 100 - startRow);
    const maxColumns = Math.min(
      Math.max(0, ...matrix.map(row => row.length)),
      resultGridColumns.length - startColumn
    );
    if (!maxRows || !maxColumns) return;

    const nextResults = [...results];
    const pastedDirtyResults = {};
    let changedRows = 0;

    for (let matrixRowIndex = 0; matrixRowIndex < maxRows; matrixRowIndex += 1) {
      const targetRowIndex = startRow + matrixRowIndex;
      const targetRow = resultSheetRows[targetRowIndex] || {
        position: targetRowIndex + 1,
        result: null,
        unpositioned: false,
      };
      const sourceCells = matrix[matrixRowIndex];
      const originalResult = targetRow.result;
      let nextResult = originalResult ? { ...originalResult } : null;
      let rowChanged = false;
      const pastedCells = sourceCells.slice(0, maxColumns);
      const hasData = pastedCells.some(value => String(value ?? '').trim() !== '');
      if (!nextResult && !hasData) continue;

      if (!nextResult) {
        const resultKey = `new-row-${resultRound.ronda}-${targetRowIndex + 1}`;
        nextResult = {
          _key: resultKey,
          _isNew: true,
          idcampeonato: Number(resultChampionshipId),
          fecha: String(resultRound.fecha || '').slice(0, 10),
          ronda: Number(resultRound.ronda),
          idcircuito: Number(resultRound.idcircuito),
          idpiloto: null,
          piloto: '',
          circuito: resultRound.circuito,
          _sheetPosition: targetRow.position,
        };
        rowChanged = true;
      }

      for (let sourceColumnIndex = 0; sourceColumnIndex < Math.min(sourceCells.length, maxColumns); sourceColumnIndex += 1) {
        const column = resultGridColumns[startColumn + sourceColumnIndex];
        const rawValue = String(sourceCells[sourceColumnIndex] ?? '').trim();
        if (column.type === 'pilot') {
          const currentValue = nextResult[column.key] ?? (column.key === 'piloto' ? '' : nextResult.piloto) ?? '';
          if (String(currentValue) !== rawValue) {
            nextResult[column.key] = rawValue;
            if (column.key === 'piloto') {
              const matchedDriver = resultRegisteredDrivers.find(item =>
                String(item.nombre || '').localeCompare(rawValue, 'es-AR', { sensitivity: 'base' }) === 0
              );
              nextResult.idpiloto = matchedDriver ? Number(matchedDriver.id) : null;
            }
            rowChanged = true;
          }
          continue;
        }

        const normalizedValue = column.type === 'position'
          ? rawValue.toLocaleUpperCase('es-AR')
          : rawValue;
        if (String(nextResult[column.key] ?? '') !== normalizedValue) {
          nextResult[column.key] = normalizedValue;
          rowChanged = true;
        }
      }

      if (!rowChanged) continue;
      const resultKey = nextResult._key || `id-${nextResult.id}`;
      nextResult._key = resultKey;
      pastedDirtyResults[resultKey] = true;
      changedRows += 1;

      if (originalResult) {
        const resultIndex = nextResults.findIndex(result => result === originalResult);
        if (resultIndex >= 0) nextResults[resultIndex] = nextResult;
      } else {
        nextResults.push(nextResult);
      }
    }

    if (!changedRows) {
      setResultMessage('Los datos pegados son iguales a los que ya estaban cargados.');
      return;
    }

    setResults(nextResults);
    setDirtyResults(current => ({ ...current, ...pastedDirtyResults }));
    setResultSheetSize(current => Math.max(current, Math.min(100, startRow + maxRows)));
    setResultGridSelection({
      anchorRow: startRow,
      anchorColumn: startColumn,
      focusRow: startRow + maxRows - 1,
      focusColumn: startColumn + maxColumns - 1,
    });
    setResultMessage(`${changedRows} fila${changedRows === 1 ? '' : 's'} pegada${changedRows === 1 ? '' : 's'}. Revisá los datos y presioná Guardar.`);
  };

  const handleResultGridClear = () => {
    const bounds = getResultSelectionBounds();
    if (!bounds) return;

    const nextResults = [...results];
    const clearedDirtyResults = {};
    let clearedCells = 0;

    for (let rowIndex = bounds.firstRow; rowIndex <= bounds.lastRow; rowIndex += 1) {
      const row = resultSheetRows[rowIndex];
      if (!row?.result) continue;

      const originalResult = row.result;
      const nextResult = { ...originalResult };
      let rowChanged = false;

      for (let columnIndex = bounds.firstColumn; columnIndex <= bounds.lastColumn; columnIndex += 1) {
        const column = resultGridColumns[columnIndex];
        if (!column) continue;

        if (column.type === 'pilot') {
          const currentValue = nextResult[column.key] ?? (column.key === 'piloto' ? '' : nextResult.piloto) ?? '';
          if (currentValue) {
            nextResult[column.key] = '';
            if (column.key === 'piloto') nextResult.idpiloto = null;
            rowChanged = true;
            clearedCells += 1;
          }
          continue;
        }

        if (String(nextResult[column.key] ?? '') !== '') {
          nextResult[column.key] = '';
          rowChanged = true;
          clearedCells += 1;
        }
      }

      if (!rowChanged) continue;
      const resultKey = nextResult._key || `id-${nextResult.id}`;
      nextResult._key = resultKey;
      clearedDirtyResults[resultKey] = true;
      const resultIndex = nextResults.findIndex(result => result === originalResult);
      if (resultIndex >= 0) nextResults[resultIndex] = nextResult;
    }

    if (!clearedCells) return;
    setResults(nextResults);
    setDirtyResults(current => ({ ...current, ...clearedDirtyResults }));
    setResultMessage(`${clearedCells} celda${clearedCells === 1 ? '' : 's'} borrada${clearedCells === 1 ? '' : 's'}. Presioná Guardar para confirmar.`);
  };

  const handleSaveResults = async () => {
    const dirtyRows = results.filter(result => {
      const resultKey = result._key || `id-${result.id}`;
      return dirtyResults[resultKey];
    });
    const isEmptyNewRow = result => result._isNew
      && ['piloto', 'piloto_sprint', 'piloto_final', ...resultSpreadsheetColumns.filter(column => column.type !== 'pilot').map(column => column.key), ...resultSanctionFields.map(field => field.key)]
        .every(field => !String(result[field] ?? '').trim());
    const emptyNewRows = dirtyRows.filter(isEmptyNewRow);
    const pendingResults = dirtyRows.filter(result => !isEmptyNewRow(result));

    if (emptyNewRows.length) {
      const emptyKeys = new Set(emptyNewRows.map(result => result._key));
      setResults(current => current.filter(result => !emptyKeys.has(result._key)));
      setDirtyResults(current => Object.fromEntries(Object.entries(current).filter(([key]) => !emptyKeys.has(key))));
    }
    if (!pendingResults.length) return;

    const validationErrors = {};
    const validationMessages = [];
    const resolvedPilots = new Map();
    const integerFields = [
      ['presentismo', 'Presentismo'],
      ['pts_qualy_sprint', 'Pts. QS'],
      ['pts_qualy_final', 'Pts. QF'],
    ];
    const decimalFields = [
      ['pts_sprint', 'Pts. Sprint'],
      ['pts_final', 'Pts. Final'],
    ];
    const resultGroups = [
      {
        pilotField: 'piloto',
        label: 'clasificación',
        fields: ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'pos_qualy_final', 'pts_qualy_final', ...resultAchievementFields.map(field => field.key)],
      },
      { pilotField: 'piloto_sprint', label: 'Sprint', fields: ['pos_sprint', 'pts_sprint'] },
      { pilotField: 'piloto_final', label: 'Final', fields: ['pos_final', 'pts_final'] },
    ];

    for (const result of pendingResults) {
      if (result._delete) continue;
      const resultKey = result._key || `id-${result.id}`;
      integerFields.forEach(([field, label]) => {
        if (/^\d*$/.test(String(result[field] ?? '').trim())) return;
        const message = `${label} debe ser un número entero.`;
        validationErrors[`${resultKey}:${field}`] = message;
        validationMessages.push(message);
      });
      decimalFields.forEach(([field, label]) => {
        if (/^\d*[.,]?\d*$/.test(String(result[field] ?? '').trim())) return;
        const message = `${label} debe ser un número.`;
        validationErrors[`${resultKey}:${field}`] = message;
        validationMessages.push(message);
      });
    }

    const dirtyRounds = new Set(pendingResults.filter(result => !result._delete).map(result => String(result.ronda)));
    dirtyRounds.forEach(roundKey => {
      const roundRows = results.filter(result => !result._delete && String(result.ronda) === roundKey);
      resultGroups.forEach(group => {
        const pilotsInGroup = new Map();
        roundRows.forEach(result => {
          const resultKey = result._key || `id-${result.id}`;
          const rawPilot = result[group.pilotField] ?? (group.pilotField === 'piloto' ? '' : result.piloto) ?? '';
          const requestedName = String(rawPilot).trim();
          const hasGroupData = group.fields.some(field => String(result[field] ?? '').trim() !== '');
          if (!requestedName && !hasGroupData) return;

          const driver = resultRegisteredDrivers.find(item =>
            String(item.nombre || '').localeCompare(requestedName, 'es-AR', { sensitivity: 'base' }) === 0
          );
          const pilotCellKey = `${resultKey}:${group.pilotField}`;
          if (!driver) {
            const message = requestedName
              ? `El piloto "${requestedName}" de ${group.label} no está inscripto.`
              : `Falta el piloto de ${group.label}.`;
            validationErrors[pilotCellKey] = message;
            validationMessages.push(message);
            return;
          }

          resolvedPilots.set(pilotCellKey, driver);
          const duplicateKey = String(driver.id);
          if (pilotsInGroup.has(duplicateKey)) {
            const firstCellKey = pilotsInGroup.get(duplicateKey);
            const message = `${driver.nombre} está repetido en la columna de ${group.label}.`;
            validationErrors[firstCellKey] = message;
            validationErrors[pilotCellKey] = message;
            validationMessages.push(message);
          } else {
            pilotsInGroup.set(duplicateKey, pilotCellKey);
          }
        });
      });
    });

    if (Object.keys(validationErrors).length) {
      setResultCellErrors(validationErrors);
      setResultMessage(`No se pudo guardar. Revisá las celdas marcadas en rojo. ${validationMessages[0]}`);
      return;
    }

    setResultCellErrors({});
    setSavingResults(true);
    setResultMessage('');

    try {
      const editableFields = ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'pos_sprint', 'pts_sprint', 'pos_qualy_final', 'pts_qualy_final', 'pos_final', 'pts_final', ...resultSanctionFields.map(field => field.key), ...resultAchievementFields.map(field => field.key)];
      const assignments = new Map();

      dirtyRounds.forEach(roundKey => {
        const roundRows = results.filter(result => !result._delete && String(result.ronda) === roundKey);
        const savedRoundRows = savedResults.filter(result => String(result.ronda) === roundKey);
        const savedByDriver = new Map(savedRoundRows.map(result => [String(result.idpiloto), result]));
        const roundEvent = resultRounds.find(round => String(round.ronda) === roundKey);

        resultGroups.forEach(group => {
          roundRows.forEach(result => {
            const resultKey = result._key || `id-${result.id}`;
            const driver = resolvedPilots.get(`${resultKey}:${group.pilotField}`);
            if (!driver) return;
            const assignmentKey = `${roundKey}:${driver.id}`;
            if (!assignments.has(assignmentKey)) {
              const savedResult = savedByDriver.get(String(driver.id));
              assignments.set(assignmentKey, {
                savedResult,
                data: Object.fromEntries(editableFields.map(field => [field, savedResult?.[field] ?? ''])),
                metadata: {
                  idcampeonato: Number(resultChampionshipId),
                  fecha: String(roundEvent?.fecha || result.fecha || '').slice(0, 10),
                  ronda: Number(roundKey),
                  idcircuito: Number(roundEvent?.idcircuito || result.idcircuito),
                  idpiloto: Number(driver.id),
                },
              });
            }
            const assignment = assignments.get(assignmentKey);
            group.fields.forEach(field => {
              assignment.data[field] = result[field] ?? '';
            });
          });
        });

        roundRows.forEach(result => {
          if (!result.idpiloto) return;
          const assignment = assignments.get(`${roundKey}:${result.idpiloto}`);
          if (!assignment) return;
          resultSanctionFields.forEach(field => {
            assignment.data[field.key] = result[field.key] ?? '';
          });
        });
      });

      const changes = [
        ...pendingResults.filter(result => result._delete).map(result => ({ id: result.id, delete: true })),
        ...[...assignments.values()].map(({ savedResult, data, metadata }) => {
          const editableData = {
            idcampeonato: Number(resultChampionshipId),
            idpiloto: metadata.idpiloto,
            presentismo: Number(data.presentismo || 0),
            pos_qualy_sprint: String(data.pos_qualy_sprint || '').trim(),
            pts_qualy_sprint: Number(data.pts_qualy_sprint || 0),
            pos_sprint: String(data.pos_sprint || '').trim(),
            pts_sprint: parseResultPoints(data.pts_sprint),
            pos_qualy_final: String(data.pos_qualy_final || '').trim(),
            pts_qualy_final: Number(data.pts_qualy_final || 0),
            pos_final: String(data.pos_final || '').trim(),
            pts_final: parseResultPoints(data.pts_final),
            desc_sancion_qualy_sprint: String(data.desc_sancion_qualy_sprint || '').trim(),
            desc_sancion_sprint: String(data.desc_sancion_sprint || '').trim(),
            desc_sancion_qualy_final: String(data.desc_sancion_qualy_final || '').trim(),
            desc_sancion_final: String(data.desc_sancion_final || '').trim(),
            pole_sprint: Number(Boolean(Number(data.pole_sprint))),
            ganador_sprint: Number(Boolean(Number(data.ganador_sprint))),
            pole_final: Number(Boolean(Number(data.pole_final))),
            ganador_final: Number(Boolean(Number(data.ganador_final))),
            campeon: Number(Boolean(Number(data.campeon))),
          };
          return {
            id: savedResult?.id || null,
            data: savedResult ? editableData : { ...metadata, ...editableData },
          };
        }),
      ];

      await resultsApi.saveBulk(changes);

      const response = await resultsApi.getAll({ idcampeonato: resultChampionshipId });
      const savedRows = response.data.data ?? [];
      setResults(buildEditableResultRows(savedRows));
      setSavedResults(savedRows);
      setDirtyResults({});
      setResultCellErrors({});
      setResultMessage(`${changes.length} resultado${changes.length === 1 ? '' : 's'} guardado${changes.length === 1 ? '' : 's'} correctamente.`);
    } catch (err) {
      setResultMessage(err.response?.data?.error || 'No se pudieron guardar todos los cambios.');
    } finally {
      setSavingResults(false);
    }
  };

  const handleCircuitSubmit = async event => {
    event.preventDefault();
    setSavingCircuit(true);
    setCircuitMessage('');

    try {
      const data = new FormData();
      const normalizedForm = normalizeCircuitForm(circuitForm);
      Object.entries(normalizedForm).forEach(([key, value]) => data.append(key, value));
      if (lockedCircuitName && baseCircuitImagePath) data.append('imagen_actual', baseCircuitImagePath);
      if (circuitImageFile && !lockedCircuitName) data.append('imagen', circuitImageFile);
      if (circuitLayoutFile) {
        const croppedLayout = await createSquarePngFile(circuitLayoutFile, circuitLayoutCrop, 'trazado.png');
        data.append('trazado', croppedLayout);
      }

      if (editingCircuitId) {
        await circuitsApi.update(editingCircuitId, data);
      } else {
        await circuitsApi.create(data);
      }

      const circuitsRes = await circuitsApi.getAll();

      setCircuits(circuitsRes.data.data ?? []);
      resetCircuitForm();
      setCircuitMessage(editingCircuitId ? 'Circuito actualizado correctamente.' : 'Circuito cargado correctamente.');
    } catch (err) {
      setCircuitMessage(err.response?.data?.error || 'No se pudo cargar el circuito.');
    } finally {
      setSavingCircuit(false);
    }
  };

  const handleCategorySubmit = async event => {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryMessage('');

    try {
      const data = new FormData();
      data.append('categoria', categoryForm.categoria);
      if (categoryLogoFile) {
        const croppedLogo = await createSquarePngFile(categoryLogoFile, categoryLogoCrop, 'logo.png');
        data.append('logo', croppedLogo);
      }

      if (editingCategoryId) {
        await categoriesApi.update(editingCategoryId, data);
      } else {
        await categoriesApi.create(data);
      }

      const categoriesRes = await categoriesApi.getAll();

      setCategories(categoriesRes.data.data ?? []);
      resetCategoryForm();
      setCategoryMessage(editingCategoryId ? 'Categoría actualizada correctamente.' : 'Categoría cargada correctamente.');
    } catch (err) {
      setCategoryMessage(err.response?.data?.error || 'No se pudo guardar la categoría.');
    } finally {
      setSavingCategory(false);
    }
  };

  const loadCategoryGallery = async (categoryId, preferredChampionshipId = '') => {
    setCategoryGalleryCategoryId(String(categoryId || ''));
    setCategoryGalleryMessage('');
    setCategoryGalleryFiles([]);
    if (categoryGalleryInputRef.current) categoryGalleryInputRef.current.value = '';
    if (!categoryId) {
      setCategoryGalleryChampionshipId('');
      setCategoryGallerySeasons([]);
      return;
    }
    try {
      const response = await categoriesApi.getGallery(categoryId);
      const seasons = response.data.data?.seasons || [];
      const selectedId = seasons.some(item => String(item.id) === String(preferredChampionshipId))
        ? String(preferredChampionshipId)
        : String(seasons[0]?.id || '');
      setCategoryGallerySeasons(seasons);
      setCategoryGalleryChampionshipId(selectedId);
    } catch (error) {
      setCategoryGallerySeasons([]);
      setCategoryGalleryChampionshipId('');
      setCategoryGalleryMessage(error.response?.data?.error || 'No se pudo cargar la galería de la categoría.');
    }
  };

  const uploadCategoryGallery = async () => {
    if (!categoryGalleryCategoryId || !categoryGalleryChampionshipId || !categoryGalleryFiles.length) return;
    setSavingCategoryGallery(true);
    setCategoryGalleryMessage('');
    try {
      const data = new FormData();
      categoryGalleryFiles.forEach(file => data.append('images', file));
      const response = await categoriesApi.uploadGalleryImages(categoryGalleryCategoryId, categoryGalleryChampionshipId, data);
      setCategoryGallerySeasons(current => current.map(season => String(season.id) === String(categoryGalleryChampionshipId)
        ? { ...season, images: response.data.data || [] }
        : season));
      setCategoryGalleryFiles([]);
      if (categoryGalleryInputRef.current) categoryGalleryInputRef.current.value = '';
      setCategoryGalleryMessage(response.data.message || 'Fotos cargadas correctamente.');
    } catch (error) {
      setCategoryGalleryMessage(error.response?.data?.error || 'No se pudieron cargar las fotos.');
    } finally {
      setSavingCategoryGallery(false);
    }
  };

  const deleteCategoryGalleryImage = async image => {
    if (!window.confirm('¿Eliminar esta foto de la galería de la temporada?')) return;
    setCategoryGalleryMessage('');
    try {
      const response = await categoriesApi.removeGalleryImage(categoryGalleryCategoryId, categoryGalleryChampionshipId, image.filename, image.source);
      setCategoryGallerySeasons(current => current.map(season => String(season.id) === String(categoryGalleryChampionshipId)
        ? { ...season, images: response.data.data || [] }
        : season));
      setCategoryGalleryMessage(response.data.message || 'Foto eliminada.');
    } catch (error) {
      setCategoryGalleryMessage(error.response?.data?.error || 'No se pudo eliminar la foto.');
    }
  };

  const handleChampionshipSubmit = async event => {
    event.preventDefault();
    setSavingChampionship(true);
    setChampionshipMessage('');

    try {
      const data = new FormData();
      Object.entries(championshipForm).forEach(([key, value]) => data.append(key, value));
      if (championshipRulesFile) data.append('reglamento', championshipRulesFile);

      if (editingChampionshipId) {
        await championshipsApi.update(editingChampionshipId, data);
      } else {
        await championshipsApi.create(data);
      }

      const championshipsRes = await championshipsApi.getAll();

      const championshipRows = championshipsRes.data.data ?? [];
      setChampionships(championshipRows);
      resetChampionshipForm();
      setChampionshipMessage(editingChampionshipId ? 'Campeonato actualizado correctamente.' : 'Campeonato cargado correctamente.');
    } catch (err) {
      setChampionshipMessage(err.response?.data?.error || 'No se pudo guardar el campeonato.');
    } finally {
      setSavingChampionship(false);
    }
  };

  const loadChampionshipPrizes = async championshipId => {
    setChampionshipPrizesId(String(championshipId || ''));
    if (!championshipId) {
      setChampionshipPrizes([]);
      setChampionshipPrizesMessage('');
      return;
    }
    setLoadingChampionshipPrizes(true);
    setChampionshipPrizesMessage('');
    try {
      const response = await championshipsApi.getPrizes(championshipId);
      setChampionshipPrizes((response.data.data || []).map(prize => ({
        posicion: String(prize.posicion),
        efectivo: Boolean(Number(prize.efectivo)),
        inscripcion: Boolean(Number(prize.inscripcion)),
        trofeo: Boolean(Number(prize.trofeo)),
      })));
    } catch (error) {
      setChampionshipPrizes([]);
      setChampionshipPrizesMessage(error.response?.data?.error || 'No se pudieron cargar los premios.');
    } finally {
      setLoadingChampionshipPrizes(false);
    }
  };

  const addChampionshipPrize = () => {
    const nextPosition = Math.max(0, ...championshipPrizes.map(prize => Number(prize.posicion) || 0)) + 1;
    setChampionshipPrizes(current => [...current, createEmptyPrize(nextPosition)]);
    setChampionshipPrizesMessage('');
  };

  const updateChampionshipPrize = (index, field, value) => {
    setChampionshipPrizes(current => current.map((prize, prizeIndex) => (
      prizeIndex === index ? { ...prize, [field]: value } : prize
    )));
    setChampionshipPrizesMessage('');
  };

  const removeChampionshipPrize = index => {
    setChampionshipPrizes(current => current.filter((_, prizeIndex) => prizeIndex !== index));
    setChampionshipPrizesMessage('Recordá guardar los premios para aplicar la eliminación.');
  };

  const saveChampionshipPrizes = async () => {
    if (!championshipPrizesId) return;
    setSavingChampionshipPrizes(true);
    setChampionshipPrizesMessage('');
    try {
      const response = await championshipsApi.savePrizes(championshipPrizesId, championshipPrizes);
      setChampionshipPrizes((response.data.data || []).map(prize => ({
        posicion: String(prize.posicion),
        efectivo: Boolean(Number(prize.efectivo)),
        inscripcion: Boolean(Number(prize.inscripcion)),
        trofeo: Boolean(Number(prize.trofeo)),
      })));
      setChampionshipPrizesMessage(response.data.message || 'Premios guardados correctamente.');
    } catch (error) {
      setChampionshipPrizesMessage(error.response?.data?.error || 'No se pudieron guardar los premios.');
    } finally {
      setSavingChampionshipPrizes(false);
    }
  };

  const handleCarBrandSubmit = async event => {
    event.preventDefault();
    setSavingCarBrand(true);
    setCarBrandMessage('');

    try {
      const data = new FormData();
      data.append('marca', carBrandForm.marca.trim());
      if (carBrandLogoFile) {
        const croppedLogo = await createSquarePngFile(carBrandLogoFile, carBrandLogoCrop, 'logo-marca.png');
        data.append('logo', croppedLogo);
      }

      if (editingCarBrandId) {
        await carBrandsApi.update(editingCarBrandId, data);
      } else {
        await carBrandsApi.create(data);
      }

      const response = await carBrandsApi.getAll();
      setCarBrands(response.data.data ?? []);
      resetCarBrandForm();
      setCarBrandMessage(editingCarBrandId ? 'Marca actualizada correctamente.' : 'Marca cargada correctamente.');
    } catch (err) {
      setCarBrandMessage(err.response?.data?.error || 'No se pudo guardar la marca.');
    } finally {
      setSavingCarBrand(false);
    }
  };

  const handleCarSubmit = async event => {
    event.preventDefault();
    setSavingCar(true);
    setCarMessage('');

    try {
      const data = new FormData();
      data.append('idcategoria', carForm.idcategoria);
      data.append('marca', carForm.marca);
      data.append('modelo', carForm.modelo.trim());
      if (carImageFile) data.append('imagen', carImageFile);

      if (editingCarId) {
        await carsApi.update(editingCarId, data);
      } else {
        await carsApi.create(data);
      }

      const carsRes = await carsApi.getAll();

      setCars(carsRes.data.data ?? []);
      resetCarForm();
      setCarMessage(editingCarId ? 'Auto actualizado correctamente.' : 'Auto cargado correctamente.');
    } catch (err) {
      setCarMessage(err.response?.data?.error || 'No se pudo guardar el auto.');
    } finally {
      setSavingCar(false);
    }
  };

  const handleEventSubmit = async event => {
    event.preventDefault();
    if (!editingEventKey) return;
    setSavingEvent(true);
    setEventMessage('');

    try {
      const eventHour = Number(eventForm.fecha.slice(11, 13));
      if (![21, 22].includes(eventHour)) {
        setEventMessage('Las fechas deben cargarse a las 21 o 22 hs.');
        setSavingEvent(false);
        return;
      }

      const payload = {
        idcampeonato: Number(eventForm.idcampeonato),
        fecha: toMySqlDateTime(eventForm.fecha),
        ronda: Number(eventForm.ronda),
        idcircuito: Number(eventForm.idcircuito),
        especial: eventForm.especial ? 1 : 0,
        especialidad: eventForm.especial ? eventForm.especialidad.toLocaleUpperCase('es-AR') : '',
        coronacion: eventForm.coronacion ? 1 : 0,
        transmision: eventForm.transmision.trim(),
      };

      await eventsApi.update(editingEventKey.idcampeonato, editingEventKey.ronda, payload);

      const eventsRes = await eventsApi.getAll();

      setEvents(eventsRes.data.data ?? []);
      resetEventForm();
      setEventMessage('Fecha actualizada correctamente.');
    } catch (err) {
      setEventMessage(err.response?.data?.error || 'No se pudo guardar la fecha.');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleEventBatchSubmit = async event => {
    event.preventDefault();
    if (!eventBatchRows.length) {
      setEventMessage('Generá las fechas antes de guardar el calendario.');
      return;
    }
    if (eventBatchRows.some(row => !row.fecha || !row.idcircuito)) {
      setEventMessage('Seleccioná un circuito para todas las rondas.');
      return;
    }

    setSavingEvent(true);
    setEventMessage('');

    try {
      const payload = eventBatchRows.map(row => ({
        idcampeonato: Number(eventBatch.idcampeonato),
        fecha: toMySqlDateTime(row.fecha),
        ronda: Number(row.ronda),
        idcircuito: Number(row.idcircuito),
        especial: row.especial ? 1 : 0,
        especialidad: row.especial ? row.especialidad.toLocaleUpperCase('es-AR') : '',
        coronacion: row.coronacion ? 1 : 0,
        transmision: row.transmision.trim(),
      }));

      await eventsApi.createBatch(payload);
      const eventsRes = await eventsApi.getAll();
      setEvents(eventsRes.data.data ?? []);
      resetEventBatch();
      setEventMessage(`${payload.length} fechas cargadas correctamente.`);
    } catch (err) {
      setEventMessage(err.response?.data?.error || 'No se pudo guardar el calendario.');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDriverSubmit = async event => {
    event.preventDefault();
    setDriverMessage('');

    const payload = {
      nombre: capitalizeValue(driverForm.nombre),
      localidad: capitalizeValue(driverForm.localidad),
      provincia: capitalizeValue(driverForm.provincia),
      telefono: driverForm.telefono.replace(/\D/g, ''),
      nacionalidad: normalizeCountryCode(driverForm.nacionalidad),
      steam: driverForm.steam.trim(),
      ig: formatInstagramHandle(driverForm.ig),
    };
    if (driverDuplicate) {
      alertDriverDuplicate();
      return;
    }

    setSavingDriver(true);

    try {
      if (editingDriverId) {
        await driversApi.update(editingDriverId, payload);
      } else {
        await driversApi.create(payload);
      }

      const driversRes = await driversApi.getAll();

      setDrivers(driversRes.data.data ?? []);
      resetDriverForm();
      setDriverMessage(editingDriverId ? 'Piloto actualizado correctamente.' : 'Piloto cargado correctamente.');
    } catch (err) {
      const message = err.response?.data?.error || 'No se pudo guardar el piloto.';
      window.alert(message);
      setDriverMessage(message);
    } finally {
      setSavingDriver(false);
    }
  };

  const handleDeleteCircuit = async id => {
    const confirmed = window.confirm('¿Eliminar este circuito?');
    if (!confirmed) return;

    try {
      await circuitsApi.remove(id);
      setCircuits(current => current.filter(circuit => circuit.id !== id));
      setCircuitMessage('Circuito eliminado.');
    } catch (err) {
      setCircuitMessage(err.response?.data?.error || 'No se pudo eliminar el circuito.');
    }
  };

  const handleDeleteCategory = async id => {
    const confirmed = window.confirm('¿Eliminar esta categoría?');
    if (!confirmed) return;

    try {
      await categoriesApi.remove(id);
      setCategories(current => current.filter(category => category.id !== id));
      setCategoryMessage('Categoría eliminada.');
    } catch (err) {
      setCategoryMessage(err.response?.data?.error || 'No se pudo eliminar la categoría.');
    }
  };

  const handleDeleteChampionship = async id => {
    const confirmed = window.confirm('¿Eliminar este campeonato?');
    if (!confirmed) return;

    try {
      await championshipsApi.remove(id);
      setChampionships(current => current.filter(championship => championship.id !== id));
      setChampionshipMessage('Campeonato eliminado.');
    } catch (err) {
      setChampionshipMessage(err.response?.data?.error || 'No se pudo eliminar el campeonato.');
    }
  };

  const selectRegistrationDriverDetails = registration => {
    const driver = drivers.find(item => String(item.id) === String(registration.idpiloto)) || registration;
    setSelectedRegistrationDriverId(Number(registration.idpiloto));
    setRegistrationDriverDetails({
      nombre: driver.nombre || '',
      localidad: driver.localidad || '',
      provincia: driver.provincia || '',
      telefono: driver.telefono || '',
      nacionalidad: normalizeCountryCode(driver.nacionalidad),
      steam: driver.steam || '',
      ig: formatInstagramHandle(driver.ig),
    });
    setRegistrationDriverDetailsMessage('');
  };

  const handleRegistrationDriverDetailsChange = event => {
    const { name, value } = event.target;
    const nextValue = name === 'telefono'
      ? value.replace(/\D/g, '')
      : name === 'ig'
        ? formatInstagramHandle(value)
        : ['nombre', 'localidad', 'provincia'].includes(name)
          ? capitalizeInputValue(value)
          : value;
    setRegistrationDriverDetails(current => ({ ...current, [name]: nextValue }));
    setRegistrationDriverDetailsMessage('');
  };

  const saveRegistrationDriverDetails = async event => {
    event.preventDefault();
    if (!selectedRegistrationDriverId) return;
    setSavingRegistrationDriver(true);
    setRegistrationDriverDetailsMessage('');
    const payload = {
      nombre: capitalizeValue(registrationDriverDetails.nombre),
      localidad: capitalizeValue(registrationDriverDetails.localidad),
      provincia: capitalizeValue(registrationDriverDetails.provincia),
      telefono: String(registrationDriverDetails.telefono || '').replace(/\D/g, ''),
      nacionalidad: normalizeCountryCode(registrationDriverDetails.nacionalidad),
      steam: String(registrationDriverDetails.steam || '').trim(),
      ig: formatInstagramHandle(registrationDriverDetails.ig),
    };
    try {
      const response = await driversApi.update(selectedRegistrationDriverId, payload);
      const updatedDriver = response.data.data;
      setDrivers(current => current.map(driver => String(driver.id) === String(selectedRegistrationDriverId) ? { ...driver, ...updatedDriver } : driver));
      setRegistrations(current => current.map(registration => String(registration.idpiloto) === String(selectedRegistrationDriverId) ? {
        ...registration,
        nombre: updatedDriver.nombre,
        localidad: updatedDriver.localidad,
        provincia: updatedDriver.provincia,
        telefono: updatedDriver.telefono,
        nacionalidad: updatedDriver.nacionalidad,
        steam: updatedDriver.steam,
        ig: updatedDriver.ig,
      } : registration));
      setRegistrationDriverDetails(current => ({ ...current, ...updatedDriver }));
      setRegistrationDriverDetailsMessage('Datos del piloto actualizados correctamente.');
    } catch (error) {
      setRegistrationDriverDetailsMessage(error.response?.data?.error || 'No se pudieron actualizar los datos del piloto.');
    } finally {
      setSavingRegistrationDriver(false);
    }
  };

  const handleRegistrationEdit = (registration, field, value) => {
    const key = `${registration.idcampeonato}-${registration.idpiloto}`;
    const currentCar = cars.find(car => String(car.id) === String(registration.idauto));
    setRegistrationEdits(current => {
      const edit = current[key] || {
        idcampeonato: registration.idcampeonato,
        idpiloto: registration.idpiloto,
        idmarca: String(registration.idmarca || currentCar?.idmarca || ''),
        idauto: String(registration.idauto || ''),
        numero: String(registration.numero ?? ''),
        pago: Boolean(registration.pago),
        listo: Boolean(registration.listo),
        plan_id: getRegistrationPlanId(registration),
        idauto_oficial: String(registration.idauto_oficial || ''),
      };
      return {
        ...current,
        [key]: {
          ...edit,
          [field]: value,
          ...(field === 'idmarca' ? { idauto: '' } : {}),
        },
      };
    });
    setRegistrationMessage('');
  };

  const handleRegistrationPlanChange = (registration, planId) => {
    const key = `${registration.idcampeonato}-${registration.idpiloto}`;
    const currentCar = cars.find(car => String(car.id) === String(registration.idauto));
    setRegistrationEdits(current => {
      const edit = current[key] || {
        idcampeonato: registration.idcampeonato,
        idpiloto: registration.idpiloto,
        idmarca: String(registration.idmarca || currentCar?.idmarca || ''),
        idauto: String(registration.idauto || ''),
        numero: String(registration.numero ?? ''),
        pago: Boolean(registration.pago),
        listo: Boolean(registration.listo),
        plan_id: getRegistrationPlanId(registration),
        idauto_oficial: String(registration.idauto_oficial || ''),
      };
      const wasOfficial = edit.plan_id === 'diseno_oficial';
      return {
        ...current,
        [key]: {
          ...edit,
          plan_id: planId,
          idauto_oficial: '',
          ...(planId === 'extra' ? { numero: '0' } : {}),
          ...(planId !== 'extra' && (edit.numero === '0' || wasOfficial) ? { numero: '' } : {}),
          ...(planId === 'diseno_oficial' ? { idmarca: '', idauto: '', numero: '' } : {}),
        },
      };
    });
    setEditingRegistrationNumbers(current => ({ ...current, [key]: false }));
    setRegistrationMessage('');
  };

  const handleRegistrationOfficialCarChange = (registration, officialCarId) => {
    const officialCar = registrationOfficialCars.find(car => String(car.id) === String(officialCarId));
    const key = `${registration.idcampeonato}-${registration.idpiloto}`;
    const currentCar = cars.find(car => String(car.id) === String(registration.idauto));
    setRegistrationEdits(current => {
      const edit = current[key] || {
        idcampeonato: registration.idcampeonato,
        idpiloto: registration.idpiloto,
        idmarca: String(registration.idmarca || currentCar?.idmarca || ''),
        idauto: String(registration.idauto || ''),
        numero: String(registration.numero ?? ''),
        pago: Boolean(registration.pago),
        listo: Boolean(registration.listo),
        plan_id: getRegistrationPlanId(registration),
        idauto_oficial: String(registration.idauto_oficial || ''),
      };
      return {
        ...current,
        [key]: {
          ...edit,
          plan_id: 'diseno_oficial',
          idauto_oficial: String(officialCarId || ''),
          idmarca: String(officialCar?.idmarca || ''),
          idauto: String(officialCar?.idauto || ''),
          numero: officialCar ? String(officialCar.numero) : '',
        },
      };
    });
    if (field === 'numero') {
      setRegistrationNumberAvailability(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    setRegistrationMessage('');
  };

  const validateAdminRegistrationNumber = async (registration, number = null) => {
    const key = `${registration.idcampeonato}-${registration.idpiloto}`;
    const edit = registrationEdits[key];
    const planId = edit?.plan_id || getRegistrationPlanId(registration);
    if (planId === 'extra' || planId === 'diseno_oficial') return true;

    const candidate = Number(number ?? edit?.numero ?? registration.numero);
    if (!Number.isInteger(candidate) || candidate < 1 || candidate > 255) {
      setRegistrationNumberAvailability(current => ({
        ...current,
        [key]: { available: false, number: candidate, message: 'Ingresá un número entero entre 1 y 255.' },
      }));
      return false;
    }

    setRegistrationNumberAvailability(current => ({ ...current, [key]: { checking: true, number: candidate } }));
    try {
      const response = await registrationFormsApi.checkNumber(registration.idcampeonato, candidate, registration.idpiloto, true);
      const available = Boolean(response.data.data.available);
      const reason = response.data.data.reason;
      const message = available
        ? `Número ${candidate} disponible.`
        : reason === 'reserved_official'
          ? `El número ${candidate} está reservado para una pintura oficial.`
          : reason === 'reserved_ranking'
            ? `El número ${candidate} está reservado para un piloto rankeado.`
            : reason === 'ranked_number'
              ? `A este piloto le corresponde el número ${response.data.data.assignedNumber} por ranking.`
              : `El número ${candidate} ya está ocupado en este campeonato.`;
      setRegistrationNumberAvailability(current => ({ ...current, [key]: { available, number: candidate, message } }));
      return available;
    } catch (error) {
      const message = error.response?.data?.error || 'No se pudo comprobar la disponibilidad del número.';
      setRegistrationNumberAvailability(current => ({ ...current, [key]: { available: false, number: candidate, message } }));
      return false;
    }
  };

  const handleSaveRegistrationChanges = async () => {
    const changes = Object.values(registrationEdits);
    if (!changes.length) return;
    if (changes.some(change => !change.plan_id || !change.idauto || (change.plan_id !== 'extra' && change.numero === '') || (change.plan_id === 'diseno_oficial' && !change.idauto_oficial))) {
      setRegistrationMessage('Completá el plan, el auto, el número o la pintura oficial en todas las inscripciones modificadas.');
      return;
    }

    setRegistrationMessage('');
    const registrationsByKey = new Map(registrations.map(registration => [`${registration.idcampeonato}-${registration.idpiloto}`, registration]));
    const numbersAreAvailable = await Promise.all(changes.map(change => {
      const registration = registrationsByKey.get(`${change.idcampeonato}-${change.idpiloto}`);
      if (!registration) return false;
      const numberChanged = Number(change.numero) !== Number(registration.numero);
      const planChanged = change.plan_id !== getRegistrationPlanId(registration);
      return numberChanged || planChanged
        ? validateAdminRegistrationNumber(registration, change.numero)
        : true;
    }));
    if (numbersAreAvailable.some(available => !available)) {
      setRegistrationMessage('No se guardaron los cambios. Corregí los números marcados como ocupados o reservados.');
      return;
    }

    setSavingRegistrationChanges(true);
    try {
      await registrationsApi.updateBulk(changes.map(change => ({
        idcampeonato: Number(change.idcampeonato),
        idpiloto: Number(change.idpiloto),
        idauto: Number(change.idauto),
        numero: Number(change.numero),
        pago: Boolean(change.pago),
        listo: Boolean(change.listo),
        plan_id: change.plan_id,
        idauto_oficial: change.idauto_oficial ? Number(change.idauto_oficial) : null,
      })));
      const response = await registrationsApi.getAll();
      setRegistrations(response.data.data ?? []);
      setRegistrationEdits({});
      setEditingRegistrationNumbers({});
      if (registrationChampionshipFilter) {
        const officialCarsResponse = await registrationFormsApi.getOfficialCars(registrationChampionshipFilter);
        setRegistrationOfficialCars(officialCarsResponse.data.data || []);
      }
      setRegistrationMessage(`${changes.length} inscripción${changes.length === 1 ? '' : 'es'} actualizada${changes.length === 1 ? '' : 's'}.`);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'No se pudieron guardar los cambios.';
      const conflictingNumber = errorMessage.match(/número\s+(\d+)/i)?.[1];
      if (conflictingNumber) {
        setRegistrationNumberAvailability(current => {
          const next = { ...current };
          changes.forEach(change => {
            if (Number(change.numero) !== Number(conflictingNumber)) return;
            next[`${change.idcampeonato}-${change.idpiloto}`] = {
              available: false,
              number: Number(conflictingNumber),
              message: errorMessage,
            };
          });
          return next;
        });
      }
      setRegistrationMessage(errorMessage);
    } finally {
      setSavingRegistrationChanges(false);
    }
  };

  const handleDeleteCarBrand = async id => {
    const confirmed = window.confirm('¿Eliminar esta marca?');
    if (!confirmed) return;

    try {
      await carBrandsApi.remove(id);
      setCarBrands(current => current.filter(brand => brand.id !== id));
      setCarBrandMessage('Marca eliminada.');
    } catch (err) {
      setCarBrandMessage(err.response?.data?.error || 'No se pudo eliminar la marca.');
    }
  };

  const handleDeleteCar = async id => {
    const confirmed = window.confirm('¿Eliminar este auto?');
    if (!confirmed) return;

    try {
      await carsApi.remove(id);
      setCars(current => current.filter(car => car.id !== id));
      setCarMessage('Auto eliminado.');
    } catch (err) {
      setCarMessage(err.response?.data?.error || 'No se pudo eliminar el auto.');
    }
  };

  const handleDeleteEvent = async event => {
    const confirmed = window.confirm(`¿Eliminar la ronda ${event.ronda} de ${event.categoria} T${event.temporada}?`);
    if (!confirmed) return;

    try {
      await eventsApi.remove(event.idcampeonato, event.ronda);
      setEvents(current => current.filter(item => !(item.idcampeonato === event.idcampeonato && item.ronda === event.ronda)));
      setEventMessage('Fecha eliminada.');
    } catch (err) {
      setEventMessage(err.response?.data?.error || 'No se pudo eliminar la fecha.');
    }
  };

  const handleDeleteDriver = async id => {
    const confirmed = window.confirm('¿Eliminar este piloto?');
    if (!confirmed) return;

    try {
      await driversApi.remove(id);
      setDrivers(current => current.filter(driver => driver.id !== id));
      setDriverMessage('Piloto eliminado.');
    } catch (err) {
      setDriverMessage(err.response?.data?.error || 'No se pudo eliminar el piloto.');
    }
  };

  const handleEditCircuit = circuit => {
    setEditingCircuitId(circuit.id);
    setLockedCircuitName(false);
    setBaseCircuitImagePath('');
    setCircuitForm({
      nombre: circuit.nombre || '',
      localidad: circuit.localidad || '',
      provincia: circuit.provincia || '',
      pais: normalizeCountryCode(circuit.pais) || 'ar',
      variante: circuit.variante || '',
    });
    setCircuitImageFile(null);
    setCircuitLayoutFile(null);
    setCircuitLayoutCrop(defaultCropSettings);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (layoutInputRef.current) layoutInputRef.current.value = '';
    setCircuitMessage(`Editando ${circuit.nombre}. Si no cargás nuevas imágenes, se conservan las actuales.`);
  };

  const handleEditCategory = category => {
    setEditingCategoryId(category.id);
    setCategoryForm({ categoria: category.categoria || '' });
    setCategoryLogoFile(null);
    setCategoryLogoCrop(defaultCropSettings);
    if (categoryLogoInputRef.current) categoryLogoInputRef.current.value = '';
    setCategoryMessage(`Editando ${category.categoria}. Si no cargás un nuevo logo, se conserva el actual.`);
  };

  const handleEditChampionship = championship => {
    setEditingChampionshipId(championship.id);
    setChampionshipForm({
      idcategoria: championship.idcategoria || '',
      temporada: championship.temporada || '',
      anio: championship.anio || new Date().getFullYear(),
      plataforma: championship.plataforma || '',
      puerto: championship.puerto ?? '',
      n_server: championship.n_server ?? '',
      servidor: championship.servidor || '',
    });
    setChampionshipRulesFile(null);
    if (championshipRulesInputRef.current) championshipRulesInputRef.current.value = '';
    setChampionshipMessage(`Editando ${championship.categoria} T${championship.temporada}. Si no cargás un nuevo PDF, se conserva el actual.`);
  };

  const handleDeleteRegistration = async registration => {
    const confirmed = window.confirm(`¿Eliminar la inscripción de ${registration.nombre}?`);
    if (!confirmed) return;

    try {
      await registrationsApi.remove(registration.idcampeonato, registration.idpiloto);
      setRegistrations(current => current.filter(item => !(
        String(item.idcampeonato) === String(registration.idcampeonato)
        && String(item.idpiloto) === String(registration.idpiloto)
      )));
      if (String(selectedRegistrationDriverId) === String(registration.idpiloto)) {
        setSelectedRegistrationDriverId(null);
        setRegistrationDriverDetails(emptyDriverForm);
        setRegistrationDriverDetailsMessage('');
      }
      setRegistrationMessage('Inscripción eliminada.');
    } catch (err) {
      setRegistrationMessage(err.response?.data?.error || 'No se pudo eliminar la inscripción.');
    }
  };

  const handleEditCarBrand = brand => {
    setEditingCarBrandId(brand.id);
    setCarBrandForm({ marca: brand.marca || '' });
    setCarBrandLogoFile(null);
    setCarBrandLogoCrop(defaultCropSettings);
    if (carBrandLogoInputRef.current) carBrandLogoInputRef.current.value = '';
    setCarBrandMessage(`Editando ${brand.marca}. Si no cargás otro logo, se conserva el actual.`);
  };

  const handleEditCar = car => {
    setEditingCarId(car.id);
    setCarForm({
      idcategoria: car.idcategoria || '',
      marca: car.idmarca || '',
      modelo: car.modelo || '',
    });
    setCarImageFile(null);
    if (carImageInputRef.current) carImageInputRef.current.value = '';
    setCarMessage(`Editando ${car.marca} ${car.modelo}. Si no cargás nuevas imágenes, se conservan las actuales.`);
  };

  const handleEditEvent = event => {
    setEditingEventKey({ idcampeonato: event.idcampeonato, ronda: event.ronda });
    setEventForm({
      idcampeonato: event.idcampeonato || '',
      fecha: toDateTimeInputValue(event.fecha),
      ronda: event.ronda || '',
      idcircuito: event.idcircuito || '',
      especial: Boolean(event.especial),
      especialidad: event.especialidad || '',
      coronacion: Boolean(event.coronacion),
      transmision: event.transmision || '',
    });
    setEventMessage('');
  };

  const handleEditDriver = driver => {
    setEditingDriverId(driver.id);
    setLockedDriverLocality(false);
    setDriverForm({
      nombre: driver.nombre || '',
      localidad: driver.localidad || '',
      provincia: driver.provincia || '',
      telefono: String(driver.telefono || '').replace(/\D/g, ''),
      nacionalidad: normalizeCountryCode(driver.nacionalidad) || 'ar',
      steam: driver.steam || '',
      ig: formatInstagramHandle(driver.ig),
    });
    setDriverMessage(`Editando ${driver.nombre}.`);
  };

  const replayEvents = events
    .filter(event => String(event.idcampeonato) === String(replayForm.idcampeonato))
    .sort((a, b) => Number(a.ronda) - Number(b.ronda));

  const handleReplayChampionshipChange = event => {
    const idcampeonato = event.target.value;
    const firstRound = events
      .filter(item => String(item.idcampeonato) === String(idcampeonato))
      .sort((a, b) => Number(a.ronda) - Number(b.ronda))[0]?.ronda;
    setReplayForm(current => ({ ...current, idcampeonato, ronda: firstRound ? String(firstRound) : '' }));
    setReplayMessage('');
  };

  const uploadReplay = async event => {
    event.preventDefault();
    if (!replayFile || !replayForm.idcampeonato || !replayForm.ronda || !replayForm.tanda.trim()) return;
    setSavingReplay(true);
    setReplayUploadProgress(0);
    setReplayMessage('');
    try {
      const data = new FormData();
      data.append('idcampeonato', replayForm.idcampeonato);
      data.append('ronda', replayForm.ronda);
      data.append('tanda', replayForm.tanda.trim());
      data.append('replay', replayFile);
      const response = await replaysApi.upload(data, progressEvent => {
        const ratio = progressEvent.progress
          ?? (progressEvent.total ? progressEvent.loaded / progressEvent.total : 0);
        setReplayUploadProgress(Math.min(100, Math.max(0, Math.round(ratio * 100))));
      });
      const refreshed = await replaysApi.getAll();
      setReplays(refreshed.data.data || []);
      setReplayFile(null);
      if (replayInputRef.current) replayInputRef.current.value = '';
      setReplayMessage(response.data.message || 'Repetición publicada correctamente.');
    } catch (error) {
      setReplayMessage(error.response?.data?.error || 'No se pudo publicar la repetición.');
    } finally {
      setSavingReplay(false);
    }
  };

  const deleteReplay = async replay => {
    if (!window.confirm(`¿Eliminar la repetición de Fecha ${replay.ronda} · ${replay.tanda}?`)) return;
    setReplayMessage('');
    try {
      const response = await replaysApi.remove(replay.id);
      setReplays(current => current.filter(item => item.id !== replay.id));
      setReplayMessage(response.data.message || 'Repetición eliminada correctamente.');
    } catch (error) {
      setReplayMessage(error.response?.data?.error || 'No se pudo eliminar la repetición.');
    }
  };

  const uploadTemplate = async event => {
    event.preventDefault();
    if (!templateFile || !templateChampionshipId) return;
    setSavingTemplate(true);
    setTemplateUploadProgress(0);
    setTemplateMessage('');
    try {
      const data = new FormData();
      data.append('idcampeonato', templateChampionshipId);
      data.append('plantilla', templateFile);
      const response = await templatesApi.upload(data, progressEvent => {
        const ratio = progressEvent.progress
          ?? (progressEvent.total ? progressEvent.loaded / progressEvent.total : 0);
        setTemplateUploadProgress(Math.min(100, Math.max(0, Math.round(ratio * 100))));
      });
      const refreshed = await templatesApi.getAll();
      setTemplates(refreshed.data.data || []);
      setTemplateFile(null);
      if (templateInputRef.current) templateInputRef.current.value = '';
      setTemplateMessage(response.data.message || 'Plantilla publicada correctamente.');
    } catch (error) {
      setTemplateMessage(error.response?.data?.error || 'No se pudo publicar la plantilla.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async template => {
    if (!window.confirm(`¿Eliminar la plantilla de ${template.categoria} · Temporada ${template.temporada}?`)) return;
    setTemplateMessage('');
    try {
      const response = await templatesApi.remove(template.id);
      setTemplates(current => current.filter(item => item.id !== template.id));
      setTemplateMessage(response.data.message || 'Plantilla eliminada correctamente.');
    } catch (error) {
      setTemplateMessage(error.response?.data?.error || 'No se pudo eliminar la plantilla.');
    }
  };

  const renderSection = () => {
    if (activeSection === 'plantillas') {
      const existingTemplate = templates.find(item => String(item.idcampeonato) === String(templateChampionshipId));
      return (
        <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
          <section className="card-glass self-start p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Archivos descargables</p>
            <h2 className="mt-2 font-racing text-2xl font-bold">Publicar plantilla</h2>
            <p className="mt-2 text-sm text-gray-400">Subí un archivo ZIP para el campeonato. Solo puede haber una plantilla activa por campeonato.</p>
            <form onSubmit={uploadTemplate} className="mt-6 space-y-4">
              <label className="block"><span className="text-sm text-gray-300">Campeonato</span><select value={templateChampionshipId} onChange={event => { setTemplateChampionshipId(event.target.value); setTemplateMessage(''); }} className="input-field mt-2" required><option value="">Seleccionar campeonato</option>{championships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label>
              {existingTemplate ? <p className="border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs text-yellow-200">Este campeonato ya tiene una plantilla. Al publicar el nuevo ZIP se reemplazará el archivo actual.</p> : null}
              <label className="block"><span className="text-sm text-gray-300">Archivo ZIP</span><span className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center border border-dashed border-racing-border bg-black/25 px-4 text-center transition hover:border-cyan-300"><ArrowUpTrayIcon className="h-7 w-7 text-cyan-300"/><span className="mt-2 break-all text-sm text-gray-300">{templateFile?.name || 'Seleccionar plantilla'}</span><span className="mt-1 text-[10px] uppercase text-gray-600">Formato ZIP</span></span><input ref={templateInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={event => setTemplateFile(event.target.files?.[0] || null)} className="sr-only" required/></label>
              <button type="submit" disabled={savingTemplate || !templateFile || !templateChampionshipId} className="inline-flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-racing text-sm font-bold uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{savingTemplate ? 'Subiendo plantilla...' : existingTemplate ? 'Reemplazar plantilla' : 'Publicar plantilla'}</button>
              {templateMessage ? <p className="border border-racing-border bg-black/25 p-3 text-sm text-gray-300">{templateMessage}</p> : null}
            </form>
          </section>

          {savingTemplate ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 px-5 backdrop-blur-md" role="status" aria-live="polite" aria-label="Subiendo plantilla">
            <div className="w-full max-w-xl border border-cyan-300/50 bg-racing-dark p-7 shadow-[0_0_60px_rgba(34,211,238,0.2)] sm:p-10">
              <div className="flex items-center gap-4"><div className="relative h-14 w-14 shrink-0"><div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"/><ArchiveBoxIcon className="absolute inset-0 m-auto h-6 w-6 text-cyan-300"/></div><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">No cierres esta pantalla</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">{templateUploadProgress >= 100 ? 'Procesando plantilla…' : 'Subiendo plantilla…'}</h2></div></div>
              <div className="mt-7 h-3 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${templateUploadProgress}%` }}/></div>
              <div className="mt-3 flex items-center justify-between gap-4"><p className="truncate text-xs text-gray-500">{templateFile?.name}</p><strong className="font-racing text-2xl text-white">{templateUploadProgress}%</strong></div>
            </div>
          </div> : null}

          <section className="card-glass overflow-hidden">
            <header className="border-b border-racing-border bg-racing-gray px-6 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Biblioteca</p><h2 className="mt-1 font-racing text-2xl font-bold">Plantillas publicadas</h2></header>
            <div className="divide-y divide-racing-border">{templates.map(template => <article key={template.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3">{template.categoria_logo ? <img src={template.categoria_logo} alt="" className="h-12 w-14 shrink-0 object-contain"/> : <ArchiveBoxIcon className="h-9 w-9 shrink-0 text-cyan-300"/>}<div className="min-w-0"><p className="truncate text-xs font-bold uppercase text-cyan-300">{template.categoria}</p><h3 className="truncate font-racing text-lg font-bold text-white">Temporada {template.temporada} · {template.anio}</h3><p className="truncate text-xs text-gray-500">{template.nombre_original}</p></div></div><div className="flex shrink-0 gap-2"><a href={`/api/templates/${template.id}/download`} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-300 hover:border-cyan-300 hover:text-cyan-300" aria-label="Descargar plantilla"><ArrowDownTrayIcon className="h-5 w-5"/></a><button type="button" onClick={() => deleteTemplate(template)} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar plantilla"><TrashIcon className="h-5 w-5"/></button></div></article>)}{!templates.length ? <div className="py-20 text-center text-gray-500"><ArchiveBoxIcon className="mx-auto h-12 w-12"/><p className="mt-3">Todavía no hay plantillas publicadas.</p></div> : null}</div>
          </section>
        </div>
      );
    }

    if (activeSection === 'replays') {
      return (
        <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
          <section className="card-glass self-start p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Archivos descargables</p>
            <h2 className="mt-2 font-racing text-2xl font-bold">Publicar repetición</h2>
            <p className="mt-2 text-sm text-gray-400">Relacioná el archivo con un campeonato, una fecha y la tanda correspondiente.</p>
            <form onSubmit={uploadReplay} className="mt-6 space-y-4">
              <label className="block"><span className="text-sm text-gray-300">Campeonato</span><select value={replayForm.idcampeonato} onChange={handleReplayChampionshipChange} className="input-field mt-2" required><option value="">Seleccionar campeonato</option>{championships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label>
              <label className="block"><span className="text-sm text-gray-300">Fecha</span><select value={replayForm.ronda} onChange={event => setReplayForm(current => ({ ...current, ronda: event.target.value }))} className="input-field mt-2" required disabled={!replayForm.idcampeonato}><option value="">Seleccionar fecha</option>{replayEvents.map(item => <option key={item.id} value={item.ronda}>Fecha {item.ronda} · {item.circuito}</option>)}</select></label>
              <label className="block"><span className="text-sm text-gray-300">Tanda</span><select value={replayForm.tanda} onChange={event => setReplayForm(current => ({ ...current, tanda: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar tanda</option>{replaySessionOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="block"><span className="text-sm text-gray-300">Archivo de la repetición</span><span className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center border border-dashed border-racing-border bg-black/25 px-4 text-center hover:border-racing-red"><ArrowUpTrayIcon className="h-7 w-7 text-racing-red"/><span className="mt-2 break-all text-sm text-gray-300">{replayFile?.name || 'Seleccionar repetición'}</span><span className="mt-1 text-[10px] uppercase text-gray-600">VCR, RPL, REPLAY, ACREPLAY, ZIP, RAR o 7Z</span></span><input ref={replayInputRef} type="file" accept=".vcr,.rpl,.replay,.acreplay,.zip,.rar,.7z" onChange={event => setReplayFile(event.target.files?.[0] || null)} className="sr-only" required/></label>
              <button type="submit" disabled={savingReplay || !replayFile} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{savingReplay ? 'Subiendo repetición...' : 'Publicar repetición'}</button>
              {replayMessage ? <p className="border border-racing-border bg-black/25 p-3 text-sm text-gray-300">{replayMessage}</p> : null}
            </form>
          </section>

          {savingReplay ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 px-5 backdrop-blur-md" role="status" aria-live="polite" aria-label="Subiendo repetición">
            <div className="w-full max-w-xl border border-racing-red/50 bg-racing-dark p-7 shadow-[0_0_60px_rgba(220,38,38,0.22)] sm:p-10">
              <div className="flex items-center gap-4"><div className="relative h-14 w-14 shrink-0"><div className="absolute inset-0 animate-spin rounded-full border-2 border-racing-red/20 border-t-racing-red"/><ArrowUpTrayIcon className="absolute inset-0 m-auto h-6 w-6 text-racing-red"/></div><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-racing-red">No cierres esta pantalla</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">{replayUploadProgress >= 100 ? 'Procesando repetición…' : 'Subiendo repetición…'}</h2></div></div>
              <div className="mt-7 h-3 overflow-hidden bg-white/10"><div className="h-full bg-racing-red transition-[width] duration-300" style={{ width: `${replayUploadProgress}%` }}/></div>
              <div className="mt-3 flex items-center justify-between gap-4"><p className="truncate text-xs text-gray-500">{replayFile?.name}</p><strong className="font-racing text-2xl text-white">{replayUploadProgress}%</strong></div>
            </div>
          </div> : null}

          <section className="card-glass overflow-hidden">
            <header className="border-b border-racing-border bg-racing-gray px-6 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Biblioteca</p><h2 className="mt-1 font-racing text-2xl font-bold">Repeticiones publicadas</h2></header>
            <div className="divide-y divide-racing-border">{replays.map(replay => <article key={replay.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3">{replay.categoria_logo ? <img src={replay.categoria_logo} alt="" className="h-10 w-12 shrink-0 object-contain"/> : <TrophyIcon className="h-8 w-8 shrink-0 text-racing-red"/>}<div className="min-w-0"><p className="truncate text-xs font-bold uppercase text-racing-red">{replay.categoria} · T{replay.temporada}</p><h3 className="truncate font-racing text-lg font-bold text-white">Fecha {replay.ronda} · {replay.tanda}</h3><p className="truncate text-xs text-gray-500">{replay.circuito || 'Circuito'} · {replay.nombre_original}</p></div></div><div className="flex shrink-0 gap-2"><a href={`/api/replays/${replay.id}/download`} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-300 hover:border-green-400 hover:text-green-400" aria-label="Descargar repetición"><ArrowDownTrayIcon className="h-5 w-5"/></a><button type="button" onClick={() => deleteReplay(replay)} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar repetición"><TrashIcon className="h-5 w-5"/></button></div></article>)}{!replays.length ? <div className="py-20 text-center text-gray-500"><ArrowDownTrayIcon className="mx-auto h-12 w-12"/><p className="mt-3">Todavía no hay repeticiones publicadas.</p></div> : null}</div>
          </section>
        </div>
      );
    }

    if (activeSection === 'formularios') {
      const championship = championships.find(item => String(item.id) === String(registrationConfigChampionshipId));
      const categoryCars = cars.filter(car => championship && String(car.idcategoria) === String(championship.idcategoria));
      const editingRegistrationConfig = registrationConfigs.find(item => String(item.idcampeonato) === String(registrationConfigChampionshipId));
      const enabledOfficialCars = categoryCars.filter(car => registrationConfig.autos_habilitados.includes(Number(car.id)));
      const officialCarBrands = [...new Map(enabledOfficialCars.map(car => [String(car.idmarca), {
        id: String(car.idmarca),
        marca: car.marca,
        logo: car.logo,
      }])).values()].sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es-AR', { sensitivity: 'base' }));
      const officialCarModels = enabledOfficialCars
        .filter(car => String(car.idmarca) === String(officialCarForm.idmarca))
        .sort((a, b) => String(a.modelo).localeCompare(String(b.modelo), 'es-AR', { sensitivity: 'base' }));
      const officialCarGroups = [...officialCars.reduce((groups, car) => {
        const modelId = String(car.idauto || `${car.marca}-${car.modelo}` || 'sin-modelo');
        if (!groups.has(modelId)) groups.set(modelId, { id: modelId, marca: car.marca || 'Sin marca', modelo: car.modelo || 'Sin modelo', logo: car.logo, cars: [] });
        groups.get(modelId).cars.push(car);
        return groups;
      }, new Map()).values()].sort((a, b) => String(`${a.marca} ${a.modelo}`).localeCompare(String(`${b.marca} ${b.modelo}`), 'es-AR', { sensitivity: 'base' }));
      return (
        <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
          <section className="card-glass p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Inscripciones públicas</p>
            <h2 className="mt-2 font-racing text-2xl font-bold">Gestión de formularios</h2>
            <p className="mt-2 text-sm text-gray-400">Creá uno para un campeonato sin configurar o elegí uno guardado para modificarlo.</p>
            <label className="mt-6 block"><span className="text-sm font-semibold text-gray-300">Agregar formulario</span><select value={editingRegistrationConfig ? '' : registrationConfigChampionshipId} onChange={event => selectRegistrationConfigChampionship(event.target.value)} className="input-field mt-2"><option value="">Seleccionar campeonato sin formulario</option>{championships.filter(item => !registrationConfigs.some(config => String(config.idcampeonato) === String(item.id))).map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-semibold text-gray-300">Formularios guardados</p>
              {registrationConfigs.map(item => <div key={item.idcampeonato} className={`flex items-center gap-2 border p-2 ${String(item.idcampeonato) === String(registrationConfigChampionshipId) ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><button type="button" onClick={() => selectRegistrationConfigChampionship(String(item.idcampeonato))} className="min-w-0 flex-1 px-2 py-1 text-left"><div className="flex items-center justify-between gap-3"><span className="truncate font-semibold">{item.categoria} · T{item.temporada}</span><span className={`text-xs font-bold uppercase ${item.phase === 'open' ? 'text-green-400' : item.phase === 'full' ? 'text-yellow-300' : 'text-gray-500'}`}>{item.phase === 'open' ? 'Abierto' : item.phase === 'upcoming' ? 'Próximo' : item.phase === 'full' ? 'Completo' : 'Cerrado'}</span></div><p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-400">Pilotos:</span> Manuales {Number(item.preinscriptos || 0)} · Reales {Number(item.inscriptos_actuales || 0)} · Límite {Number(item.limite_inscriptos || 0)}</p></button><button type="button" onClick={() => deleteRegistrationConfig(item.idcampeonato)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar formulario"><TrashIcon className="h-4 w-4"/></button></div>)}
              {!registrationConfigs.length ? <p className="border border-dashed border-racing-border p-4 text-center text-sm text-gray-500">Todavía no hay formularios guardados.</p> : null}
            </div>
          </section>

          <section className="card-glass p-6">
            {!championship ? <div className="py-20 text-center text-gray-500"><ClipboardDocumentListIcon className="mx-auto h-12 w-12"/><p className="mt-3">Seleccioná un campeonato para configurar su formulario.</p></div> : <form onSubmit={saveRegistrationConfig} className="space-y-6">
              <div><p className="text-xs font-semibold uppercase text-racing-red">{editingRegistrationConfig ? 'Modificar formulario' : 'Nuevo formulario'}</p><h2 className="mt-1 font-racing text-3xl font-bold">{championship.categoria}</h2><p className="text-gray-400">Temporada {championship.temporada} · {championship.anio}</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label><span className="text-sm text-gray-300">Apertura automática</span><input name="fecha_apertura" type="datetime-local" value={registrationConfig.fecha_apertura} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Cierre automático</span><input name="fecha_cierre" type="datetime-local" value={registrationConfig.fecha_cierre} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Precio base</span><input name="precio" type="number" min="0" step="0.01" value={registrationConfig.precio} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/><small className="mt-1 block text-gray-500">A este importe se suma el valor de cada plan.</small></label>
                <label><span className="text-sm text-gray-300">Límite total</span><input name="limite_inscriptos" type="number" min="1" max="65535" value={registrationConfig.limite_inscriptos} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <div><span className="text-sm text-gray-300">Límite automático por modelo</span><div className="input-field mt-2 flex items-center font-racing text-2xl font-bold text-white">{registrationConfig.autos_habilitados.length ? Math.ceil(Number(registrationConfig.limite_inscriptos || 0) / registrationConfig.autos_habilitados.length) : 0}</div><small className="mt-1 block text-gray-500">Se recalcula con el límite total y los modelos habilitados. Las pinturas oficiales no consumen este cupo.</small></div>
                <label><span className="text-sm text-gray-300">Inscriptos manuales</span><input name="preinscriptos" type="number" min="0" max={registrationConfig.limite_inscriptos || 0} value={registrationConfig.preinscriptos} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/><small className="mt-1 block text-gray-500">Sirve para ajustar el contador público. Antes de abrir se muestra como preinscriptos y, al abrir, se suma visualmente a los reales sin ocupar cupos.</small></label>
                <div className="border border-racing-border bg-racing-dark p-4 md:col-span-2"><span className="text-sm text-gray-400">Distribución automática</span><p className="mt-1 font-racing text-2xl font-bold">{registrationConfig.autos_habilitados.length ? Math.ceil(Number(registrationConfig.limite_inscriptos || 0) / registrationConfig.autos_habilitados.length) : 0} por modelo</p><p className="mt-1 text-xs text-gray-500">{registrationConfig.autos_habilitados.length} modelos habilitados · pinturas oficiales excluidas · el límite general de {registrationConfig.limite_inscriptos || 0} siempre tiene prioridad</p></div>
              </div>
              <label className="block"><span className="text-sm text-gray-300">Setup</span><textarea name="setup_detalle" value={registrationConfig.setup_detalle} onChange={handleRegistrationConfigChange} className="input-field mt-2 min-h-28 resize-y" placeholder="Ej.: Setup provisto por la liga, relaciones libres, combustible libre..." required/></label>
              <section className="overflow-hidden border border-yellow-400/25 bg-yellow-400/5">
                <button type="button" onClick={() => setRegistrationFormCollapsed(current => ({ ...current, backgrounds: !current.backgrounds }))} className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-yellow-400/[0.06]" aria-expanded={!registrationFormCollapsed.backgrounds}>
                  <span className="flex min-w-0 items-center gap-3"><PhotoIcon className="h-6 w-6 shrink-0 text-yellow-300"/><span><span className="block font-racing text-xl font-bold text-white">Fondos del campeonato</span><span className="block text-xs text-gray-500">Estas fotos se muestran aleatoriamente en el Inicio.</span></span></span>
                  <span className="flex shrink-0 items-center gap-3"><span className="text-xs font-bold uppercase text-gray-500">{registrationGallery.length} foto{registrationGallery.length === 1 ? '' : 's'}</span><ChevronDownIcon className={`h-5 w-5 text-yellow-300 transition-transform duration-500 ${registrationFormCollapsed.backgrounds ? '-rotate-90' : ''}`}/></span>
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${registrationFormCollapsed.backgrounds ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden"><div className="border-t border-yellow-400/20 p-5">
                  {!editingRegistrationConfig ? <p className="border border-dashed border-racing-border p-4 text-center text-sm text-gray-400">Primero creá el formulario. Después podrás cargar sus fotos.</p> : <>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label><span className="text-sm text-gray-300">Seleccionar fotos</span><input ref={registrationImagesInputRef} type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setRegistrationImageFiles(Array.from(event.target.files || []).slice(0, 10))} className="input-field mt-2 file:mr-4 file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-semibold file:text-black"/><small className="mt-1 block text-gray-500">Hasta 10 fotos por carga, 8 MB cada una.</small></label><button type="button" onClick={uploadRegistrationGallery} disabled={!registrationImageFiles.length || savingRegistrationImages} className="inline-flex min-h-12 items-center justify-center gap-2 border border-yellow-300 bg-yellow-400 px-5 font-racing text-sm font-bold uppercase text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"><PhotoIcon className="h-5 w-5"/>{savingRegistrationImages ? 'Subiendo...' : `Subir ${registrationImageFiles.length || ''} foto${registrationImageFiles.length === 1 ? '' : 's'}`}</button></div>
                    {registrationGalleryPath ? <p className="mt-3 break-all text-xs text-gray-600">Carpeta: {registrationGalleryPath}</p> : null}
                    {registrationGalleryMessage ? <p className="mt-3 text-sm text-yellow-200">{registrationGalleryMessage}</p> : null}
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">{registrationGallery.map(image => <article key={image.filename} className="group relative aspect-video overflow-hidden border border-racing-border bg-black"><img src={image.url} alt="Fondo del campeonato" className="h-full w-full object-cover"/><button type="button" onClick={() => deleteRegistrationGalleryImage(image)} className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center bg-black/80 text-gray-300 opacity-100 transition hover:bg-racing-red hover:text-white md:opacity-0 md:group-hover:opacity-100" aria-label="Eliminar foto"><TrashIcon className="h-4 w-4"/></button></article>)}{!registrationGallery.length ? <div className="col-span-full border border-dashed border-racing-border py-8 text-center text-sm text-gray-500">Todavía no hay fotos cargadas.</div> : null}</div>
                  </>}
                </div></div></div>
              </section>
              <section className="border border-yellow-400/30 bg-yellow-400/[0.04] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-yellow-400 text-black"><TrophyIcon className="h-5 w-5"/></span><div><p className="font-racing text-xl font-bold uppercase text-white">Premios del campeonato</p><p className="mt-1 text-xs text-gray-500">Definí las posiciones premiadas de este formulario y marcá todos los premios que correspondan.</p></div></div><button type="button" onClick={addChampionshipPrize} className="border border-yellow-400/50 bg-yellow-400/10 px-4 py-2.5 text-xs font-bold uppercase text-yellow-300 transition hover:bg-yellow-400 hover:text-black">Agregar posición</button></div>
                {loadingChampionshipPrizes ? <p className="py-10 text-center text-sm text-gray-500">Cargando premios...</p> : <div className="mt-5 space-y-3">{championshipPrizes.map((prize, index) => <article key={index} className="grid gap-4 border border-racing-border bg-black/25 p-4 lg:grid-cols-[110px_1fr_auto] lg:items-center">
                  <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Posición</span><input type="number" min="1" max="127" value={prize.posicion} onChange={event => updateChampionshipPrize(index, 'posicion', event.target.value)} className="input-field mt-1 text-center font-racing text-xl text-yellow-300"/></label>
                  <div className="grid gap-2 sm:grid-cols-3"><label className={`flex cursor-pointer items-center gap-2 border px-3 py-3 text-xs font-bold uppercase ${prize.efectivo ? 'border-green-400/50 bg-green-500/10 text-green-300' : 'border-racing-border text-gray-500'}`}><input type="checkbox" checked={prize.efectivo} onChange={event => updateChampionshipPrize(index, 'efectivo', event.target.checked)} className="h-4 w-4 accent-green-500"/>Dinero en efectivo</label><label className={`flex cursor-pointer items-center gap-2 border px-3 py-3 text-xs font-bold uppercase ${prize.inscripcion ? 'border-violet-400/50 bg-violet-500/10 text-violet-300' : 'border-racing-border text-gray-500'}`}><input type="checkbox" checked={prize.inscripcion} onChange={event => updateChampionshipPrize(index, 'inscripcion', event.target.checked)} className="h-4 w-4 accent-violet-500"/>Inscripción</label><label className={`flex cursor-pointer items-center gap-2 border px-3 py-3 text-xs font-bold uppercase ${prize.trofeo ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300' : 'border-racing-border text-gray-500'}`}><input type="checkbox" checked={prize.trofeo} onChange={event => updateChampionshipPrize(index, 'trofeo', event.target.checked)} className="h-4 w-4 accent-yellow-400"/>Trofeo</label></div>
                  <button type="button" onClick={() => removeChampionshipPrize(index)} className="inline-flex h-11 w-full items-center justify-center border border-racing-border text-gray-500 transition hover:border-racing-red hover:text-racing-red lg:w-11" aria-label={`Eliminar premio de la posición ${prize.posicion}`}><TrashIcon className="h-5 w-5"/></button>
                </article>)}</div>}
                {!loadingChampionshipPrizes && !championshipPrizes.length ? <p className="mt-5 border border-dashed border-racing-border py-8 text-center text-sm text-gray-500">Todavía no cargaste premios para este campeonato.</p> : null}
                {championshipPrizesMessage ? <p className="mt-4 border border-yellow-400/20 bg-yellow-400/[0.05] p-3 text-sm text-yellow-200">{championshipPrizesMessage}</p> : null}
                <button type="button" onClick={saveChampionshipPrizes} disabled={loadingChampionshipPrizes || savingChampionshipPrizes} className="mt-5 w-full bg-yellow-400 px-5 py-3 text-xs font-bold uppercase text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40">{savingChampionshipPrizes ? 'Guardando premios...' : 'Guardar premios'}</button>
              </section>
              <section className="overflow-hidden border border-racing-border bg-black/20">
                <button type="button" onClick={() => setRegistrationFormCollapsed(current => ({ ...current, enabledCars: !current.enabledCars }))} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.04] sm:p-5" aria-expanded={!registrationFormCollapsed.enabledCars}>
                  <span><span className="block font-racing text-xl font-bold text-white">Autos habilitados</span><span className="mt-1 block text-xs text-gray-500">Seleccioná los modelos disponibles para este formulario.</span></span>
                  <span className="flex shrink-0 items-center gap-3"><span className="text-xs font-bold uppercase text-gray-500">{registrationConfig.autos_habilitados.length}/{categoryCars.length}</span><ChevronDownIcon className={`h-5 w-5 text-racing-red transition-transform duration-500 ${registrationFormCollapsed.enabledCars ? '-rotate-90' : ''}`}/></span>
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${registrationFormCollapsed.enabledCars ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden"><div className="grid gap-2 border-t border-racing-border p-4 md:grid-cols-3 sm:p-5">{categoryCars.map(car => <label key={car.id} className={`flex cursor-pointer items-center gap-3 border p-3 ${registrationConfig.autos_habilitados.includes(Number(car.id)) ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><input type="checkbox" checked={registrationConfig.autos_habilitados.includes(Number(car.id))} onChange={() => toggleRegistrationCar(car.id)} className="h-4 w-4 accent-racing-red"/><span>{car.marca} {car.modelo}</span></label>)}{!categoryCars.length ? <p className="text-sm text-yellow-300 md:col-span-3">La categoría no tiene autos cargados.</p> : null}</div></div></div>
              </section>
              <section className="border border-racing-border bg-black/20 p-4 sm:p-5">
                <div><p className="text-sm font-semibold text-gray-200">Secciones de inscripción</p><p className="mt-1 text-xs text-gray-500">Las cuatro secciones son fijas. Activá las que estarán disponibles y personalizá sus datos.</p></div>
                <div className="mt-5 space-y-4">
                  {registrationConfig.planes.map((plan, index) => <article key={plan.id} className="border border-racing-border bg-racing-dark p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="font-racing text-lg font-bold text-white">{index + 1}. {plan.id === 'extra' ? 'Extra sin diseño' : plan.id === 'personalizado' ? 'Personalizado' : plan.id === 'diseno_liga' ? 'Diseño de la liga' : 'Diseño oficial'}</span><p className="mt-1 text-xs text-gray-500">{plan.tipo === 'sin_numero' ? 'Finaliza con número 0' : plan.tipo === 'pintura_oficial' ? 'Solicita número y usa autos seleccionados' : 'Solicita número del auto'}</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider"><input type="checkbox" checked={plan.habilitado} onChange={event => updateRegistrationPlan(plan.id, 'habilitado', event.target.checked)} className="h-4 w-4 accent-green-500"/><span className={plan.habilitado ? 'text-green-400' : 'text-gray-500'}>{plan.habilitado ? 'Habilitado' : 'Deshabilitado'}</span></label></div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Título</span><input value={plan.titulo} onChange={event => updateRegistrationPlan(plan.id, 'titulo', event.target.value)} className="input-field mt-2" placeholder="Ej.: Pintura oficial 2026" required/></label>
                      {plan.id === 'diseno_liga' || plan.id === 'diseno_oficial' ? <label><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Valor adicional</span><input type="number" min="0" step="0.01" value={plan.precio_adicional} onChange={event => updateRegistrationPlan(plan.id, 'precio_adicional', event.target.value)} className="input-field mt-2" required/><small className="mt-1 block text-gray-600">Se suma al precio base del campeonato.</small></label> : <div className="border border-racing-border bg-black/20 p-3"><span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Precio</span><p className="mt-2 text-sm text-gray-300">Usa solamente el precio base, sin adicional.</p></div>}
                      <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Descripción</span><textarea value={plan.descripcion} onChange={event => updateRegistrationPlan(plan.id, 'descripcion', event.target.value)} className="input-field mt-2 min-h-20 resize-y" placeholder="Explicá qué incluye este plan" required/></label>
                    </div>
                    {plan.id === 'diseno_oficial' ? <div className="mt-4 border-t border-racing-border pt-4 text-sm text-yellow-200">Los autos, números, fotos y descripciones oficiales se administran en el catálogo que aparece debajo.</div> : null}
                  </article>)}
                </div>
              </section>
              {editingRegistrationConfig ? <section className="border border-yellow-400/30 bg-yellow-400/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-racing text-xl font-bold text-white">Catálogo de diseños oficiales</p><p className="mt-1 text-xs text-gray-500">Cargá cada auto por modelo con su número, foto y descripción.</p></div><span className="border border-yellow-300/40 px-3 py-1 text-xs font-bold uppercase text-yellow-300">{officialCars.length} cargado{officialCars.length === 1 ? '' : 's'}</span></div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Marca</span><select value={officialCarForm.idmarca} onChange={event => setOfficialCarForm(current => ({ ...current, idmarca: event.target.value, idauto: '' }))} className="input-field mt-2"><option value="">Seleccionar marca</option>{officialCarBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.marca}</option>)}</select></label>
                  <label><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Modelo</span><select value={officialCarForm.idauto} onChange={event => setOfficialCarForm(current => ({ ...current, idauto: event.target.value }))} className="input-field mt-2" disabled={!officialCarForm.idmarca}><option value="">{officialCarForm.idmarca ? 'Seleccionar modelo' : 'Primero seleccioná una marca'}</option>{officialCarModels.map(car => <option key={car.id} value={car.id}>{car.modelo}</option>)}</select></label>
                  <label><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Número</span><input type="number" min="1" max="255" step="1" value={officialCarForm.numero} onChange={event => setOfficialCarForm(current => ({ ...current, numero: event.target.value }))} className="input-field mt-2" placeholder="Ej.: 24"/></label>
                  <label className="md:col-span-3"><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Descripción</span><textarea value={officialCarForm.descripcion} onChange={event => setOfficialCarForm(current => ({ ...current, descripcion: event.target.value }))} onBlur={() => setOfficialCarForm(current => ({ ...current, descripcion: capitalizeValue(current.descripcion) }))} className="input-field mt-2 min-h-20 resize-y" placeholder="Ej.: Chevrolet Cruze Rojo Con Detalles Negros"/></label>
                  <label className="md:col-span-3"><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Foto {officialCarForm.id ? <span className="normal-case text-gray-600">(opcional al modificar)</span> : null}</span><input ref={officialCarPhotoInputRef} type="file" accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setOfficialCarForm(current => ({ ...current, foto: event.target.files?.[0] || null }))} className="input-field mt-2 file:mr-4 file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-semibold file:text-black"/></label>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">{officialCarForm.id ? <button type="button" onClick={resetOfficialCarForm} className="border border-racing-border px-4 py-3 text-xs font-bold uppercase text-gray-400 hover:text-white">Cancelar edición</button> : null}<button type="button" onClick={saveOfficialCar} disabled={savingOfficialCar || !officialCarForm.idauto || !officialCarForm.numero || !officialCarForm.descripcion || (!officialCarForm.id && !officialCarForm.foto)} className="inline-flex justify-center bg-yellow-400 px-5 py-3 text-xs font-bold uppercase text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40">{savingOfficialCar ? 'Guardando...' : officialCarForm.id ? 'Guardar cambios' : 'Agregar auto oficial'}</button></div>
                {officialCarsMessage ? <p className="mt-4 text-sm text-yellow-200">{officialCarsMessage}</p> : null}
                <div className="mt-5 space-y-2">{officialCarGroups.map(group => {
                  const groupKey = `model:${group.id}`;
                  const collapsed = officialCarCollapsedBrands[groupKey] !== false;
                  return <section key={group.id} className="overflow-hidden border border-racing-border bg-black/20">
                    <button type="button" onClick={() => setOfficialCarCollapsedBrands(current => ({ ...current, [groupKey]: current[groupKey] === false }))} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-yellow-400/5" aria-expanded={!collapsed}>
                      <span className="flex min-w-0 items-center gap-3">{group.logo ? <img src={group.logo} alt="" className="h-9 w-12 shrink-0 object-contain"/> : null}<span className="truncate font-racing text-lg font-bold uppercase text-white">{group.marca} {group.modelo}</span><span className="shrink-0 text-xs font-semibold uppercase text-gray-500">{group.cars.length} auto{group.cars.length === 1 ? '' : 's'}</span></span>
                      <ChevronDownIcon className={`h-5 w-5 shrink-0 text-yellow-300 transition-transform duration-500 ${collapsed ? '-rotate-90' : ''}`}/>
                    </button>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden"><div className="grid gap-4 border-t border-racing-border p-4 sm:grid-cols-2 xl:grid-cols-3">{group.cars.map(car => <article key={car.id} className="overflow-hidden border border-racing-border bg-racing-dark"><div className="relative aspect-video bg-black"><img src={car.foto} alt={`${car.marca} ${car.modelo} número ${car.numero}`} className="h-full w-full object-cover"/><span className="absolute left-2 top-2 bg-yellow-400 px-3 py-1 font-racing text-lg font-bold text-black">Nº {car.numero}</span>{car.ocupado ? <span className="absolute right-2 top-2 bg-racing-red px-2 py-1 text-[10px] font-bold uppercase text-white">Ocupado</span> : null}</div><div className="p-4"><p className="font-bold text-white">{car.descripcion}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => editOfficialCar(car)} className="flex-1 border border-racing-border px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:border-yellow-300 hover:text-yellow-300">Modificar</button><button type="button" onClick={() => deleteOfficialCar(car)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label={`Eliminar diseño oficial número ${car.numero}`}><TrashIcon className="h-4 w-4"/></button></div></div></article>)}</div></div></div>
                  </section>;
                })}</div>
                {!officialCars.length ? <p className="mt-5 border border-dashed border-racing-border py-8 text-center text-sm text-gray-500">Todavía no cargaste autos oficiales.</p> : null}
              </section> : null}
              {registrationConfigMessage ? <div className="border border-racing-red/30 bg-racing-red/10 p-4 text-sm">{registrationConfigMessage}</div> : null}
              <button type="submit" disabled={savingRegistrationConfig} className="btn-primary w-full justify-center disabled:opacity-40">{savingRegistrationConfig ? 'Guardando...' : editingRegistrationConfig ? 'Guardar modificaciones' : 'Crear formulario'}</button>
            </form>}
          </section>
        </div>
      );
    }

    if (activeSection === 'monitoreo') {
      return (
        <section className="mx-auto max-w-3xl border border-racing-border bg-racing-gray p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Alertas automáticas</p>
              <h2 className="mt-2 font-racing text-3xl font-bold">Monitor de tiempos en vivo</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
                Comprueba cada {monitorStatus?.checkIntervalSeconds || 15} segundos los servidores correspondientes a las próximas fechas. Si uno no responde durante más de {monitorStatus?.outageThresholdSeconds || 60} segundos, envía una única alerta por correo.
              </p>
            </div>
            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase ${monitorStatus?.enabled ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>
              <span className={`h-2 w-2 rounded-full ${monitorStatus?.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
              {monitorStatus?.enabled ? 'Activo' : 'Desactivado'}
            </span>
          </div>

          <div className="mt-8 grid gap-4 border-y border-racing-border py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Destinatario</p>
              <p className="mt-1 text-white">{monitorStatus?.recipient || 'fede.cabello@hotmail.com'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Configuración SMTP</p>
              <p className={`mt-1 ${monitorStatus?.smtpConfigured ? 'text-green-400' : 'text-yellow-300'}`}>
                {monitorStatus?.smtpConfigured ? 'Completa' : 'Pendiente de completar en backend/.env'}
              </p>
            </div>
          </div>

          {monitorMessage ? <p className="mt-5 text-sm text-yellow-300" role="status">{monitorMessage}</p> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleMonitorToggle}
              disabled={!monitorStatus || savingMonitor || (!monitorStatus.smtpConfigured && !monitorStatus.enabled)}
              className={`rounded-lg px-5 py-3 font-racing font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${monitorStatus?.enabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-racing-red hover:bg-red-700'}`}
            >
              {savingMonitor ? 'Procesando...' : monitorStatus?.enabled ? 'Desactivar monitoreo' : 'Activar monitoreo'}
            </button>
            <button
              type="button"
              onClick={handleMonitorTest}
              disabled={savingMonitor || !monitorStatus?.smtpConfigured}
              className="rounded-lg border border-racing-border px-5 py-3 font-racing font-bold text-gray-200 transition hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar correo de prueba
            </button>
          </div>
        </section>
      );
    }

    if (activeSection === 'resultados') {
      return (
        <section className="min-w-0 overflow-hidden border border-racing-border bg-racing-gray">
          <div className="border-b border-racing-border px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-racing-red">Carga de resultados</p>
                <h2 className="mt-1 font-racing text-2xl font-bold">Planilla de posiciones y puntajes</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {resultChampionship
                    ? `${resultChampionship.categoria} · Temporada ${resultChampionship.temporada} · ${resultChampionship.anio}`
                    : 'Seleccioná un campeonato y una fecha para comenzar'}
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[minmax(260px,350px)_minmax(210px,270px)_90px_auto] xl:items-end">
                <label>
                  <span className="text-xs font-semibold uppercase text-gray-400">Campeonato</span>
                  <select
                    value={resultChampionshipId}
                    onChange={event => {
                      setResultChampionshipId(event.target.value);
                      setResultRoundId('');
                      setResultSheetSize(35);
                      setResultGridSelection(null);
                    }}
                    className="input-field mt-2"
                    disabled={savingResults}
                  >
                    <option value="">Seleccionar campeonato</option>
                    {displayedChampionships.map(championship => (
                      <option key={championship.id} value={championship.id}>
                        {championship.categoria} · T{championship.temporada} · {championship.anio}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-gray-400">Fecha</span>
                  <select value={resultRoundId} onChange={event => {
                    setResultRoundId(event.target.value);
                    setResultGridSelection(null);
                  }} className="input-field mt-2" disabled={!resultRounds.length || savingResults}>
                    <option value="">Seleccionar fecha</option>
                    {resultRounds.map(round => (
                      <option key={round.id} value={round.id}>Fecha {round.ronda} · {round.circuito}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-semibold uppercase text-gray-400">Filas</span>
                  <input type="number" min="1" max="100" value={resultSheetSize} onChange={event => setResultSheetSize(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} className="input-field mt-2 text-center" />
                </label>
                <button
                  type="button"
                  onClick={handleSaveResults}
                  disabled={!Object.keys(dirtyResults).length || savingResults}
                  className="btn-primary h-[46px] shrink-0 justify-center disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingResults ? 'Guardando...' : `Guardar${Object.keys(dirtyResults).length ? ` (${Object.keys(dirtyResults).length})` : ''}`}
                </button>
              </div>
            </div>
            {resultRound ? <p className="mt-3 text-xs text-gray-500">La grilla mantiene un orden fijo mientras trabajás. Arrastrá o usá Shift + clic para seleccionar celdas; Ctrl+C, Ctrl+V y Supr funcionan como en Excel. La validación se realiza al guardar.</p> : null}
          </div>

          {resultMessage && (
            <div className="border-b border-racing-red/40 bg-racing-red/10 px-4 py-3 text-sm text-gray-200 lg:px-6">
              {resultMessage}
            </div>
          )}

          <div className="overflow-x-auto" onCopy={handleResultGridCopy}>
            <table className="w-max min-w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-30">
                <tr className="bg-racing-dark">
                  <th className="sticky left-0 z-40 w-16 border border-racing-border bg-racing-dark px-2 py-3 text-center text-[10px] uppercase tracking-wider text-gray-400">#</th>
                  <th className="sticky left-16 z-40 w-64 border border-racing-border bg-racing-dark px-3 py-3 text-left text-[10px] uppercase tracking-wider text-gray-400">Piloto</th>
                  {resultSpreadsheetColumns.map(column => (
                    <th key={column.key} className={`${column.type === 'pilot' ? 'w-64 text-left' : 'w-24 text-center'} border border-racing-border bg-racing-dark px-2 py-3 text-[10px] uppercase tracking-wider text-gray-400`} title={column.label}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingResults ? (
                  <tr><td colSpan={resultSpreadsheetColumns.length + 2} className="border border-racing-border px-6 py-14 text-center text-gray-500">Cargando resultados...</td></tr>
                ) : !resultRound ? (
                  <tr><td colSpan={resultSpreadsheetColumns.length + 2} className="border border-racing-border px-6 py-14 text-center text-gray-500">Seleccioná un campeonato y una fecha para abrir la planilla.</td></tr>
                ) : (
                  resultSheetRows.map((row, rowIndex) => {
                    const result = row.result;
                    const resultKey = result?._key || (result?.id ? `id-${result.id}` : `empty-${row.position}`);
                    const isDirty = Boolean(result && dirtyResults[resultKey]);
                    return (
                      <tr key={row.unpositioned ? `unpositioned-${resultKey}` : `position-${row.position}`} className={isDirty ? 'bg-amber-400/[0.07]' : rowIndex % 2 ? 'bg-black/10' : 'bg-racing-gray'}>
                        <td className={`sticky left-0 z-10 h-10 border border-racing-border p-0 text-center font-racing text-base ${row.unpositioned ? 'bg-gray-900 text-gray-500' : row.position <= 3 ? 'bg-racing-dark text-racing-red' : 'bg-racing-dark text-gray-300'}`}>
                          {row.unpositioned ? '—' : row.position}
                        </td>
                        <td className="sticky left-16 z-10 h-10 w-64 max-w-64 border border-racing-border bg-racing-gray p-0 font-semibold text-white">
                          <ResultSpreadsheetCell
                            value={result?.piloto || ''}
                            type="pilot"
                            disabled={row.unpositioned && !result}
                            label={`Piloto, fila ${row.position || 'sin posición'}`}
                            rowIndex={rowIndex}
                            columnIndex={0}
                            selected={isResultCellSelected(rowIndex, 0)}
                            error={result ? resultCellErrors[`${resultKey}:piloto`] : ''}
                            onCommit={nextValue => handleResultPilotChange(row, result, nextValue)}
                            onSelect={handleResultCellSelect}
                            onExtendSelection={handleResultCellSelectionExtend}
                            onPaste={handleResultGridPaste}
                            onClearSelection={handleResultGridClear}
                          />
                        </td>
                        {resultSpreadsheetColumns.map((column, columnIndex) => {
                          const gridColumnIndex = columnIndex + 1;
                          if (column.type === 'pilot') {
                            return (
                              <td key={column.key} className="h-10 w-64 max-w-64 border border-racing-border p-0 font-semibold text-white">
                                <ResultSpreadsheetCell
                                  value={result?.[column.key] ?? result?.piloto ?? ''}
                                  type="pilot"
                                  disabled={row.unpositioned && !result}
                                  label={`${column.label}, fila ${row.position || 'sin posición'}`}
                                  rowIndex={rowIndex}
                                  columnIndex={gridColumnIndex}
                                  selected={isResultCellSelected(rowIndex, gridColumnIndex)}
                                  error={result ? resultCellErrors[`${resultKey}:${column.key}`] : ''}
                                  onCommit={nextValue => handleResultPilotChange(row, result, nextValue, column.key)}
                                  onSelect={handleResultCellSelect}
                                  onExtendSelection={handleResultCellSelectionExtend}
                                  onPaste={handleResultGridPaste}
                                  onClearSelection={handleResultGridClear}
                                />
                              </td>
                            );
                          }
                          const value = result?.[column.key] ?? '';
                          return (
                            <td key={column.key} className="h-10 w-24 border border-racing-border p-0">
                              <ResultSpreadsheetCell
                                value={value}
                                type={column.type}
                                disabled={!result}
                                label={`${column.label}, ${result?.piloto || `fila ${row.position}`}`}
                                rowIndex={rowIndex}
                                columnIndex={gridColumnIndex}
                                selected={isResultCellSelected(rowIndex, gridColumnIndex)}
                                error={result ? resultCellErrors[`${resultKey}:${column.key}`] : ''}
                                onCommit={nextValue => handleResultFieldChange({ idpiloto: result.idpiloto, piloto: result.piloto }, resultRound, result, column.key, nextValue)}
                                onSelect={handleResultCellSelect}
                                onExtendSelection={handleResultCellSelectionExtend}
                                onPaste={handleResultGridPaste}
                                onClearSelection={handleResultGridClear}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {resultRound && resultAchievementRows.length ? <section className="border-t-4 border-black bg-black/20 px-4 py-5 lg:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Marcas oficiales</p><h3 className="mt-1 font-racing text-xl font-bold text-white">Pole, victorias y campeón</h3></div><p className="text-xs text-gray-500">Marcá los reconocimientos y presioná Guardar.</p></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm"><thead><tr className="bg-racing-dark text-[10px] uppercase tracking-wider text-gray-500"><th className="border border-racing-border px-3 py-3 text-left">Piloto</th>{resultAchievementFields.map(field => <th key={field.key} className="border border-racing-border px-3 py-3 text-center">{field.label}</th>)}</tr></thead><tbody>{resultAchievementRows.map(result => <tr key={result.id || result._key} className="bg-racing-gray"><td className="border border-racing-border px-3 py-2 font-semibold text-white">{result.piloto}</td>{resultAchievementFields.map(field => <td key={field.key} className="border border-racing-border px-3 py-2 text-center"><label className="inline-flex cursor-pointer items-center justify-center"><input type="checkbox" checked={Boolean(Number(result[field.key]))} onChange={() => handleResultAchievementChange(result, field.key)} className="h-5 w-5 accent-red-600"/><span className="sr-only">{field.label}: {result.piloto}</span></label></td>)}</tr>)}</tbody></table></div>
          </section> : null}

          {resultRound && resultAchievementRows.length ? <section className="border-t-4 border-black bg-red-950/[0.08] px-4 py-5 lg:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-red-400">Comisariato deportivo</p><h3 className="mt-1 font-racing text-xl font-bold text-white">Sanciones por tanda</h3></div><p className="text-xs text-gray-500">Escribí solamente el motivo. La posición se corrige manualmente en la planilla superior.</p></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1250px] border-collapse text-sm"><thead><tr className="bg-racing-dark text-[10px] uppercase tracking-wider text-gray-500"><th className="sticky left-0 z-10 min-w-56 border border-racing-border bg-racing-dark px-3 py-3 text-left">Piloto</th>{resultSanctionFields.map(field => <th key={field.key} className="min-w-64 border border-racing-border px-3 py-3 text-left">{field.label}</th>)}</tr></thead><tbody>{resultAchievementRows.map(result => <tr key={result.id || result._key} className="bg-racing-gray"><td className="sticky left-0 z-10 border border-racing-border bg-racing-gray px-3 py-3 font-semibold text-white">{result.piloto}</td>{resultSanctionFields.map(field => { const value = String(result[field.key] || ''); return <td key={field.key} className={`border p-1 ${value ? 'border-red-500/50 bg-red-500/[0.08]' : 'border-racing-border'}`}><textarea value={value} onChange={event => handleResultFieldChange({ idpiloto: result.idpiloto, piloto: result.piloto }, resultRound, result, field.key, event.target.value)} maxLength={500} rows={2} placeholder="Sin sanción" className={`min-h-16 w-full resize-y bg-transparent px-2 py-2 text-xs outline-none placeholder:text-gray-700 ${value ? 'text-red-200' : 'text-gray-300'} focus:bg-black/20`}/></td>; })}</tr>)}</tbody></table></div>
          </section> : null}

          {resultChampionshipId ? (
            <div className="mt-14 border-y-4 border-black bg-racing-gray shadow-2xl">
              <div className="flex flex-col gap-1 border-b border-racing-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-400">Actualización al guardar</p>
                  <h3 className="mt-1 font-racing text-xl font-bold text-white">Tabla completa del campeonato</h3>
                </div>
                <p className="text-xs text-gray-500">Incluye presentismo, clasificaciones, sprint y final de todas las fechas.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/45">
                      <th rowSpan={2} className="w-14 whitespace-nowrap border border-racing-border px-2 py-2.5 text-center uppercase text-gray-400">Pos.</th>
                      <th rowSpan={2} className="min-w-64 border border-racing-border px-3 py-2.5 text-left uppercase text-gray-400">Piloto / Auto</th>
                      {resultRounds.map(round => (
                        <th
                          key={round.id}
                          colSpan={5}
                          className="whitespace-nowrap border border-racing-border px-3 py-3 text-center font-racing text-sm uppercase text-gray-300"
                          title={`Fecha ${round.ronda}: ${round.circuito}${round.variante ? ` · ${round.variante}` : ''}`}
                        >
                          Fecha {round.ronda} · {round.circuito}
                        </th>
                      ))}
                      <th rowSpan={2} className="whitespace-nowrap border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5 text-center font-racing text-sm uppercase text-cyan-300" style={{ width: `${resultTotalColumnWidth}ch` }}>Total</th>
                    </tr>
                    <tr className="bg-black/30 text-[10px] uppercase text-gray-500">
                      {resultRounds.flatMap(round => [
                        <th key={`${round.id}-presentismo`} className="min-w-11 border border-racing-border px-2 py-2" title="Presentismo">P</th>,
                        <th key={`${round.id}-qualy`} className="min-w-11 border border-racing-border px-2 py-2" title="Clasificación">Q</th>,
                        <th key={`${round.id}-sprint`} className="min-w-11 border border-racing-border px-2 py-2" title="Sprint">S</th>,
                        <th key={`${round.id}-final`} className="min-w-11 border border-racing-border px-2 py-2" title="Final">F</th>,
                        <th key={`${round.id}-points`} className="min-w-14 border border-amber-400/30 bg-amber-400/10 px-2 py-2 font-bold text-amber-300" title="Puntos de la fecha">PTS</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {resultChampionshipStandings.map((standing, index) => (
                      <tr key={standing.idpiloto} className={index % 2 ? 'bg-black/10' : 'bg-transparent'}>
                        <td className={`whitespace-nowrap border border-racing-border px-2 py-2 text-center font-racing text-lg font-bold ${standing.position === 1 ? 'bg-yellow-400/10 text-yellow-300' : standing.position === 2 ? 'bg-slate-300/10 text-slate-200' : standing.position === 3 ? 'bg-orange-700/10 text-orange-400' : 'text-gray-400'}`}>{standing.position}</td>
                        <td className="border border-racing-border px-3 py-2 text-white">
                          <div className="flex min-w-60 items-center gap-3">
                            {standing.autoLogo ? <img src={standing.autoLogo} alt={`Logo ${standing.marca || ''}`} className="h-9 w-12 shrink-0 object-contain" /> : <div className="h-9 w-12 shrink-0" />}
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-semibold" title={standing.piloto}><span className="truncate">{standing.piloto}</span>{standing.campeon ? <span className="shrink-0 bg-yellow-400 px-2 py-0.5 text-[9px] font-bold uppercase text-black">Campeón</span> : null}</p>
                              <p className="truncate text-[11px] font-normal text-gray-500">{[standing.marca, standing.modelo].filter(Boolean).join(' ') || 'Auto sin informar'}</p>
                            </div>
                          </div>
                        </td>
                        {resultRounds.flatMap(round => {
                          const detail = standing.rounds.get(String(round.ronda));
                          if (!detail || detail.points === 0) {
                            return [
                              <td key={`${round.id}-absent`} colSpan={5} className="border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-center font-racing text-[10px] font-bold tracking-[0.18em] text-red-500">
                                AUSENTE
                              </td>,
                            ];
                          }
                          return [
                            <td key={`${round.id}-presentismo`} className="border border-racing-border px-2 py-2 text-center font-racing text-base text-white">{formatResultPointsCell(detail.presentismo)}</td>,
                            <td key={`${round.id}-qualy`} className="border border-racing-border px-2 py-2 text-center font-racing text-base text-white">{formatResultPointsCell(detail.qualy)}</td>,
                            <td key={`${round.id}-sprint`} className="border border-racing-border px-2 py-2 text-center font-racing text-base text-white">{formatResultPointsCell(detail.sprint)}</td>,
                            <td key={`${round.id}-final`} className="border border-racing-border px-2 py-2 text-center font-racing text-base text-white">{formatResultPointsCell(detail.final)}</td>,
                            <td key={`${round.id}-points`} className="border border-amber-400/30 bg-amber-400/10 px-2 py-2 text-center font-racing text-base font-bold text-amber-300">{formatResultPointsCell(detail.points)}</td>,
                          ];
                        })}
                        <td className="whitespace-nowrap border border-cyan-400/30 bg-cyan-400/[0.08] px-3 py-2 text-center font-racing text-xl font-bold text-cyan-300">{formatResultPointsCell(standing.total)}</td>
                      </tr>
                    ))}
                    {!resultChampionshipStandings.length ? <tr><td colSpan={(resultRounds.length * 5) + 3} className="border border-racing-border px-6 py-10 text-center text-gray-500">No hay pilotos para calcular la tabla.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    /*
    if (activeSection === 'resultados') {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
          <section className="card-glass p-6">
            <h2 className="font-racing text-2xl font-bold mb-5">Cargar resultado</h2>

            <form onSubmit={handleResultSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Fecha del calendario</span>
                <select
                  value={selectedEventId}
                  onChange={event => setSelectedEventId(event.target.value)}
                  className="input-field mt-2"
                  required
                >
                  <option value="">Seleccionar fecha</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.categoria} T{event.temporada} - R{event.ronda} - {event.circuito}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-racing-border bg-racing-dark px-3 py-2">
                  <p className="text-gray-500">Campeonato</p>
                  <p className="text-white">{selectedEvent?.idcampeonato ?? '-'}</p>
                </div>
                <div className="rounded-lg border border-racing-border bg-racing-dark px-3 py-2">
                  <p className="text-gray-500">Ronda</p>
                  <p className="text-white">{selectedEvent?.ronda ?? '-'}</p>
                </div>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">Piloto</span>
                <select name="idpiloto" value={resultForm.idpiloto} onChange={handleResultChange} className="input-field mt-2" required>
                  <option value="">Seleccionar piloto</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>{driver.nombre}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Posición</span>
                <input name="posicion" type="number" min="1" value={resultForm.posicion} onChange={handleResultChange} className="input-field mt-2" required />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-300">Apercib.</span>
                  <input name="apercibimientos" type="number" min="0" value={resultForm.apercibimientos} onChange={handleResultChange} className="input-field mt-2" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Rec. tiempo</span>
                  <input name="recargo_tiempo" type="number" min="0" value={resultForm.recargo_tiempo} onChange={handleResultChange} className="input-field mt-2" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Rec. pos.</span>
                  <input name="recargo_posiciones" type="number" min="0" value={resultForm.recargo_posiciones} onChange={handleResultChange} className="input-field mt-2" />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300">
                <input name="dq" type="checkbox" checked={resultForm.dq} onChange={handleResultChange} className="h-4 w-4 accent-racing-red" />
                Descalificado
              </label>

              {resultMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {resultMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingResult}>
                {savingResult ? 'Guardando...' : 'Guardar resultado'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <h2 className="font-racing text-2xl font-bold">Resultados cargados</h2>
              <p className="text-sm text-gray-400">{selectedEvent ? `${selectedEvent.circuito} - Ronda ${selectedEvent.ronda}` : 'Seleccioná una fecha'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Pos</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Piloto</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Aperc.</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Rec.</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {results.length > 0 ? (
                    results.map(result => (
                      <tr key={result.id} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3 font-racing text-white">#{result.posicion}</td>
                        <td className="px-4 py-3 text-gray-200">
                          {result.piloto}
                          {result.dq ? <span className="ml-2 text-xs text-racing-red">DQ</span> : null}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">{result.apercibimientos ?? 0}</td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {result.recargo_tiempo || result.recargo_posiciones
                            ? `${result.recargo_tiempo || 0}s / ${result.recargo_posiciones || 0} pos.`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                            onClick={() => handleDeleteResult(result.id)}
                            aria-label="Eliminar resultado"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-gray-500">
                        No hay resultados cargados para esta fecha.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {editingEventKey ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={resetEventForm}>
              <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto border border-racing-border bg-racing-gray p-5 shadow-2xl sm:p-6" onMouseDown={event => event.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Edición individual</p>
                    <h2 className="mt-1 font-racing text-2xl font-bold">Modificar fecha</h2>
                  </div>
                  <button type="button" onClick={resetEventForm} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Cerrar">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleEventSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                    <label>
                      <span className="text-sm text-gray-300">Campeonato</span>
                      <select name="idcampeonato" value={eventForm.idcampeonato} onChange={handleEventChange} className="input-field mt-2" required>
                        {championships.map(championship => (
                          <option key={championship.id} value={championship.id}>{championship.categoria} - Temporada {championship.temporada} ({championship.anio})</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-sm text-gray-300">Ronda</span>
                      <input name="ronda" type="number" min="1" value={eventForm.ronda} onChange={handleEventChange} className="input-field mt-2" required />
                    </label>
                  </div>

                  <div>
                    <span className="text-sm text-gray-300">Fecha y hora</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_100px]">
                      <input type="date" value={getEventDatePart(eventForm.fecha)} onChange={handleEventDatePartChange} className="input-field" required />
                      <select value={getEventHourPart(eventForm.fecha)} onChange={handleEventHourChange} className="input-field px-3">
                        <option value="21">21 H</option>
                        <option value="22">22 H</option>
                      </select>
                      <select value={getEventMinutePart(eventForm.fecha)} onChange={handleEventMinuteChange} className="input-field px-3">
                        {eventMinuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}
                      </select>
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm text-gray-300">Circuito</span>
                    <select name="idcircuito" value={eventForm.idcircuito} onChange={handleEventChange} className="input-field mt-2" required>
                      {circuits.map(circuit => (
                        <option key={circuit.id} value={circuit.id}>{circuit.nombre}{circuit.variante ? ` (${circuit.variante})` : ''}</option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300">
                      <input name="especial" type="checkbox" checked={eventForm.especial} onChange={handleEventChange} className="h-4 w-4 accent-racing-red" />
                      Fecha especial
                    </label>
                    <label className="flex items-center gap-3 border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300">
                      <input name="coronacion" type="checkbox" checked={eventForm.coronacion} onChange={handleEventChange} className="h-4 w-4 accent-racing-red" />
                      Coronación
                    </label>
                  </div>

                  {eventForm.especial ? (
                    <label className="block">
                      <span className="text-sm text-gray-300">Especialidad</span>
                      <input name="especialidad" value={eventForm.especialidad} onChange={handleEventChange} className="input-field mt-2 uppercase" required />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="text-sm text-gray-300">Enlace de la transmisión</span>
                    <input name="transmision" type="url" value={eventForm.transmision} onChange={handleEventChange} className="input-field mt-2" placeholder="https://www.youtube.com/watch?v=..." />
                  </label>

                  {eventMessage ? <div className="border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">{eventMessage}</div> : null}

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={resetEventForm} className="btn-secondary justify-center">Cancelar</button>
                    <button type="submit" className="btn-primary justify-center" disabled={savingEvent}>{savingEvent ? 'Guardando...' : 'Actualizar fecha'}</button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </div>
      );
    }
    */

    if (activeSection === 'circuitos') {
      return (
        <div className="grid grid-cols-1 2xl:grid-cols-[460px_1fr] gap-8">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-racing text-2xl font-bold">
                  {editingCircuitId ? 'Modificar circuito' : lockedCircuitName ? 'Agregar variante' : 'Agregar circuito'}
                </h2>
              </div>
              {editingCircuitId ? (
                <button
                  type="button"
                  onClick={resetCircuitForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                  aria-label="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleCircuitSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Nombre del circuito</span>
                <div className="relative mt-2">
                  <input
                    name="nombre"
                    value={circuitForm.nombre}
                    onChange={event => {
                      handleCircuitChange(event);
                      setShowCircuitNameSuggestions(true);
                    }}
                    onFocus={() => setShowCircuitNameSuggestions(true)}
                    onKeyDown={handleCircuitNameKeyDown}
                    className={`input-field ${lockedCircuitName ? 'cursor-not-allowed opacity-80' : ''}`}
                    placeholder="Toay"
                    autoComplete="off"
                    readOnly={lockedCircuitName}
                    required
                  />
                  {showCircuitNameSuggestions && circuitNameSuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-racing-border bg-racing-gray shadow-racing">
                      {circuitNameSuggestions.map(circuit => (
                        <button
                          key={circuit.id}
                          type="button"
                          onClick={() => handleSelectCircuitSuggestion(circuit)}
                          className="block w-full px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:bg-racing-red/15 hover:text-white"
                        >
                          <span className="font-racing text-base text-white">{circuit.nombre}</span>
                          {circuit.variante ? <span className="ml-2 text-xs text-racing-red">{circuit.variante}</span> : null}
                          <span className="flex items-center gap-2 text-xs text-gray-500">
                            <CountryFlag country={circuit.pais} />
                            {[circuit.localidad, circuit.provincia, getCountryName(circuit.pais)].filter(Boolean).join(', ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-300">Localidad</span>
                  <input
                    name="localidad"
                    value={circuitForm.localidad}
                    onChange={handleCircuitChange}
                    className={`input-field mt-2 ${lockedCircuitName ? 'cursor-not-allowed opacity-80' : ''}`}
                    placeholder="Toay"
                    readOnly={lockedCircuitName}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Provincia</span>
                  <input
                    name="provincia"
                    value={circuitForm.provincia}
                    onChange={handleCircuitChange}
                    className={`input-field mt-2 ${lockedCircuitName ? 'cursor-not-allowed opacity-80' : ''}`}
                    placeholder="La Pampa"
                    readOnly={lockedCircuitName}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">País</span>
                <CountrySelect
                  value={circuitForm.pais}
                  onChange={pais => setCircuitForm(current => ({ ...current, pais }))}
                  disabled={lockedCircuitName}
                  options={circuitCountries}
                  className="mt-2"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Variante</span>
                <input name="variante" value={circuitForm.variante} onChange={handleCircuitChange} className="input-field mt-2 lowercase" placeholder="largo" />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Imagen del circuito</span>
                <div className={`mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4 ${lockedCircuitName ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">
                      {lockedCircuitName ? 'Se conserva la imagen del autódromo seleccionado' : circuitImageFile?.name || 'PNG, JPG, WEBP o AVIF hasta 5 MB'}
                    </span>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/avif,image/webp,image/jpeg,image/png"
                    disabled={lockedCircuitName}
                    onChange={event => setCircuitImageFile(event.target.files?.[0] ?? null)}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark disabled:cursor-not-allowed"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Trazado del circuito</span>
                <div className="mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4">
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">{circuitLayoutFile?.name || 'PNG del trazado hasta 5 MB'}</span>
                  </div>
                  <input
                    ref={layoutInputRef}
                    type="file"
                    accept="image/png"
                    onChange={event => {
                      setCircuitLayoutFile(event.target.files?.[0] ?? null);
                      setCircuitLayoutCrop(defaultCropSettings);
                    }}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark"
                  />
                  <SquareCropEditor
                    file={circuitLayoutFile}
                    settings={circuitLayoutCrop}
                    onChange={setCircuitLayoutCrop}
                    label="Recorte del trazado"
                  />
                </div>
              </label>

              {circuitMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {circuitMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingCircuit}>
                {savingCircuit ? 'Guardando...' : editingCircuitId ? 'Actualizar circuito' : lockedCircuitName ? 'Guardar variante' : 'Guardar circuito'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-racing text-2xl font-bold">Circuitos cargados</h2>
                  <p className="mt-1 text-sm text-gray-400">{displayedCircuits.length} circuito{displayedCircuits.length === 1 ? '' : 's'}</p>
                  </div>
                  <ClearFiltersButton active={Boolean(circuitCountryFilter || circuitSearch)} onClick={() => { setCircuitCountryFilter(''); setCircuitSearch(''); }} />
                </div>
                <div className="grid w-full gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">País</span>
                    <select value={circuitCountryFilter} onChange={event => setCircuitCountryFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todos los países</option>
                      {availableCircuitCountries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={circuitSearch}
                        onChange={event => setCircuitSearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Nombre, localidad, provincia..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Trazado</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">
                      <button
                        type="button"
                        onClick={() => handleCircuitSort('nombre')}
                        className="inline-flex items-center gap-2 rounded text-left uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Circuito
                        <span className="text-racing-red">{circuitSort === 'nombre' ? (circuitSortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">
                      <button
                        type="button"
                        onClick={() => handleCircuitSort('localidad')}
                        className="inline-flex items-center gap-2 rounded text-left uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Ubicación
                        <span className="text-racing-red">{circuitSort === 'localidad' ? (circuitSortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {paginatedCircuits.length > 0 ? (
                    paginatedCircuits.map(circuit => (
                      <tr key={circuit.id} className="hover:bg-racing-card/60">
                        <td className="relative isolate overflow-hidden px-4 py-3">
                          {circuit.imagen ? (
                            <div className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-72 overflow-hidden">
                              <img src={circuit.imagen} alt="" className="h-full w-full object-cover opacity-30" />
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-racing-dark/70 to-racing-dark" />
                            </div>
                          ) : null}
                          {circuit.trazado ? (
                            <img src={circuit.trazado} alt={`Trazado ${circuit.nombre}`} className="h-12 w-20 object-contain" />
                          ) : (
                            <div className="flex h-12 w-20 items-center justify-center rounded bg-racing-dark text-xs text-gray-500">Sin trazado</div>
                          )}
                        </td>
                        <td className="relative px-4 py-3">
                          <span className="font-racing text-base text-white">{circuit.nombre}</span>
                          {circuit.variante ? <span className="ml-2 text-xs uppercase text-racing-red">{circuit.variante}</span> : null}
                        </td>
                        <td className="relative px-4 py-3 text-gray-400">
                          <span className="flex items-center gap-2">
                            <CountryFlag country={circuit.pais} className="text-lg" />
                            {[circuit.localidad, circuit.provincia, getCountryName(circuit.pais)].filter(Boolean).join(', ') || '-'}
                          </span>
                        </td>
                        <td className="relative px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditCircuit(circuit)}
                              aria-label="Editar circuito"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteCircuit(circuit.id)}
                              aria-label="Eliminar circuito"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-10 text-center text-gray-500">
                        {circuits.length ? 'No hay circuitos que coincidan con la búsqueda.' : 'Todavía no hay circuitos cargados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination page={circuitPage} pageCount={circuitPageCount} total={displayedCircuits.length} onPageChange={setCircuitPage} />
          </section>
        </div>
      );
    }

    if (activeSection === 'categorias') {
      const selectedGallerySeason = categoryGallerySeasons.find(season => String(season.id) === String(categoryGalleryChampionshipId));
      return (
        <div className="grid grid-cols-1 2xl:grid-cols-[420px_1fr] gap-8">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-racing text-2xl font-bold">{editingCategoryId ? 'Modificar categoría' : 'Agregar categoría'}</h2>
              {editingCategoryId ? (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                  aria-label="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Nombre de la categoría</span>
                <input
                  name="categoria"
                  value={categoryForm.categoria}
                  onChange={handleCategoryChange}
                  className="input-field mt-2"
                  placeholder="Turismo Nacional"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Logo</span>
                <div className="mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4">
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">{categoryLogoFile?.name || 'PNG, JPG, WEBP o AVIF hasta 5 MB'}</span>
                  </div>
                  <input
                    ref={categoryLogoInputRef}
                    type="file"
                    accept="image/avif,image/webp,image/jpeg,image/png"
                    onChange={event => {
                      setCategoryLogoFile(event.target.files?.[0] ?? null);
                      setCategoryLogoCrop(defaultCropSettings);
                    }}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark"
                  />
                  <SquareCropEditor
                    file={categoryLogoFile}
                    settings={categoryLogoCrop}
                    onChange={setCategoryLogoCrop}
                    label="Recorte del logo"
                  />
                </div>
              </label>

              {categoryMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {categoryMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingCategory}>
                {savingCategory ? 'Guardando...' : editingCategoryId ? 'Actualizar categoría' : 'Guardar categoría'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-center gap-3"><h2 className="font-racing text-2xl font-bold">Categorías cargadas</h2><ClearFiltersButton active={Boolean(categorySearch)} onClick={() => setCategorySearch('')} /></div>
                <div className="w-full xl:max-w-xl">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={categorySearch}
                        onChange={event => setCategorySearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Categoría, logo..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Logo</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">
                      <button
                        type="button"
                        onClick={() => setCategorySortDirection(current => (current === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center gap-2 rounded text-left uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Categoría
                        <span className="text-racing-red">{categorySortDirection === 'asc' ? '▲' : '▼'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {displayedCategories.length > 0 ? (
                    displayedCategories.map(category => (
                      <tr key={category.id} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3">
                          {category.logo ? (
                            <img src={category.logo} alt={category.categoria} className="h-12 w-20 object-contain" />
                          ) : (
                            <div className="flex h-12 w-20 items-center justify-center rounded bg-racing-dark text-xs text-gray-500">Sin logo</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-racing text-base text-white">{category.categoria}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditCategory(category)}
                              aria-label="Editar categoría"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteCategory(category.id)}
                              aria-label="Eliminar categoría"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-10 text-center text-gray-500">
                        {categories.length ? 'No hay categorías que coincidan con la búsqueda.' : 'Todavía no hay categorías cargadas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-glass p-6 2xl:col-span-2">
            <div className="flex flex-col gap-5 border-b border-racing-border pb-5 xl:flex-row xl:items-end xl:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-racing-red">Galería histórica</p><h2 className="mt-1 font-racing text-2xl font-bold text-white">Fotos por categoría y temporada</h2><p className="mt-1 text-sm text-gray-500">Acá se centralizan las fotos del formulario y las imágenes exclusivas que agregues a la categoría.</p></div>
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl">
                <label><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Categoría</span><select value={categoryGalleryCategoryId} onChange={event => loadCategoryGallery(event.target.value)} className="input-field mt-2"><option value="">Seleccionar categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.categoria}</option>)}</select></label>
                <label><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Temporada</span><select value={categoryGalleryChampionshipId} onChange={event => { setCategoryGalleryChampionshipId(event.target.value); setCategoryGalleryFiles([]); setCategoryGalleryMessage(''); if (categoryGalleryInputRef.current) categoryGalleryInputRef.current.value = ''; }} className="input-field mt-2" disabled={!categoryGallerySeasons.length}><option value="">Seleccionar temporada</option>{categoryGallerySeasons.map(season => <option key={season.id} value={season.id}>Temporada {season.temporada} · {season.anio}</option>)}</select></label>
              </div>
            </div>

            {!categoryGalleryCategoryId ? <div className="py-14 text-center text-gray-500"><PhotoIcon className="mx-auto h-12 w-12"/><p className="mt-3">Seleccioná una categoría para administrar sus fotos.</p></div> : !categoryGallerySeasons.length ? <div className="py-14 text-center text-gray-500">La categoría todavía no tiene temporadas cargadas.</div> : <>
              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-sm text-gray-300">Agregar fotos a {selectedGallerySeason ? `Temporada ${selectedGallerySeason.temporada} · ${selectedGallerySeason.anio}` : 'la temporada'}</span><input ref={categoryGalleryInputRef} type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setCategoryGalleryFiles(Array.from(event.target.files || []).slice(0, 10))} className="input-field mt-2 file:mr-4 file:border-0 file:bg-racing-red file:px-4 file:py-2 file:font-semibold file:text-white"/><small className="mt-1 block text-gray-500">Hasta 10 imágenes por carga, de 8 MB cada una.</small></label><button type="button" onClick={uploadCategoryGallery} disabled={!categoryGalleryFiles.length || savingCategoryGallery || !categoryGalleryChampionshipId} className="btn-primary min-h-12 justify-center disabled:cursor-not-allowed disabled:opacity-40"><PhotoIcon className="h-5 w-5"/>{savingCategoryGallery ? 'Subiendo...' : `Subir ${categoryGalleryFiles.length || ''} foto${categoryGalleryFiles.length === 1 ? '' : 's'}`}</button></div>
              {categoryGalleryMessage ? <p className="mt-4 border border-racing-border bg-black/20 p-3 text-sm text-gray-300">{categoryGalleryMessage}</p> : null}
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{(selectedGallerySeason?.images || []).map(image => <article key={`${image.source}-${image.filename}`} className="group relative aspect-video overflow-hidden border border-racing-border bg-black"><img src={image.url} alt="Galería de la categoría" className="h-full w-full object-cover"/><span className={`absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${image.source === 'formulario' ? 'text-yellow-300' : 'text-racing-red'}`}>{image.source === 'formulario' ? 'Formulario' : 'Categoría'}</span><button type="button" onClick={() => deleteCategoryGalleryImage(image)} className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center bg-black/80 text-gray-300 transition hover:bg-racing-red hover:text-white md:opacity-0 md:group-hover:opacity-100" aria-label="Eliminar foto"><TrashIcon className="h-4 w-4"/></button></article>)}{selectedGallerySeason && !selectedGallerySeason.images?.length ? <div className="col-span-full border border-dashed border-racing-border py-10 text-center text-sm text-gray-500">Esta temporada todavía no tiene fotos.</div> : null}</div>
            </>}
          </section>
        </div>
      );
    }

    if (activeSection === 'campeonatos') {
      return (
        <div className="grid grid-cols-1 2xl:grid-cols-[460px_1fr] gap-8">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-racing text-2xl font-bold">{editingChampionshipId ? 'Modificar campeonato' : 'Agregar campeonato'}</h2>
              {editingChampionshipId ? (
                <button
                  type="button"
                  onClick={resetChampionshipForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                  aria-label="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleChampionshipSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Categoría</span>
                <select
                  name="idcategoria"
                  value={championshipForm.idcategoria}
                  onChange={handleChampionshipChange}
                  className="input-field mt-2"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.categoria}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="block">
                  <span className="text-sm text-gray-300">
                    {editingChampionshipId ? 'Temporada registrada' : 'Próxima temporada'}
                  </span>
                  <div
                    className="mt-2 flex min-h-11 items-center border border-racing-border bg-racing-dark px-3 font-racing text-lg text-yellow-300"
                    aria-live="polite"
                  >
                    {championshipForm.temporada
                      ? `Temporada ${championshipForm.temporada}`
                      : 'Seleccioná una categoría'}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm text-gray-300">Año</span>
                  <select
                    name="anio"
                    value={championshipForm.anio}
                    onChange={handleChampionshipChange}
                    className="input-field mt-2"
                    required
                  >
                    {championshipYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">Plataforma</span>
                <select
                  name="plataforma"
                  value={championshipForm.plataforma}
                  onChange={handleChampionshipChange}
                  className="input-field mt-2"
                  required
                >
                  <option value="">Seleccionar plataforma</option>
                  {championshipPlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-300">Puerto de tiempos</span>
                  <input
                    name="puerto"
                    type="number"
                    min="1"
                    max="65535"
                    value={championshipForm.puerto}
                    onChange={handleChampionshipChange}
                    className="input-field mt-2"
                    placeholder="30000"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Número de servidor</span>
                  <input
                    name="n_server"
                    type="number"
                    min="0"
                    value={championshipForm.n_server}
                    onChange={handleChampionshipChange}
                    className="input-field mt-2"
                    placeholder="4"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">Enlace para ingresar al servidor</span>
                <input
                  name="servidor"
                  type="url"
                  value={championshipForm.servidor}
                  onChange={handleChampionshipChange}
                  className="input-field mt-2"
                  placeholder="https://acstuff.ru/s/q:race/..."
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Reglamento PDF</span>
                <div className="mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4">
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">{championshipRulesFile?.name || 'PDF hasta 10 MB'}</span>
                  </div>
                  <input
                    ref={championshipRulesInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={event => setChampionshipRulesFile(event.target.files?.[0] ?? null)}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark"
                  />
                </div>
              </label>

              {championshipMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {championshipMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingChampionship}>
                {savingChampionship ? 'Guardando...' : editingChampionshipId ? 'Actualizar campeonato' : 'Guardar campeonato'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-racing text-2xl font-bold">Campeonatos cargados</h2>
                  <p className="mt-1 text-sm text-gray-400">{displayedChampionships.length} campeonato{displayedChampionships.length === 1 ? '' : 's'}</p>
                  </div>
                  <ClearFiltersButton active={Boolean(championshipCategoryFilter || championshipYearFilter || championshipSearch)} onClick={() => { setChampionshipCategoryFilter(''); setChampionshipYearFilter(''); setChampionshipSearch(''); }} />
                </div>
                <div className="grid w-full gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Categoría</span>
                    <select value={championshipCategoryFilter} onChange={event => setChampionshipCategoryFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todas las categorías</option>
                      {categories.map(category => <option key={category.id} value={category.id}>{category.categoria}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Año</span>
                    <select value={championshipYearFilter} onChange={event => setChampionshipYearFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todos los años</option>
                      {availableChampionshipYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={championshipSearch}
                        onChange={event => setChampionshipSearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Categoría, temporada, año..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Temporada</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Año</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Plataforma</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Reglamento</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Tiempos</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Servidor</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {paginatedChampionships.length > 0 ? (
                    paginatedChampionships.map(championship => (
                      <tr key={championship.id} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {championship.categoria_logo ? (
                              <img src={championship.categoria_logo} alt={championship.categoria} className="h-10 w-12 object-contain" />
                            ) : null}
                            <span className="font-racing text-base text-white">{championship.categoria}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">T{championship.temporada}</td>
                        <td className="px-4 py-3 text-gray-300">{championship.anio}</td>
                        <td className="px-4 py-3 text-gray-300">{championship.plataforma || '-'}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {championship.reglamento ? (
                            <a href={championship.reglamento} target="_blank" rel="noreferrer" className="text-racing-red hover:text-white">
                              Ver PDF
                            </a>
                          ) : (
                            'Sin PDF'
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">:{championship.puerto || '-'} · #{championship.n_server ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {championship.servidor ? (
                            <a href={championship.servidor} target="_blank" rel="noreferrer" className="text-racing-red hover:text-white">Abrir</a>
                          ) : 'Sin enlace'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditChampionship(championship)}
                              aria-label="Editar campeonato"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteChampionship(championship.id)}
                              aria-label="Eliminar campeonato"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center text-gray-500">
                        {championships.length ? 'No hay campeonatos que coincidan con la búsqueda.' : 'Todavía no hay campeonatos cargados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination page={championshipPage} pageCount={championshipPageCount} total={displayedChampionships.length} onPageChange={setChampionshipPage} />
          </section>
        </div>
      );
    }

    if (activeSection === 'inscriptos') {
      const selectedRegistrationConfig = registrationConfigs.find(config =>
        String(config.idcampeonato) === String(registrationChampionshipFilter));
      const enabledRegistrationCarIds = new Set(
        (selectedRegistrationConfig?.autos_habilitados || []).map(id => String(id)),
      );
      const enabledRegistrationPlans = selectedRegistrationConfig
        ? normalizeAdminRegistrationPlans(selectedRegistrationConfig.planes).filter(plan => plan.habilitado)
        : [];
      const enabledRegistrationOfficialCars = registrationOfficialCars.filter(officialCar =>
        enabledRegistrationCarIds.has(String(officialCar.idauto)));
      const selectedChampionshipRegistrations = registrations.filter(registration =>
        String(registration.idcampeonato) === String(registrationChampionshipFilter));
      const registrationModelCounts = [...selectedChampionshipRegistrations.reduce((counts, registration) => {
        const registrationKey = `${registration.idcampeonato}-${registration.idpiloto}`;
        const editedCarId = registrationEdits[registrationKey]?.idauto;
        const selectedCar = cars.find(car => String(car.id) === String(editedCarId || registration.idauto));
        const brand = selectedCar?.marca || registration.marca || 'Sin marca';
        const model = selectedCar?.modelo || registration.modelo || 'Sin modelo';
        const key = `${brand}|||${model}`;
        const current = counts.get(key) || { brand, model, count: 0 };
        counts.set(key, { ...current, count: current.count + 1 });
        return counts;
      }, new Map()).values()].sort((a, b) =>
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'es-AR', { sensitivity: 'base' }));
      return (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="card-glass self-start p-5 xl:sticky xl:top-24 sm:p-6">
            {selectedRegistrationDriverId ? <form onSubmit={saveRegistrationDriverDetails} className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-racing-border pb-4">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center bg-racing-red/15 text-racing-red"><UsersIcon className="h-6 w-6"/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-racing-red">Piloto seleccionado</p><h2 className="truncate font-racing text-xl font-bold text-white">{registrationDriverDetails.nombre}</h2></div></div>
                <button type="button" onClick={() => { setSelectedRegistrationDriverId(null); setRegistrationDriverDetails(emptyDriverForm); setRegistrationDriverDetailsMessage(''); }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-500 transition hover:border-racing-red hover:text-white" aria-label="Cerrar datos del piloto"><XMarkIcon className="h-5 w-5"/></button>
              </div>
              <label className="block"><span className="text-sm text-gray-300">Nombre y apellido</span><input name="nombre" value={registrationDriverDetails.nombre} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2" required/></label>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block"><span className="text-sm text-gray-300">Teléfono</span><input name="telefono" value={registrationDriverDetails.telefono} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2" inputMode="tel"/></label>
                <label className="block"><span className="text-sm text-gray-300">Localidad</span><input name="localidad" value={registrationDriverDetails.localidad} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2"/></label>
                <label className="block"><span className="text-sm text-gray-300">Provincia</span><input name="provincia" value={registrationDriverDetails.provincia} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2"/></label>
                <label className="block"><span className="text-sm text-gray-300">Nacionalidad</span><CountrySelect value={registrationDriverDetails.nacionalidad} onChange={value => setRegistrationDriverDetails(current => ({ ...current, nacionalidad: value }))} allowEmpty className="mt-2"/></label>
                <label className="block"><span className="text-sm text-gray-300">ID Steam</span><input name="steam" value={registrationDriverDetails.steam} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2"/></label>
                <label className="block"><span className="text-sm text-gray-300">Instagram</span><input name="ig" value={registrationDriverDetails.ig} onChange={handleRegistrationDriverDetailsChange} className="input-field mt-2" placeholder="@usuario"/></label>
              </div>
              {registrationDriverDetailsMessage ? <div className={`border px-4 py-3 text-sm ${registrationDriverDetailsMessage.includes('correctamente') ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-racing-red/30 bg-racing-red/10 text-gray-200'}`}>{registrationDriverDetailsMessage}</div> : null}
              <button type="submit" className="btn-primary w-full justify-center" disabled={savingRegistrationDriver}>{savingRegistrationDriver ? 'Guardando...' : 'Guardar datos del piloto'}</button>
            </form> : <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-racing-border p-6 text-center"><UsersIcon className="h-12 w-12 text-gray-700"/><h2 className="mt-4 font-racing text-xl font-bold text-white">Datos del piloto</h2><p className="mt-2 text-sm leading-relaxed text-gray-500">Hacé clic sobre el nombre de un piloto inscripto para consultar y modificar sus datos.</p></div>}
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-racing text-2xl font-bold">Pilotos inscriptos</h2>
                  {selectedRegistrationChampionship ? <div className="mt-1">
                    <p className="text-sm text-gray-400">
                      {selectedChampionshipRegistrations.length} piloto{selectedChampionshipRegistrations.length === 1 ? '' : 's'} inscripto{selectedChampionshipRegistrations.length === 1 ? '' : 's'} · {registrationModelCounts.length} modelo{registrationModelCounts.length === 1 ? '' : 's'}
                      {displayedRegistrations.length !== selectedChampionshipRegistrations.length ? ` · Mostrando ${displayedRegistrations.length}` : ''}
                    </p>
                    {registrationModelCounts.length ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {registrationModelCounts.map(item => <span key={`${item.brand}-${item.model}`} className="text-gray-500">
                        <strong className="font-semibold text-gray-300">{item.brand} {item.model}</strong> · {item.count}
                      </span>)}
                    </div> : null}
                  </div> : <p className="mt-1 text-sm text-gray-400">Seleccioná un campeonato para gestionar sus inscriptos</p>}
                </div>
                <div className="flex items-center gap-2">
                  <ClearFiltersButton active={Boolean(registrationSearch || registrationPlanFilter || registrationReadyFilter)} onClick={() => { setRegistrationSearch(''); setRegistrationPlanFilter(''); setRegistrationReadyFilter(''); }} />
                  <button
                    type="button"
                    onClick={handleSaveRegistrationChanges}
                    disabled={!Object.keys(registrationEdits).length || savingRegistrationChanges}
                    className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingRegistrationChanges
                      ? 'Guardando...'
                      : `Guardar cambios${Object.keys(registrationEdits).length ? ` (${Object.keys(registrationEdits).length})` : ''}`}
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(280px,1fr)_minmax(180px,0.55fr)_minmax(170px,0.5fr)_minmax(220px,0.7fr)]">
                <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={registrationChampionshipFilter} onChange={event => selectRegistrationChampionship(event.target.value)} className="input-field mt-2"><option value="">Seleccionar campeonato</option>{registrationChampionshipGroups.map(championship => <option key={championship.id} value={championship.id}>{championship.categoria} · Temporada {championship.temporada} · {championship.anio} · {championship.registrationsCount} inscripto{championship.registrationsCount === 1 ? '' : 's'}</option>)}</select></label>
                <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tipo de diseño</span><select value={registrationPlanFilter} onChange={event => setRegistrationPlanFilter(event.target.value)} disabled={!registrationChampionshipFilter} className="input-field mt-2 disabled:cursor-not-allowed disabled:opacity-40"><option value="">Todos los diseños</option><option value="extra">Extra</option><option value="diseno_liga">Diseño de la liga</option><option value="personalizado">Yo mismo lo diseño</option><option value="diseno_oficial">Pintura oficial</option></select></label>
                <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Piloto listo</span><select value={registrationReadyFilter} onChange={event => setRegistrationReadyFilter(event.target.value)} disabled={!registrationChampionshipFilter} className="input-field mt-2 disabled:cursor-not-allowed disabled:opacity-40"><option value="">Todos</option><option value="ready">Pilotos listos</option><option value="pending">Pilotos pendientes</option></select></label>
                <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-gray-500">Buscar piloto</span><span className="relative mt-2 block"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"/><input value={registrationSearch} onChange={event => setRegistrationSearch(event.target.value)} disabled={!registrationChampionshipFilter} className="input-field pl-10 disabled:cursor-not-allowed disabled:opacity-40" placeholder="Piloto, número, auto..."/></span></label>
              </div>
              {registrationMessage ? <div className="mt-3 border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">{registrationMessage}</div> : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] text-sm">
                <thead><tr className="border-b border-racing-border bg-racing-dark">
                  <th className="px-3 py-2 text-center text-xs uppercase text-gray-400">Piloto listo</th>
                  <th className="w-[112px] px-2 py-2 text-center text-xs uppercase text-gray-400">Nº</th>
                  <th className="w-[240px] px-3 py-2 text-left text-xs uppercase text-gray-400">Piloto</th>
                  <th className="w-[250px] px-2 py-2 text-left text-xs uppercase text-gray-400">Auto</th>
                  <th className="w-[280px] px-2 py-2 text-left text-xs uppercase text-gray-400">Diseño elegido</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-gray-400">Total a abonar</th>
                  <th className="px-3 py-2 text-center text-xs uppercase text-gray-400">Pago</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-gray-400">Acción</th>
                </tr></thead>
                <tbody className="divide-y divide-racing-border">
                  {displayedRegistrations.length ? displayedRegistrations.map(registration => {
                    const registrationKey = `${registration.idcampeonato}-${registration.idpiloto}`;
                    const registeredCar = cars.find(car => String(car.id) === String(registration.idauto));
                    const edit = registrationEdits[registrationKey] || {
                      idcampeonato: registration.idcampeonato,
                      idpiloto: registration.idpiloto,
                      idmarca: String(registration.idmarca || registeredCar?.idmarca || ''),
                      idauto: String(registration.idauto || ''),
                      numero: String(registration.numero ?? ''),
                      pago: Boolean(registration.pago),
                      listo: Boolean(registration.listo),
                      plan_id: getRegistrationPlanId(registration),
                      idauto_oficial: String(registration.idauto_oficial || ''),
                    };
                    const availableCars = cars.filter(car =>
                      String(car.idcategoria) === String(registration.idcategoria)
                      && enabledRegistrationCarIds.has(String(car.id)));
                    const availableBrands = [...new Map(availableCars.map(car => [String(car.idmarca), {
                      id: car.idmarca,
                      marca: car.marca,
                      logo: car.logo,
                    }])).values()].sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es-AR', { sensitivity: 'base' }));
                    const availableModels = availableCars
                      .filter(car => String(car.idmarca) === String(edit.idmarca))
                      .sort((a, b) => String(a.modelo).localeCompare(String(b.modelo), 'es-AR', { sensitivity: 'base' }));
                    const selectedBrand = availableBrands.find(brand => String(brand.id) === String(edit.idmarca));
                    const isDirty = Boolean(registrationEdits[registrationKey]);
                    const isEditingNumber = Boolean(editingRegistrationNumbers[registrationKey]);
                    const numberAvailability = registrationNumberAvailability[registrationKey];
                    const selectedPlan = enabledRegistrationPlans.find(plan => plan.id === edit.plan_id);
                    const isExtraPlan = edit.plan_id === 'extra';
                    const isOfficialPlan = edit.plan_id === 'diseno_oficial';
                    const isLeagueDesignPlan = edit.plan_id === 'diseno_liga';
                    const isOwnDesignPlan = edit.plan_id === 'personalizado';
                    const selectedOfficialCar = enabledRegistrationOfficialCars.find(car => String(car.id) === String(edit.idauto_oficial));
                    const amountDue = selectedPlan
                      ? Number(selectedRegistrationConfig?.precio || 0) + Number(selectedPlan.precio_adicional || 0)
                      : registration.total_abonar ?? registration.precio_inscripcion;

                    const isSelectedDriver = String(selectedRegistrationDriverId) === String(registration.idpiloto);

                    return <tr key={registrationKey} className={`${!edit.pago ? 'bg-yellow-400/[0.09] shadow-[inset_4px_0_0_#facc15]' : isSelectedDriver ? 'bg-racing-red/10 shadow-[inset_3px_0_0_#e63946]' : isDirty ? 'bg-cyan-400/[0.04]' : ''} transition-colors hover:bg-racing-card/60`}>
                      <td className="px-3 py-1.5 text-center">
                        <label className={`inline-flex cursor-pointer items-center gap-2 border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${edit.listo ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-gray-700 bg-black/20 text-gray-500 hover:border-gray-500'}`}>
                          <input type="checkbox" checked={edit.listo} onChange={event => handleRegistrationEdit(registration, 'listo', event.target.checked)} className="h-4 w-4 accent-violet-500"/>
                          {edit.listo ? 'Listo' : 'Pendiente'}
                        </label>
                      </td>
                      <td className="w-[112px] min-w-[112px] px-2 py-1.5 align-middle">
                        {isExtraPlan || isOfficialPlan ? (
                          <span className="font-anton flex h-10 w-full items-center justify-center text-center text-3xl leading-none text-yellow-300">
                            {isExtraPlan ? 'EXTRA' : (edit.numero || '—')}
                          </span>
                        ) : isEditingNumber ? (
                          <div className="relative flex min-h-10 w-full items-center justify-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="1"
                                max="255"
                                value={edit.numero}
                                onChange={event => handleRegistrationEdit(registration, 'numero', event.target.value)}
                                onBlur={() => validateAdminRegistrationNumber(registration, edit.numero)}
                                className={`input-field font-anton w-16 px-1 py-1.5 text-center text-xl text-yellow-300 ${numberAvailability?.available === false ? 'border-red-500' : numberAvailability?.available === true ? 'border-green-500' : ''}`}
                                aria-label={`Número de ${registration.nombre}`}
                                autoFocus
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingRegistrationNumbers(current => ({ ...current, [registrationKey]: false }))}
                              className="absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-racing-border text-gray-400 hover:border-yellow-300 hover:text-yellow-300"
                              aria-label="Cerrar edición del número"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                            {numberAvailability ? <p className={`absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 border border-racing-border bg-racing-dark px-2 py-1 text-center text-[9px] font-semibold leading-tight shadow-lg ${numberAvailability.checking ? 'text-gray-400' : numberAvailability.available ? 'text-green-400' : 'text-red-400'}`}>
                              {numberAvailability.checking ? 'Comprobando...' : numberAvailability.message}
                            </p> : null}
                          </div>
                        ) : (
                          <div className="relative flex h-10 w-full items-center justify-center">
                            <span className="font-anton w-14 text-center text-3xl leading-none text-yellow-300">
                              {edit.numero || '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingRegistrationNumbers(current => ({ ...current, [registrationKey]: true }))}
                              className="absolute right-0 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-gray-500 hover:text-yellow-300"
                              aria-label={`Editar número de ${registration.nombre}`}
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="w-[240px] min-w-[240px] px-3 py-1.5"><button type="button" onClick={() => selectRegistrationDriverDetails(registration)} className={`text-left text-base font-semibold italic underline-offset-4 transition hover:text-racing-red hover:underline ${isSelectedDriver ? 'text-racing-red' : 'text-white'}`}>{registration.nombre}</button></td>
                      <td className="w-[250px] px-2 py-1.5">
                        {isOfficialPlan ? <div className="w-[220px] border-l-2 border-sky-400 bg-sky-400/[0.07] px-2 py-1.5">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-sky-300">Pintura oficial</span>
                          <span className="block truncate font-semibold text-white">
                            {selectedOfficialCar ? `${selectedOfficialCar.marca} ${selectedOfficialCar.modelo}` : 'Seleccioná una pintura oficial'}
                          </span>
                        </div> : <div className="grid w-[250px] grid-cols-2 gap-1">
                          <div className="flex min-w-0 items-center gap-2">
                            {selectedBrand?.logo ? <img src={selectedBrand.logo} alt="" className="h-8 w-10 shrink-0 object-contain" /> : null}
                            <select
                              value={edit.idmarca}
                              onChange={event => handleRegistrationEdit(registration, 'idmarca', event.target.value)}
                              className="input-field min-w-0 flex-1 px-2 py-1.5 text-xs"
                              aria-label={`Marca de ${registration.nombre}`}
                            >
                              <option value="">Seleccionar marca</option>
                              {availableBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.marca}</option>)}
                            </select>
                          </div>
                          <select
                            value={edit.idauto}
                            onChange={event => handleRegistrationEdit(registration, 'idauto', event.target.value)}
                            className="input-field min-w-0 px-2 py-1.5 text-xs"
                            disabled={!edit.idmarca}
                            aria-label={`Modelo de ${registration.nombre}`}
                          >
                            <option value="">Seleccionar modelo</option>
                            {availableModels.map(car => <option key={car.id} value={car.id}>{car.modelo}</option>)}
                          </select>
                        </div>}
                      </td>
                      <td className="w-[280px] px-2 py-1.5">
                        <div className={`grid w-[280px] gap-1 border-l-2 pl-2 ${isOfficialPlan ? 'grid-cols-2 border-sky-400 bg-sky-400/[0.07]' : isLeagueDesignPlan ? 'grid-cols-1 border-violet-400 bg-violet-500/[0.06]' : isOwnDesignPlan ? 'grid-cols-1 border-cyan-400 bg-cyan-500/[0.06]' : 'grid-cols-1 border-gray-700'}`}>
                          <select
                            value={edit.plan_id}
                            onChange={event => handleRegistrationPlanChange(registration, event.target.value)}
                            className="input-field min-w-0 px-2 py-1.5 text-xs"
                            aria-label={`Tipo de diseño de ${registration.nombre}`}
                          >
                            <option value="">Seleccionar plan</option>
                            {enabledRegistrationPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.titulo}</option>)}
                          </select>
                          {isOfficialPlan ? <select
                            value={edit.idauto_oficial}
                            onChange={event => handleRegistrationOfficialCarChange(registration, event.target.value)}
                            className="input-field min-w-0 px-2 py-1.5 text-xs"
                            aria-label={`Pintura oficial de ${registration.nombre}`}
                          >
                            <option value="">Seleccionar pintura oficial</option>
                            {enabledRegistrationOfficialCars.map(officialCar => {
                              const isCurrent = String(officialCar.id) === String(edit.idauto_oficial);
                              return <option key={officialCar.id} value={officialCar.id} disabled={officialCar.ocupado && !isCurrent}>
                                {officialCar.marca} {officialCar.modelo} #{officialCar.numero} · {officialCar.descripcion}{officialCar.ocupado && !isCurrent ? ' (ocupado)' : ''}
                              </option>;
                            })}
                          </select> : null}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {amountDue !== null && amountDue !== undefined ? <strong className="whitespace-nowrap font-racing text-xl font-bold text-green-400">{formatPrice(amountDue)}</strong> : <span className="text-xs text-gray-600">Sin definir</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <label className={`inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs font-bold uppercase ${edit.pago ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-300'}`}>
                          <input
                            type="checkbox"
                            checked={edit.pago}
                            onChange={event => handleRegistrationEdit(registration, 'pago', event.target.checked)}
                            className="h-4 w-4 accent-green-500"
                          />
                          {edit.pago ? 'Pagado' : 'Pendiente'}
                        </label>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button type="button" onClick={() => handleDeleteRegistration(registration)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar inscripción">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>;
                  }) : (
                    <tr><td colSpan="8" className="px-4 py-12 text-center text-gray-500">{registrationChampionshipFilter ? 'No hay inscripciones que coincidan con los filtros.' : 'Seleccioná un campeonato para ver y gestionar sus pilotos.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    if (activeSection === 'marcas') {
      return (
        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-[420px_1fr]">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-racing text-2xl font-bold">{editingCarBrandId ? 'Modificar marca' : 'Agregar marca'}</h2>
              {editingCarBrandId ? (
                <button type="button" onClick={resetCarBrandForm} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Cancelar edición">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleCarBrandSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Nombre de la marca</span>
                <input name="marca" value={carBrandForm.marca} onChange={handleCarBrandFormChange} className="input-field mt-2" placeholder="Mercedes-Benz" required />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Logo</span>
                <div className="mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4">
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">{carBrandLogoFile?.name || (editingCarBrandId ? 'Se conservará el logo actual' : 'PNG, JPG, WEBP o AVIF hasta 5 MB')}</span>
                  </div>
                  <input
                    ref={carBrandLogoInputRef}
                    type="file"
                    accept="image/avif,image/webp,image/jpeg,image/png"
                    required={!editingCarBrandId}
                    onChange={event => {
                      setCarBrandLogoFile(event.target.files?.[0] ?? null);
                      setCarBrandLogoCrop(defaultCropSettings);
                    }}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark"
                  />
                  <SquareCropEditor file={carBrandLogoFile} settings={carBrandLogoCrop} onChange={setCarBrandLogoCrop} label="Recorte del logo de la marca" />
                </div>
              </label>

              {carBrandMessage ? <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">{carBrandMessage}</div> : null}
              <button type="submit" className="btn-primary w-full justify-center" disabled={savingCarBrand}>
                {savingCarBrand ? 'Guardando...' : editingCarBrandId ? 'Actualizar marca' : 'Guardar marca'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-center gap-3"><h2 className="font-racing text-2xl font-bold">Marcas cargadas</h2><ClearFiltersButton active={Boolean(carBrandSearch)} onClick={() => setCarBrandSearch('')} /></div>
                <div className="relative w-full xl:max-w-md">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input value={carBrandSearch} onChange={event => setCarBrandSearch(event.target.value)} className="input-field pl-10" placeholder="Buscar marca..." />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-racing-border bg-racing-dark">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Logo</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Marca</th>
                  <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                </tr></thead>
                <tbody className="divide-y divide-racing-border">
                  {displayedCarBrands.length ? displayedCarBrands.map(brand => (
                    <tr key={brand.id} className="hover:bg-racing-card/60">
                      <td className="px-4 py-3"><img src={brand.logo} alt={`Logo ${brand.marca}`} className="h-12 w-20 object-contain" /></td>
                      <td className="px-4 py-3 font-racing text-base text-white">{brand.marca}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button type="button" onClick={() => handleEditCarBrand(brand)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Editar marca"><PencilSquareIcon className="h-4 w-4" /></button>
                          <button type="button" onClick={() => handleDeleteCarBrand(brand.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar marca"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="px-4 py-10 text-center text-gray-500">{carBrands.length ? 'No hay marcas que coincidan con la búsqueda.' : 'Todavía no hay marcas cargadas.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    if (activeSection === 'autos') {
      return (
        <div className="grid grid-cols-1 2xl:grid-cols-[460px_1fr] gap-8">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-racing text-2xl font-bold">{editingCarId ? 'Modificar auto' : 'Agregar auto'}</h2>
              {editingCarId ? (
                <button
                  type="button"
                  onClick={resetCarForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                  aria-label="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleCarSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Categoría</span>
                <select name="idcategoria" value={carForm.idcategoria} onChange={handleCarChange} className="input-field mt-2" required>
                  <option value="">Seleccionar categoría</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.categoria}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-300">Marca</span>
                  <div className="relative mt-2">
                    {carForm.marca && carBrands.find(brand => String(brand.id) === String(carForm.marca))?.logo ? (
                      <img
                        src={carBrands.find(brand => String(brand.id) === String(carForm.marca)).logo}
                        alt=""
                        className="pointer-events-none absolute left-3 top-1/2 h-7 w-8 -translate-y-1/2 object-contain"
                      />
                    ) : null}
                    <select
                      name="marca"
                      value={carForm.marca}
                      onChange={handleCarChange}
                      className={`input-field ${carForm.marca ? 'pl-12' : ''}`}
                      required
                    >
                      <option value="">Seleccionar marca</option>
                      {carBrands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.marca}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Modelo</span>
                  <input name="modelo" value={carForm.modelo} onChange={handleCarChange} className="input-field mt-2" placeholder="Corolla" required />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">Imagen del auto</span>
                <div className="mt-2 rounded-lg border border-dashed border-racing-border bg-racing-dark p-4">
                  <div className="flex items-center gap-3 text-gray-400">
                    <PhotoIcon className="h-6 w-6 text-racing-red" />
                    <span className="text-sm">{carImageFile?.name || 'Imagen en tamaño final, sin recorte'}</span>
                  </div>
                  <input
                    ref={carImageInputRef}
                    type="file"
                    accept="image/avif,image/webp,image/jpeg,image/png"
                    onChange={event => setCarImageFile(event.target.files?.[0] ?? null)}
                    className="mt-4 block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-racing-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-racing-red-dark"
                  />
                </div>
              </label>

              {carMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {carMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingCar}>
                {savingCar ? 'Guardando...' : editingCarId ? 'Actualizar auto' : 'Guardar auto'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-racing text-2xl font-bold">Autos cargados</h2>
                  <p className="mt-1 text-sm text-gray-400">{displayedCars.length} auto{displayedCars.length === 1 ? '' : 's'} encontrado{displayedCars.length === 1 ? '' : 's'}</p>
                  </div>
                  <ClearFiltersButton active={Boolean(carCategoryFilter || carBrandFilter || carSearch)} onClick={() => { setCarCategoryFilter(''); setCarBrandFilter(''); setCarSearch(''); }} />
                </div>
                <div className="grid w-full gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Categoría</span>
                    <select
                      value={carCategoryFilter}
                      onChange={event => {
                        setCarCategoryFilter(event.target.value);
                        setCarBrandFilter('');
                      }}
                      className="input-field mt-2"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map(category => <option key={category.id} value={category.id}>{category.categoria}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Marca</span>
                    <select value={carBrandFilter} onChange={event => setCarBrandFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todas las marcas</option>
                      {carBrands
                        .filter(brand => !carCategoryFilter || cars.some(car => (
                          String(car.idcategoria) === String(carCategoryFilter)
                          && String(car.idmarca) === String(brand.id)
                        )))
                        .map(brand => <option key={brand.id} value={brand.id}>{brand.marca}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={carSearch}
                        onChange={event => setCarSearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Categoría, marca, modelo..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Imagen</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Marca</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Modelo</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {paginatedCars.length > 0 ? (
                    paginatedCars.map(car => (
                      <tr key={car.id} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3">
                          {car.imagen ? (
                            <img src={car.imagen} alt={`${car.marca} ${car.modelo}`} className="h-12 w-24 rounded object-cover" />
                          ) : (
                            <div className="flex h-12 w-24 items-center justify-center rounded bg-racing-dark text-xs text-gray-500">Sin imagen</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{car.categoria}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {car.logo ? (
                              <img src={car.logo} alt={`Logo ${car.marca}`} className="h-10 w-12 object-contain" />
                            ) : (
                              <div className="flex h-10 w-12 items-center justify-center bg-racing-dark text-[10px] text-gray-500">Sin logo</div>
                            )}
                            <span className="font-racing text-base text-white">{car.marca}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{car.modelo}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditCar(car)}
                              aria-label="Editar auto"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteCar(car.id)}
                              aria-label="Eliminar auto"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-gray-500">
                        {cars.length ? 'No hay autos que coincidan con la búsqueda.' : 'Todavía no hay autos cargados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {displayedCars.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-racing-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-400">
                  Mostrando {(carPage - 1) * adminPageSize + 1}-{Math.min(carPage * adminPageSize, displayedCars.length)} de {displayedCars.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCarPage(current => Math.max(1, current - 1))}
                    disabled={carPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Página anterior de autos"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="min-w-24 text-center font-racing text-sm font-bold text-white">Página {carPage} de {carPageCount}</span>
                  <button
                    type="button"
                    onClick={() => setCarPage(current => Math.min(carPageCount, current + 1))}
                    disabled={carPage === carPageCount}
                    className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Página siguiente de autos"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      );
    }

    if (activeSection === 'fechas') {
      return (
        <div className="space-y-8">
          <section className="card-glass p-6">
            <h2 className="font-racing text-2xl font-bold">Crear calendario del campeonato</h2>

            <form onSubmit={handleEventBatchSubmit} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_140px_180px_100px_100px_auto] xl:items-end">
                <label className="block">
                  <span className="text-sm text-gray-300">Campeonato</span>
                  <select
                    value={eventBatch.idcampeonato}
                    onChange={event => {
                      setEventBatch(current => ({ ...current, idcampeonato: event.target.value }));
                      setEventBatchRows([]);
                    }}
                    className="input-field mt-2"
                    required
                  >
                  <option value="">Seleccionar campeonato</option>
                  {!championshipsWithoutEvents.length ? (
                    <option value="" disabled>Todos los campeonatos ya tienen fechas asignadas</option>
                  ) : null}
                  {championshipsWithoutEvents.map(championship => (
                    <option key={championship.id} value={championship.id}>
                      {championship.categoria} - Temporada {championship.temporada} ({championship.anio})
                    </option>
                  ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Cantidad de fechas</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={eventBatch.cantidad}
                    onChange={event => {
                      setEventBatch(current => ({ ...current, cantidad: event.target.value }));
                      setEventBatchRows([]);
                    }}
                    className="input-field mt-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Primera fecha</span>
                  <input
                    type="date"
                    value={eventBatch.primeraFecha}
                    onChange={event => {
                      setEventBatch(current => ({ ...current, primeraFecha: event.target.value }));
                      setEventBatchRows([]);
                    }}
                    className="input-field mt-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Hora</span>
                  <select value={eventBatch.hora} onChange={event => setEventBatch(current => ({ ...current, hora: event.target.value }))} className="input-field mt-2">
                    <option value="21">21 H</option>
                    <option value="22">22 H</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Minutos</span>
                  <select value={eventBatch.minuto} onChange={event => setEventBatch(current => ({ ...current, minuto: event.target.value }))} className="input-field mt-2">
                    {eventMinuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}
                  </select>
                </label>
                <button type="button" onClick={handleGenerateEventBatch} className="btn-secondary h-[46px] justify-center">
                  Generar fechas
                </button>
              </div>

              {eventBatchRows.length ? (
                <div className="space-y-3">
                  {eventBatchRows.map((row, index) => (
                    <div key={row.ronda} className="border border-racing-border bg-racing-dark/70 p-4">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[80px_170px_88px_88px_minmax(240px,1fr)] lg:items-end">
                        <div>
                          <span className="text-xs uppercase text-gray-500">Ronda</span>
                          <p className="mt-2 font-racing text-2xl font-bold text-racing-red">{row.ronda}</p>
                        </div>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Fecha</span>
                          <input
                            type="date"
                            value={getEventDatePart(row.fecha)}
                            onChange={event => handleEventBatchRowChange(index, 'fecha', buildEventDateTime(event.target.value, getEventHourPart(row.fecha), getEventMinutePart(row.fecha)))}
                            className="input-field mt-2"
                            required
                          />
                        </label>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Hora</span>
                          <select value={getEventHourPart(row.fecha)} onChange={event => handleEventBatchRowChange(index, 'fecha', buildEventDateTime(getEventDatePart(row.fecha), event.target.value, getEventMinutePart(row.fecha)))} className="input-field mt-2 px-3">
                            <option value="21">21 H</option>
                            <option value="22">22 H</option>
                          </select>
                        </label>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Min.</span>
                          <select value={getEventMinutePart(row.fecha)} onChange={event => handleEventBatchRowChange(index, 'fecha', buildEventDateTime(getEventDatePart(row.fecha), getEventHourPart(row.fecha), event.target.value))} className="input-field mt-2 px-3">
                            {eventMinuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}
                          </select>
                        </label>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Circuito</span>
                          <select value={row.idcircuito} onChange={event => handleEventBatchRowChange(index, 'idcircuito', event.target.value)} className="input-field mt-2" required>
                            <option value="">Seleccionar circuito</option>
                            {circuits.map(circuit => (
                              <option key={circuit.id} value={circuit.id}>
                                {circuit.nombre}{circuit.variante ? ` (${circuit.variante})` : ''} - {[circuit.localidad, circuit.provincia].filter(Boolean).join(', ')}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[150px_150px_minmax(180px,0.7fr)_minmax(260px,1fr)] lg:items-end">
                        <label className="flex h-[46px] items-center gap-3 border border-racing-border px-3 text-sm text-gray-300">
                          <input type="checkbox" checked={row.especial} onChange={event => handleEventBatchRowChange(index, 'especial', event.target.checked)} className="h-4 w-4 accent-racing-red" />
                          Especial
                        </label>
                        <label className="flex h-[46px] items-center gap-3 border border-racing-border px-3 text-sm text-gray-300">
                          <input type="checkbox" checked={row.coronacion} onChange={event => handleEventBatchRowChange(index, 'coronacion', event.target.checked)} className="h-4 w-4 accent-racing-red" />
                          Coronación
                        </label>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Especialidad</span>
                          <input value={row.especialidad} onChange={event => handleEventBatchRowChange(index, 'especialidad', event.target.value)} disabled={!row.especial} className="input-field mt-2 uppercase disabled:opacity-40" placeholder="INVITADOS" />
                        </label>
                        <label>
                          <span className="text-xs uppercase text-gray-500">Transmisión</span>
                          <input type="url" value={row.transmision} onChange={event => handleEventBatchRowChange(index, 'transmision', event.target.value)} className="input-field mt-2" placeholder="https://www.youtube.com/..." />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {eventMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {eventMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingEvent}>
                {savingEvent ? 'Guardando calendario...' : `Guardar ${eventBatchRows.length || ''} fechas`}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-racing text-2xl font-bold">Fechas cargadas</h2>
                  <p className="mt-1 text-sm text-gray-400">{displayedEvents.length} fecha{displayedEvents.length === 1 ? '' : 's'}</p>
                  </div>
                  <ClearFiltersButton active={Boolean(eventChampionshipFilter || eventCircuitFilter || eventDateFrom || eventDateTo || eventSearch)} onClick={() => { setEventChampionshipFilter(''); setEventCircuitFilter(''); setEventDateFrom(''); setEventDateTo(''); setEventSearch(''); }} />
                </div>
                <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Campeonato</span>
                    <select value={eventChampionshipFilter} onChange={event => setEventChampionshipFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todos los campeonatos</option>
                      {championships.map(championship => <option key={championship.id} value={championship.id}>{championship.categoria} · T{championship.temporada} · {championship.anio}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Autódromo</span>
                    <select value={eventCircuitFilter} onChange={event => setEventCircuitFilter(event.target.value)} className="input-field mt-2">
                      <option value="">Todos los autódromos</option>
                      {circuits.map(circuit => <option key={circuit.id} value={circuit.id}>{circuit.nombre}{circuit.variante ? ` · ${circuit.variante}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Desde</span>
                    <input type="date" value={eventDateFrom} onChange={event => setEventDateFrom(event.target.value)} className="input-field mt-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Hasta</span>
                    <input type="date" value={eventDateTo} min={eventDateFrom || undefined} onChange={event => setEventDateTo(event.target.value)} className="input-field mt-2" />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={eventSearch}
                        onChange={event => setEventSearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Campeonato, circuito, especialidad..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">
                      <button
                        type="button"
                        onClick={() => handleEventSort('fecha')}
                        className="inline-flex items-center gap-2 rounded text-left uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Fecha
                        <span className="text-racing-red">{eventSort === 'fecha' ? (eventSortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Campeonato</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Ronda</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">
                      <button
                        type="button"
                        onClick={() => handleEventSort('circuito')}
                        className="inline-flex items-center gap-2 rounded text-left uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Circuito
                        <span className="text-racing-red">{eventSort === 'circuito' ? (eventSortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Transmisión</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {paginatedEvents.length > 0 ? (
                    paginatedEvents.map(event => (
                      <tr key={`${event.idcampeonato}-${event.ronda}`} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3 text-gray-300">{formatEventDateTime(event.fecha)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {event.categoria_logo ? (
                              <img src={event.categoria_logo} alt={event.categoria} className="h-8 w-10 object-contain" />
                            ) : null}
                            <span className="font-racing text-base text-white">
                              {event.categoria} T{event.temporada} ({event.anio})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">R{event.ronda}</td>
                        <td className="px-4 py-3 text-gray-300">
                          <span className="font-medium text-white">{event.circuito}</span>
                          {event.variante ? (
                            <span className="mt-0.5 block text-xs uppercase text-racing-red">{event.variante}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          <div className="flex flex-wrap gap-2">
                            {event.especial ? <span className="badge-active">{event.especialidad || 'ESPECIAL'}</span> : null}
                            {event.coronacion ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/15 px-3 py-1 text-xs font-semibold text-yellow-300">
                                <TrophyIcon className="h-3.5 w-3.5" />
                                CORONACIÓN
                              </span>
                            ) : null}
                            {!event.especial && !event.coronacion ? '-' : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {event.transmision ? (
                            <a
                              href={event.transmision}
                              target="_blank"
                              rel="noreferrer"
                              className="relative z-10 inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs font-bold uppercase text-red-300 transition-colors hover:border-red-400 hover:bg-red-600 hover:text-white"
                            >
                              <PlayCircleIcon className="h-4 w-4" />
                              Ver transmisión
                            </a>
                          ) : '-'}
                        </td>
                        <td className="relative px-4 py-3 text-right">
                          {event.pais ? (
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-56 overflow-hidden opacity-20 [mask-image:linear-gradient(to_left,black_15%,transparent_100%)]">
                              <CountryFlag country={event.pais} className="!absolute !inset-0 !h-full !w-full [background-position:center] [background-size:cover]" />
                            </div>
                          ) : null}
                          <div className="relative z-10 inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditEvent(event)}
                              aria-label="Editar fecha"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteEvent(event)}
                              aria-label="Eliminar fecha"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-10 text-center text-gray-500">
                        {events.length ? 'No hay fechas que coincidan con la búsqueda.' : 'Todavía no hay fechas cargadas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination page={eventPage} pageCount={eventPageCount} total={displayedEvents.length} onPageChange={setEventPage} />
          </section>

          {editingEventKey ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={resetEventForm}>
              <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto border border-racing-border bg-racing-gray p-5 shadow-2xl sm:p-6" onMouseDown={event => event.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Edición individual</p>
                    <h2 className="mt-1 font-racing text-2xl font-bold">Modificar fecha</h2>
                  </div>
                  <button type="button" onClick={resetEventForm} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red" aria-label="Cerrar">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleEventSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                    <label>
                      <span className="text-sm text-gray-300">Campeonato</span>
                      <select name="idcampeonato" value={eventForm.idcampeonato} onChange={handleEventChange} className="input-field mt-2" required>
                        {championships.map(championship => <option key={championship.id} value={championship.id}>{championship.categoria} - Temporada {championship.temporada} ({championship.anio})</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-sm text-gray-300">Ronda</span>
                      <input name="ronda" type="number" min="1" value={eventForm.ronda} onChange={handleEventChange} className="input-field mt-2" required />
                    </label>
                  </div>
                  <div>
                    <span className="text-sm text-gray-300">Fecha y hora</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_100px]">
                      <input type="date" value={getEventDatePart(eventForm.fecha)} onChange={handleEventDatePartChange} className="input-field" required />
                      <select value={getEventHourPart(eventForm.fecha)} onChange={handleEventHourChange} className="input-field px-3"><option value="21">21 H</option><option value="22">22 H</option></select>
                      <select value={getEventMinutePart(eventForm.fecha)} onChange={handleEventMinuteChange} className="input-field px-3">{eventMinuteOptions.map(minute => <option key={minute} value={minute}>{minute}</option>)}</select>
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-sm text-gray-300">Circuito</span>
                    <select name="idcircuito" value={eventForm.idcircuito} onChange={handleEventChange} className="input-field mt-2" required>
                      {circuits.map(circuit => <option key={circuit.id} value={circuit.id}>{circuit.nombre}{circuit.variante ? ` (${circuit.variante})` : ''}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300"><input name="especial" type="checkbox" checked={eventForm.especial} onChange={handleEventChange} className="h-4 w-4 accent-racing-red" />Fecha especial</label>
                    <label className="flex items-center gap-3 border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300"><input name="coronacion" type="checkbox" checked={eventForm.coronacion} onChange={handleEventChange} className="h-4 w-4 accent-racing-red" />Coronación</label>
                  </div>
                  {eventForm.especial ? <label className="block"><span className="text-sm text-gray-300">Especialidad</span><input name="especialidad" value={eventForm.especialidad} onChange={handleEventChange} className="input-field mt-2 uppercase" required /></label> : null}
                  <label className="block"><span className="text-sm text-gray-300">Enlace de la transmisión</span><input name="transmision" type="url" value={eventForm.transmision} onChange={handleEventChange} className="input-field mt-2" placeholder="https://www.youtube.com/watch?v=..." /></label>
                  {eventMessage ? <div className="border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">{eventMessage}</div> : null}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={resetEventForm} className="btn-secondary justify-center">Cancelar</button>
                    <button type="submit" className="btn-primary justify-center" disabled={savingEvent}>{savingEvent ? 'Guardando...' : 'Actualizar fecha'}</button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeSection === 'pilotos') {
      return (
        <div className="grid grid-cols-1 2xl:grid-cols-[460px_1fr] gap-8">
          <section className="card-glass p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-racing text-2xl font-bold">{editingDriverId ? 'Modificar piloto' : 'Agregar piloto'}</h2>
              {editingDriverId ? (
                <button
                  type="button"
                  onClick={resetDriverForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                  aria-label="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <form onSubmit={handleDriverSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-300">Nombre</span>
                <input
                  name="nombre"
                  value={driverForm.nombre}
                  onChange={handleDriverChange}
                  onBlur={alertDriverDuplicate}
                  className={`input-field mt-2 ${driverDuplicate?.fields.includes('el nombre') ? 'border-red-500' : ''}`}
                  placeholder="Federico Cabello"
                  required
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-300">Localidad</span>
                  <div className="relative mt-2">
                    <input
                      name="localidad"
                      value={driverForm.localidad}
                      onChange={event => {
                        handleDriverChange(event);
                        setShowDriverLocalitySuggestions(true);
                      }}
                      onFocus={() => setShowDriverLocalitySuggestions(true)}
                      className={`input-field ${lockedDriverLocality ? 'cursor-not-allowed opacity-80' : ''}`}
                      placeholder="San Rafael"
                      readOnly={lockedDriverLocality}
                      autoComplete="off"
                    />
                    {showDriverLocalitySuggestions && driverLocalitySuggestions.length > 0 ? (
                      <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-racing-border bg-racing-gray shadow-racing">
                        {driverLocalitySuggestions.map(locality => (
                          <button
                            key={`${locality.localidad}-${locality.provincia}`}
                            type="button"
                            onClick={() => handleSelectDriverLocality(locality)}
                            className="block w-full px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:bg-racing-red/15 hover:text-white"
                          >
                            <span className="font-racing text-base text-white">{locality.localidad}</span>
                            {locality.provincia ? <span className="block text-xs text-gray-500">{locality.provincia}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {lockedDriverLocality ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLockedDriverLocality(false);
                        setShowDriverLocalitySuggestions(true);
                      }}
                      className="mt-2 text-xs text-racing-red hover:text-white"
                    >
                      Cambiar localidad
                    </button>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Provincia</span>
                  <input name="provincia" value={driverForm.provincia} onChange={handleDriverChange} className="input-field mt-2" placeholder="Mendoza" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-300">Nacionalidad</span>
                  <CountrySelect
                    value={driverForm.nacionalidad}
                    onChange={nacionalidad => setDriverForm(current => ({ ...current, nacionalidad }))}
                    options={driverCountries}
                    className="mt-2"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-gray-300">Teléfono</span>
                <input
                  name="telefono"
                  value={driverForm.telefono}
                  onChange={handleDriverChange}
                  onBlur={alertDriverDuplicate}
                  className={`input-field mt-2 ${driverDuplicate?.fields.includes('el teléfono') ? 'border-red-500' : ''}`}
                  inputMode="numeric"
                  placeholder="5492604659499"
                />
                <span className="mt-1 block text-xs text-gray-500">Se guardan solamente los dígitos.</span>
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Steam</span>
                <input name="steam" value={driverForm.steam} onChange={handleDriverChange} className="input-field mt-2" placeholder="Steam ID o usuario" />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Instagram</span>
                <input name="ig" value={driverForm.ig} onChange={handleDriverChange} className="input-field mt-2" placeholder="@usuario o enlace de Instagram" autoComplete="off" />
                <span className="mt-1 block text-xs text-gray-500">Usuario utilizado para etiquetar al piloto en las publicaciones.</span>
              </label>

              {driverDuplicate ? (
                <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  Ya existe <strong>{driverDuplicate.driver.nombre}</strong> con {driverDuplicate.fields.join(' y ')} ingresado.
                </div>
              ) : null}

              {driverMessage && (
                <div className="rounded-lg border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-gray-200">
                  {driverMessage}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={savingDriver}>
                {savingDriver ? 'Guardando...' : editingDriverId ? 'Actualizar piloto' : 'Guardar piloto'}
              </button>
            </form>
          </section>

          <section className="card-glass overflow-hidden">
            <div className="border-b border-racing-border px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-center gap-3"><h2 className="font-racing text-2xl font-bold">Pilotos cargados</h2><ClearFiltersButton active={Boolean(driverSearch)} onClick={() => setDriverSearch('')} /></div>
                <div className="w-full xl:max-w-xl">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Buscar</span>
                    <div className="relative mt-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      <input
                        value={driverSearch}
                        onChange={event => setDriverSearch(event.target.value)}
                        className="input-field pl-10"
                        placeholder="Nombre, provincia, teléfono..."
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Localidad</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Provincia</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Nacionalidad</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Steam</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-400">Instagram</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {paginatedDrivers.length > 0 ? (
                    paginatedDrivers.map(driver => (
                      <tr key={driver.id} className="hover:bg-racing-card/60">
                        <td className="px-4 py-3 font-racing text-base text-white">{driver.nombre}</td>
                        <td className="px-4 py-3 text-gray-300">{driver.localidad || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{driver.provincia || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{driver.telefono}</td>
                        <td className="px-4 py-3 text-gray-300">
                          <span className="flex items-center gap-2">
                            <CountryFlag country={driver.nacionalidad} className="text-lg" />
                            {getCountryName(driver.nacionalidad) || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{driver.steam}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {driver.ig ? <a href={getInstagramUrl(driver.ig)} target="_blank" rel="noreferrer" className="text-racing-red hover:text-white">{formatInstagramHandle(driver.ig)}</a> : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleEditDriver(driver)}
                              aria-label="Editar piloto"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-racing-border text-gray-400 hover:border-racing-red hover:text-racing-red"
                              onClick={() => handleDeleteDriver(driver.id)}
                              aria-label="Eliminar piloto"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center text-gray-500">
                        {drivers.length ? 'No hay pilotos que coincidan con la búsqueda.' : 'Todavía no hay pilotos cargados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination page={driverPage} pageCount={driverPageCount} total={displayedDrivers.length} onPageChange={setDriverPage} />
          </section>
        </div>
      );
    }

    const currentSection = adminSections.find(section => section.id === activeSection);

    return (
      <section className="card-glass p-8 text-center">
        <WrenchScrewdriverIcon className="mx-auto mb-4 h-12 w-12 text-racing-red" />
        <h2 className="font-racing text-3xl font-bold">{currentSection?.label}</h2>
        <p className="mx-auto mt-2 max-w-xl text-gray-400">
          Esta sección queda preparada para seguir cargando y editando datos desde el panel.
        </p>
      </section>
    );
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-racing-dark text-white flex items-center justify-center px-4">
        <div className="card-glass p-8 text-center max-w-xl">
          <ShieldCheckIcon className="w-14 h-14 mx-auto mb-4 text-racing-red" />
          <h1 className="font-racing text-3xl font-bold mb-2">Acceso administrador</h1>
          <p className="text-gray-400">Ingresá desde el logo de CADPO para validar la contraseña del administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-racing-dark text-white animate-fade-in">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <nav className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-[repeat(13,minmax(0,1fr))] xl:gap-1.5">
              {adminSections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-2 font-racing text-[10px] font-semibold transition-all 2xl:text-[11px] ${isActive
                      ? 'border-racing-red bg-racing-red text-white shadow-racing'
                      : 'border-racing-border bg-racing-card text-gray-300 hover:border-racing-red hover:text-white'
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </nav>

            <div key={activeSection} className="min-w-0">
              {renderSection()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
