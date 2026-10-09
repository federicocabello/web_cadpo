import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArchiveBoxIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
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
  RectangleStackIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { carBrandsApi, carsApi, categoriesApi, championshipsApi, circuitsApi, complaintsApi, driversApi, eventsApi, monitorApi, projectsApi, registrationFormsApi, registrationsApi, replaysApi, resultsApi, sponsorsApi, templatesApi } from '../services/api';
import { CountryFlag, CountrySelect } from '../components/CountryFlag';
import { circuitCountries, driverCountries, getCountryName, normalizeCountryCode } from '../data/countries';
import { formatCalendarDate, parseCalendarDate, toDateTimeInputValue } from '../utils/calendarDate';
import { formatInstagramHandle, getInstagramUrl } from '../utils/instagram';
import { formatPrice } from '../utils/currency';
import { aggregateAssettoSanctions, assettoSessionOptions, buildAssettoSanctionLabel, emptyAssettoSanction, getAssettoSanctionItems, normalizeAssettoDriverName, orderAssettoResults, parseAssettoResultJson } from '../utils/assettoResults';
import GearRatioCalculator from '../components/GearRatioCalculator';
import EnginePowerCalculator from '../components/EnginePowerCalculator';
import BrakesCalculator from '../components/BrakesCalculator';
import TyresCalculator from '../components/TyresCalculator';
import CadpoImporter from '../components/CadpoImporter';
import PollsAdmin from '../components/PollsAdmin';

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
  { id: 'importador', label: 'IMPORTADOR', icon: ArrowUpTrayIcon },
  { id: 'resultados', label: 'RESULTADOS', icon: TrophyIcon },
  { id: 'denuncias', label: 'DENUNCIAS', icon: ExclamationTriangleIcon },
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
  { id: 'sponsors', label: 'SPONSORS', icon: BuildingOffice2Icon },
  { id: 'proyectos', label: 'PROYECTOS', icon: RectangleStackIcon },
  { id: 'votaciones', label: 'VOTACIONES', icon: ChartBarIcon },
  { id: 'relaciones-caja', label: 'RELACIONES DE CAJA', icon: WrenchScrewdriverIcon },
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
  { key: 'pos_qualy_sprint', label: 'Pos. QS', type: 'position' },
  { key: 'pts_qualy_sprint', label: 'Pts. QS', type: 'integer' },
  { key: 'pos_qualy_final', label: 'Pos. QF', type: 'position' },
  { key: 'pts_qualy_final', label: 'Pts. QF', type: 'integer' },
  { key: 'pos_sprint', label: 'Pos. Sprint', type: 'position' },
  { key: 'piloto_sprint', label: 'Piloto', type: 'pilot' },
  { key: 'pts_sprint', label: 'Pts. Sprint', type: 'decimal' },
  { key: 'kg_sprint', label: 'KG Sprint', type: 'signed' },
  { key: 'pos_final', label: 'Pos. Final', type: 'position' },
  { key: 'piloto_final', label: 'Piloto', type: 'pilot' },
  { key: 'pts_final', label: 'Pts. Final', type: 'decimal' },
  { key: 'kg_final', label: 'KG Final', type: 'signed' },
];
const resultAchievementFields = [
  { key: 'pole_sprint', label: 'Pole Sprint' },
  { key: 'ganador_sprint', label: 'Ganó Sprint' },
  { key: 'pole_final', label: 'Pole Final' },
  { key: 'ganador_final', label: 'Ganó Final' },
];
const resultSanctionFields = [
  { key: 'desc_sancion_qualy_sprint', label: 'Clasificación Sprint' },
  { key: 'desc_sancion_sprint', label: 'Sprint' },
  { key: 'desc_sancion_qualy_final', label: 'Clasificación Final' },
  { key: 'desc_sancion_final', label: 'Final' },
];
const resultStructuredSanctionFields = [
  'rec_tiempo_sprint',
  'rec_pos_sprint',
  'aps_sprint',
  'kg_sancion_sprint',
  'rec_tiempo_final',
  'rec_pos_final',
  'aps_final',
  'kg_sancion_final',
];
const resultGridColumns = [
  { key: 'piloto', label: 'Piloto', type: 'pilot' },
  ...resultSpreadsheetColumns,
];
const resultScoringFields = [
  { positionField: 'pos_qualy_sprint', pointsField: 'pts_qualy_sprint', label: 'Clasificación Sprint', shortLabel: 'QS', integer: true },
  { positionField: 'pos_sprint', pointsField: 'pts_sprint', label: 'Sprint', shortLabel: 'S' },
  { positionField: 'pos_qualy_final', pointsField: 'pts_qualy_final', label: 'Clasificación Final', shortLabel: 'QF', integer: true },
  { positionField: 'pos_final', pointsField: 'pts_final', label: 'Final', shortLabel: 'F' },
];
const resultScoringByPosition = Object.fromEntries(resultScoringFields.map(field => [field.positionField, field]));
const toScoringInputValue = value => Number(value || 0) === 0 ? '' : String(value);
const parseNumericPosition = value => {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) && Number(normalized) > 0 ? Number(normalized) : null;
};
const normalizeResultPosition = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('es-AR');
const parseLapResultPosition = value => {
  const match = normalizeResultPosition(value).match(/^\(?\s*(\d+)\s*V(?:UELTAS?)?\s*\)?$/);
  return match ? Number(match[1]) : null;
};
const resultPositionStatusOrder = value => {
  const normalized = normalizeResultPosition(value);
  if (parseLapResultPosition(value) !== null) return 1;
  if (normalized === 'DQ' || normalized.includes('EXCLUSION')) return 2;
  if (normalized === 'S/TIEMPO' || normalized === 'SIN TIEMPO') return 3;
  if (normalized === 'NO LARGO') return 4;
  return 3;
};
const compareResultPositions = (a, b, field) => {
  const positionA = parseNumericPosition(a[field]);
  const positionB = parseNumericPosition(b[field]);
  if (positionA !== null && positionB !== null) return positionA - positionB;
  if (positionA !== null) return -1;
  if (positionB !== null) return 1;

  const statusOrderA = resultPositionStatusOrder(a[field]);
  const statusOrderB = resultPositionStatusOrder(b[field]);
  if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;

  const lapsA = parseLapResultPosition(a[field]);
  const lapsB = parseLapResultPosition(b[field]);
  if (lapsA !== null && lapsB !== null && lapsA !== lapsB) return lapsB - lapsA;

  const sheetPositionA = parseNumericPosition(a._sheetPosition);
  const sheetPositionB = parseNumericPosition(b._sheetPosition);
  if (sheetPositionA !== null || sheetPositionB !== null) {
    return (sheetPositionA || Number.MAX_SAFE_INTEGER) - (sheetPositionB || Number.MAX_SAFE_INTEGER);
  }
  return Number(a.id || 0) - Number(b.id || 0);
};

const buildEditableResultRows = rows => {
  const byRound = new Map();
  rows.forEach(result => {
    const roundKey = String(result.ronda);
    if (!byRound.has(roundKey)) byRound.set(roundKey, []);
    byRound.get(roundKey).push(result);
  });

  return [...byRound.values()].flatMap(roundRows => {
    const sortSession = field => [...roundRows].sort((a, b) => compareResultPositions(a, b, field));
    const baseRows = sortSession('pos_qualy_sprint');
    const sprintRows = sortSession('pos_sprint');
    const finalRows = sortSession('pos_final');

    return baseRows.map((result, index) => ({
      ...result,
      _sheetPosition: index + 1,
      piloto_sprint: sprintRows[index]?.piloto || '',
      pos_sprint: sprintRows[index]?.pos_sprint ?? '',
      pts_sprint: sprintRows[index]?.pts_sprint ?? '',
      kg_sprint: sprintRows[index]?.kg_sprint ?? '',
      rec_tiempo_sprint: sprintRows[index]?.rec_tiempo_sprint ?? 0,
      rec_pos_sprint: sprintRows[index]?.rec_pos_sprint ?? 0,
      aps_sprint: sprintRows[index]?.aps_sprint ?? 0,
      kg_sancion_sprint: sprintRows[index]?.kg_sancion_sprint ?? 0,
      desc_sancion_sprint: sprintRows[index]?.desc_sancion_sprint ?? '',
      _sanciones_detalle_sprint: parseResultSanctionDetails(sprintRows[index]?.sanciones_detalle).sprint || [],
      piloto_final: finalRows[index]?.piloto || '',
      pos_final: finalRows[index]?.pos_final ?? '',
      pts_final: finalRows[index]?.pts_final ?? '',
      kg_final: finalRows[index]?.kg_final ?? '',
      rec_tiempo_final: finalRows[index]?.rec_tiempo_final ?? 0,
      rec_pos_final: finalRows[index]?.rec_pos_final ?? 0,
      aps_final: finalRows[index]?.aps_final ?? 0,
      kg_sancion_final: finalRows[index]?.kg_sancion_final ?? 0,
      desc_sancion_final: finalRows[index]?.desc_sancion_final ?? '',
      _sanciones_detalle_final: parseResultSanctionDetails(finalRows[index]?.sanciones_detalle).final || [],
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
const parseResultSanctionDetails = value => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const formatResultBallast = value => {
  const ballast = parseResultPoints(value);
  if (ballast === 0) return '—';
  return `${ballast > 0 ? '+' : ''}${formatResultPoints(ballast)} kg`;
};
const getResultBallastClass = value => {
  const ballast = parseResultPoints(value);
  if (ballast < 0) return 'text-emerald-300';
  if (ballast > 0) return 'text-orange-300';
  return 'text-gray-600';
};

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
  regla_porcentaje: '0',
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
const emptySponsorForm = { empresa: '', descripcion: '', ubicacion: '', contacto: '', sitio: '', activo: true };
const emptyProjectForm = { tipo: 'categoria', titulo: '', descripcion: '', activo: true };
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
  visible: true,
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
  limites_por_modelo: {},
  pilotos_gratis: [],
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
const pendingCircuitValue = 'pending';
const isPendingCircuitName = value => String(value || '').trim().toLocaleUpperCase('es-AR') === 'A CONFIRMAR';
const serializeEventCircuit = value => value === pendingCircuitValue ? pendingCircuitValue : Number(value);

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

const loadCanvasImage = source => new Promise(resolve => {
  if (!source) {
    resolve(null);
    return;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = source;
});

const drawContainedCanvasImage = (context, image, x, y, width, height) => {
  if (!image?.width || !image?.height) return;
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const fitCanvasText = (context, value, maxWidth) => {
  const text = String(value || '');
  if (context.measureText(text).width <= maxWidth) return text;
  let fitted = text;
  while (fitted.length && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
  return fitted ? `${fitted}…` : '';
};

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

function AdminPagination({ page, pageCount, total, onPageChange, pageSize = adminPageSize }) {
  if (!total) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

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

const projectAdminPageSize = 5;

function AdminProjectList({ type, projects, onEdit, onDelete, onDeletePhoto }) {
  const [page, setPage] = useState(1);
  const [expandedGalleries, setExpandedGalleries] = useState({});
  const items = useMemo(() => projects.filter(project => project.tipo === type), [projects, type]);
  const pageCount = Math.max(1, Math.ceil(items.length / projectAdminPageSize));
  const safePage = Math.min(page, pageCount);
  const visibleItems = items.slice((safePage - 1) * projectAdminPageSize, safePage * projectAdminPageSize);
  const title = type === 'categoria' ? 'Categorías' : 'Circuitos';
  const Icon = type === 'categoria' ? TagIcon : FlagIcon;

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <section className="overflow-hidden border border-racing-border bg-racing-card/35">
      <header className="flex items-center justify-between gap-4 border-b border-racing-border bg-black/25 px-5 py-4">
        <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center bg-racing-red/10 text-racing-red"><Icon className="h-5 w-5"/></span><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-racing-red">Proyectos de {type}</p><h2 className="font-racing text-2xl font-bold uppercase text-white">{title}</h2></div></div>
        <span className="text-xs font-bold uppercase text-gray-500">{items.length} proyecto{items.length === 1 ? '' : 's'}</span>
      </header>
      <div className="space-y-5 p-4 sm:p-5">
        {visibleItems.map(project => {
          const galleryExpanded = Boolean(expandedGalleries[String(project.id)]);
          const photoCount = project.fotos?.length || 0;
          return <article key={project.id} className={`card-glass overflow-hidden border-l-4 ${project.activo ? 'border-l-racing-red' : 'border-l-gray-700 opacity-70'}`}>
            <div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-racing text-2xl font-bold uppercase text-white">{project.titulo}</h3><span className={`px-2 py-1 text-[9px] font-bold uppercase ${project.activo ? 'bg-racing-red text-white' : 'bg-gray-700 text-gray-300'}`}>{project.activo ? 'Visible' : 'Oculto'}</span></div>{project.descripcion ? <p className="mt-3 text-sm leading-relaxed text-gray-400">{project.descripcion}</p> : null}</div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => onEdit(project)} className="flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red" aria-label={`Editar ${project.titulo}`}><PencilSquareIcon className="h-4 w-4"/></button><button type="button" onClick={() => onDelete(project)} className="flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-racing-red" aria-label={`Eliminar ${project.titulo}`}><TrashIcon className="h-4 w-4"/></button></div></div></div>
            <button type="button" onClick={() => setExpandedGalleries(current => ({ ...current, [String(project.id)]: !galleryExpanded }))} className="flex w-full items-center justify-between gap-3 border-t border-racing-border bg-black/20 px-5 py-3 text-left transition hover:bg-white/[0.03]" aria-expanded={galleryExpanded}><span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400"><PhotoIcon className="h-4 w-4 text-racing-red"/>{galleryExpanded ? 'Ocultar imágenes' : 'Mostrar imágenes'} · {photoCount}</span><ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${galleryExpanded ? 'rotate-180' : ''}`}/></button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${galleryExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="min-h-0 overflow-hidden">{photoCount ? <div className="grid grid-cols-2 gap-2 border-t border-racing-border bg-black/20 p-4 sm:grid-cols-3 2xl:grid-cols-4">{project.fotos.map(photo => <div key={photo.id} className="group relative aspect-video overflow-hidden bg-black"><img src={photo.imagen} alt="" className="h-full w-full object-cover"/><button type="button" onClick={() => onDeletePhoto(project, photo)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center bg-black/85 text-white hover:bg-racing-red sm:opacity-0 sm:group-hover:opacity-100" aria-label="Eliminar imagen"><TrashIcon className="h-4 w-4"/></button></div>)}</div> : <p className="border-t border-racing-border bg-black/20 py-5 text-center text-xs text-gray-600">Sin imágenes cargadas.</p>}</div></div>
          </article>;
        })}
        {!items.length ? <div className="border border-dashed border-racing-border py-12 text-center text-sm text-gray-600">No hay proyectos de este tipo.</div> : null}
      </div>
      <AdminPagination page={safePage} pageCount={pageCount} total={items.length} pageSize={projectAdminPageSize} onPageChange={setPage}/>
    </section>
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
  modified,
  onCommit,
  onSelect,
  onExtendSelection,
  onPaste,
  onClearSelection,
  withAction = false,
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
      className={`flex h-10 min-w-full items-center pl-2 ${withAction === 'double' ? 'pr-[76px]' : withAction ? 'pr-10' : 'pr-2'} text-sm outline-none focus:ring-1 focus:ring-inset focus:ring-racing-red ${type === 'pilot' ? 'justify-start font-semibold' : 'justify-center font-racing'} ${error ? 'bg-red-500/25 ring-2 ring-inset ring-red-500' : modified ? `bg-amber-400/20 ring-1 ring-inset ${selected ? 'ring-sky-400' : 'ring-amber-300/70'}` : selected ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400' : 'focus:bg-racing-dark'} ${disabled ? 'cursor-cell text-transparent' : 'cursor-cell text-white'}`}
    />
  );
}

export default function Admin() {
  const resultJsonInputRef = useRef(null);
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
  const sponsorLogoInputRef = useRef(null);
  const sponsorPhotosInputRef = useRef(null);
  const projectPhotosInputRef = useRef(null);
  const eventBannerInputRef = useRef(null);
  const [authorized, setAuthorized] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [monitorMessage, setMonitorMessage] = useState('');
  const [savingMonitor, setSavingMonitor] = useState(false);
  const [registrationConfigs, setRegistrationConfigs] = useState([]);
  const [registrationConfigChampionshipId, setRegistrationConfigChampionshipId] = useState('');
  const [registrationConfig, setRegistrationConfig] = useState(emptyRegistrationConfig);
  const [registrationConfigMessage, setRegistrationConfigMessage] = useState('');
  const [savingRegistrationConfig, setSavingRegistrationConfig] = useState(false);
  const [savingRegistrationVisibilityId, setSavingRegistrationVisibilityId] = useState('');
  const [registrationGallery, setRegistrationGallery] = useState([]);
  const [registrationGalleryPath, setRegistrationGalleryPath] = useState('');
  const [registrationImageFiles, setRegistrationImageFiles] = useState([]);
  const [registrationGalleryMessage, setRegistrationGalleryMessage] = useState('');
  const [savingRegistrationImages, setSavingRegistrationImages] = useState(false);
  const [officialCars, setOfficialCars] = useState([]);
  const [officialCarForm, setOfficialCarForm] = useState(emptyOfficialCarForm);
  const [officialCarCollapsedBrands, setOfficialCarCollapsedBrands] = useState({});
  const [registrationFormCollapsed, setRegistrationFormCollapsed] = useState({ backgrounds: true, enabledCars: true, freeDrivers: true });
  const [freeDriverSearch, setFreeDriverSearch] = useState('');
  const [freeDriversMessage, setFreeDriversMessage] = useState('');
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
  const [sponsors, setSponsors] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [complaintChampionshipFilter, setComplaintChampionshipFilter] = useState('');
  const [complaintRoundFilter, setComplaintRoundFilter] = useState('');
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [savingComplaint, setSavingComplaint] = useState(false);
  const [sponsorForm, setSponsorForm] = useState(emptySponsorForm);
  const [sponsorLogoFile, setSponsorLogoFile] = useState(null);
  const [sponsorPhotoFiles, setSponsorPhotoFiles] = useState([]);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectPhotoFiles, setProjectPhotoFiles] = useState([]);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectMessage, setProjectMessage] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [resultChampionshipId, setResultChampionshipId] = useState('');
  const [resultRoundId, setResultRoundId] = useState('');
  const [resultSheetSize, setResultSheetSize] = useState(35);
  const [resultAttendancePoints, setResultAttendancePoints] = useState('');
  const [resultSprintMultiplier, setResultSprintMultiplier] = useState('1');
  const [resultFinalMultiplier, setResultFinalMultiplier] = useState('1');
  const [savingResultMultipliers, setSavingResultMultipliers] = useState(false);
  const [resultMultiplierMessage, setResultMultiplierMessage] = useState('');
  const [resultImportSession, setResultImportSession] = useState('sprint');
  const [resultImportedSessions, setResultImportedSessions] = useState({});
  const [assettoSanctionModal, setAssettoSanctionModal] = useState(null);
  const [assettoSanctionDraft, setAssettoSanctionDraft] = useState(emptyAssettoSanction());
  const [assettoSanctionEdit, setAssettoSanctionEdit] = useState(null);
  const [assettoSanctionMessage, setAssettoSanctionMessage] = useState('');
  const [assettoRepositionTarget, setAssettoRepositionTarget] = useState('');
  const [championshipWarningLevels, setChampionshipWarningLevels] = useState([]);
  const [championshipWarningDrivers, setChampionshipWarningDrivers] = useState([]);
  const [showChampionshipWarnings, setShowChampionshipWarnings] = useState(false);
  const [loadingChampionshipWarnings, setLoadingChampionshipWarnings] = useState(false);
  const [savingChampionshipWarnings, setSavingChampionshipWarnings] = useState(false);
  const [updatingWarningFulfillment, setUpdatingWarningFulfillment] = useState('');
  const [championshipWarningsMessage, setChampionshipWarningsMessage] = useState('');
  const [championshipScoringRows, setChampionshipScoringRows] = useState([]);
  const [showChampionshipScoring, setShowChampionshipScoring] = useState(false);
  const [loadingChampionshipScoring, setLoadingChampionshipScoring] = useState(false);
  const [savingChampionshipScoring, setSavingChampionshipScoring] = useState(false);
  const [championshipScoringMessage, setChampionshipScoringMessage] = useState('');
  const [generatingStandingsImage, setGeneratingStandingsImage] = useState(false);
  const [standingsImageMessage, setStandingsImageMessage] = useState('');
  const [savingChampionshipChampion, setSavingChampionshipChampion] = useState(false);
  const [championshipChampionMessage, setChampionshipChampionMessage] = useState('');
  const [resultDebutBallasts, setResultDebutBallasts] = useState({});
  const [resultBallastSort, setResultBallastSort] = useState('name');
  const [savingResultDebutBallasts, setSavingResultDebutBallasts] = useState(false);
  const [resultDebutBallastMessage, setResultDebutBallastMessage] = useState('');
  const [resultAchievementModal, setResultAchievementModal] = useState(null);
  const [resultAchievementDraft, setResultAchievementDraft] = useState({});
  const [resultGridSelection, setResultGridSelection] = useState(null);
  const [resultCellErrors, setResultCellErrors] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [dirtyResults, setDirtyResults] = useState({});
  const [dirtyResultCells, setDirtyResultCells] = useState({});
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
  const [eventBanners, setEventBanners] = useState([]);
  const [eventBannerFiles, setEventBannerFiles] = useState([]);
  const [savingEventBanners, setSavingEventBanners] = useState(false);
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

  const resultBallastRounds = useMemo(() => {
    const lastRound = Math.max(0, ...resultRounds.map(round => Number(round.ronda) || 0));
    return resultRounds.filter(round => Number(round.ronda) !== lastRound);
  }, [resultRounds]);

  const resultRound = useMemo(
    () => resultRounds.find(round => String(round.id) === String(resultRoundId)) || null,
    [resultRoundId, resultRounds]
  );

  useEffect(() => {
    setEventBannerFiles([]);
    if (eventBannerInputRef.current) eventBannerInputRef.current.value = '';

    if (!resultChampionshipId || !resultRound?.ronda) {
      setEventBanners([]);
      return;
    }

    setEventBanners([]);
    eventsApi.getBanners(resultChampionshipId, resultRound.ronda)
      .then(response => setEventBanners(response.data.data || []))
      .catch(error => setResultMessage(error.response?.data?.error || 'No se pudieron cargar los banners del resultado.'));
  }, [resultChampionshipId, resultRound?.ronda]);

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

  const savedResultRoundResults = useMemo(
    () => savedResults.filter(result => resultRound && Number(result.ronda) === Number(resultRound.ronda)),
    [resultRound, savedResults]
  );

  useEffect(() => {
    if (!resultRound) {
      setResultAttendancePoints('');
      setResultSprintMultiplier('1');
      setResultFinalMultiplier('1');
      setResultMultiplierMessage('');
      return;
    }
    const savedValues = [...new Set(savedResultRoundResults.map(result => Number(result.presentismo || 0)))];
    setResultAttendancePoints(savedValues.length === 1 ? String(savedValues[0]) : '');
    setResultSprintMultiplier(String(Number(resultRound.multiplicador_sprint ?? 1)));
    setResultFinalMultiplier(String(Number(resultRound.multiplicador_final ?? 1)));
    setResultMultiplierMessage('');
  }, [resultRound, savedResultRoundResults]);

  const resultSheetRows = useMemo(() => {
    if (!resultRound) return [];
    const positioned = new Map();
    const savedIds = new Set(savedResultRoundResults.map(result => String(result.id)));

    resultRoundResults
      .filter(result => result.id && savedIds.has(String(result.id)))
      .forEach((currentResult, index) => {
        const requestedPosition = parseNumericPosition(currentResult._sheetPosition) || index + 1;
        let targetPosition = requestedPosition;
        while (positioned.has(targetPosition)) targetPosition += 1;
        positioned.set(targetPosition, currentResult);
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

  const resultBallastStandings = useMemo(() => resultChampionshipStandings.map(standing => {
    const ballastRounds = new Map();
    const debutBallast = parseResultPoints(resultDebutBallasts[String(standing.idpiloto)]);
    let ballastTotal = debutBallast;

    resultBallastRounds.forEach(round => {
      const result = savedResults.find(item => !item._delete
        && String(item.idpiloto) === String(standing.idpiloto)
        && String(item.ronda) === String(round.ronda));
      const sprint = parseResultPoints(result?.kg_sprint);
      const sprintSanction = parseResultPoints(result?.kg_sancion_sprint);
      const final = parseResultPoints(result?.kg_final);
      const finalSanction = parseResultPoints(result?.kg_sancion_final);
      const delta = Math.round((sprint + sprintSanction + final + finalSanction) * 100) / 100;
      ballastTotal = Math.round((ballastTotal + delta) * 100) / 100;
      ballastRounds.set(String(round.ronda), {
        sprint,
        sprintSanction,
        final,
        finalSanction,
        delta,
      });
    });

    return { ...standing, ballastRounds, debutBallast, ballastTotal };
  }).sort((a, b) => {
    const nameOrder = String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es-AR', { sensitivity: 'base' });
    if (resultBallastSort === 'total_desc') return b.ballastTotal - a.ballastTotal || nameOrder;
    if (resultBallastSort === 'total_asc') return a.ballastTotal - b.ballastTotal || nameOrder;
    return nameOrder;
  }), [resultBallastRounds, resultBallastSort, resultChampionshipStandings, resultDebutBallasts, savedResults]);

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

  useEffect(() => {
    setResultImportedSessions({});
    setAssettoSanctionModal(null);
    if (resultJsonInputRef.current) resultJsonInputRef.current.value = '';
  }, [resultChampionshipId, resultRoundId]);

  useEffect(() => {
    let active = true;
    setChampionshipWarningsMessage('');
    if (!resultChampionshipId) {
      setChampionshipWarningLevels([]);
      setChampionshipWarningDrivers([]);
      setShowChampionshipWarnings(false);
      return undefined;
    }

    setLoadingChampionshipWarnings(true);
    championshipsApi.getWarnings(resultChampionshipId)
      .then(response => {
        if (!active) return;
        const data = response.data.data || {};
        setChampionshipWarningLevels((data.niveles || []).map(level => ({
          cantidad: String(level.cantidad),
          sancion: String(level.sancion || ''),
        })));
        setChampionshipWarningDrivers(data.pilotos || []);
      })
      .catch(error => {
        if (!active) return;
        setChampionshipWarningLevels([]);
        setChampionshipWarningDrivers([]);
        setChampionshipWarningsMessage(error.response?.data?.error || 'No se pudo cargar la configuración de apercibimientos.');
      })
      .finally(() => {
        if (active) setLoadingChampionshipWarnings(false);
      });

    return () => { active = false; };
  }, [resultChampionshipId]);

  useEffect(() => {
    let active = true;
    setChampionshipScoringMessage('');
    if (!resultChampionshipId) {
      setChampionshipScoringRows([]);
      setShowChampionshipScoring(false);
      return undefined;
    }
    setLoadingChampionshipScoring(true);
    championshipsApi.getScoring(resultChampionshipId)
      .then(response => {
        if (!active) return;
        setChampionshipScoringRows((response.data.data || []).map(row => ({
          posicion: String(row.posicion),
          ...Object.fromEntries(resultScoringFields.map(field => [field.pointsField, toScoringInputValue(row[field.pointsField])])),
        })));
      })
      .catch(error => {
        if (!active) return;
        setChampionshipScoringRows([]);
        setChampionshipScoringMessage(error.response?.data?.error || 'No se pudo cargar la escala de puntajes.');
      })
      .finally(() => { if (active) setLoadingChampionshipScoring(false); });
    return () => { active = false; };
  }, [resultChampionshipId]);

  useEffect(() => {
    let active = true;
    setResultDebutBallastMessage('');
    if (!resultChampionshipId) {
      setResultDebutBallasts({});
      return undefined;
    }
    championshipsApi.getDebutBallasts(resultChampionshipId)
      .then(response => {
        if (!active) return;
        setResultDebutBallasts(Object.fromEntries((response.data.data || []).map(row => [String(row.idpiloto), toScoringInputValue(row.kilos)])));
      })
      .catch(error => {
        if (!active) return;
        setResultDebutBallasts({});
        setResultDebutBallastMessage(error.response?.data?.error || 'No se pudieron cargar los lastres debut.');
      });
    return () => { active = false; };
  }, [resultChampionshipId]);

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
        const [eventsRes, driversRes, circuitsRes, categoriesRes, championshipsRes, carBrandsRes, carsRes, registrationsRes, monitorRes, registrationConfigsRes, replaysRes, templatesRes, sponsorsRes, complaintsRes, projectsRes] = await Promise.all([
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
          sponsorsApi.getAdminAll(),
          complaintsApi.getAdminAll(),
          projectsApi.getAdminAll(),
        ]);

        const eventRows = eventsRes.data.data ?? [];
        setEvents(eventRows);
        setDrivers(driversRes.data.data ?? []);
        setCircuits(circuitsRes.data.data ?? []);
        setCategories(categoriesRes.data.data ?? []);
        const championshipRows = championshipsRes.data.data ?? [];
        setChampionships(championshipRows);
        setComplaintChampionshipFilter(current => current || String(championshipRows.find(item => item.status === 'active')?.id || championshipRows[0]?.id || ''));
        setCarBrands(carBrandsRes.data.data ?? []);
        setCars(carsRes.data.data ?? []);
        setRegistrations(registrationsRes.data.data ?? []);
        setMonitorStatus(monitorRes.data.data ?? null);
        setRegistrationConfigs(registrationConfigsRes.data.data ?? []);
        setReplays(replaysRes.data.data ?? []);
        setTemplates(templatesRes.data.data ?? []);
        setSponsors(sponsorsRes.data.data ?? []);
        setComplaints(complaintsRes.data.data ?? []);
        setProjects(projectsRes.data.data ?? []);
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
    if (!complaintChampionshipFilter) {
      setComplaintRoundFilter('');
      return;
    }
    const championshipEvents = events
      .filter(item => String(item.idcampeonato) === complaintChampionshipFilter)
      .sort((a, b) => (parseCalendarDate(b.fecha)?.getTime() || 0) - (parseCalendarDate(a.fecha)?.getTime() || 0));
    if (!championshipEvents.length) {
      setComplaintRoundFilter('');
      return;
    }
    const latestCompleted = championshipEvents.find(item => (parseCalendarDate(item.fecha)?.getTime() || 0) <= Date.now());
    const selected = latestCompleted || championshipEvents[championshipEvents.length - 1];
    setComplaintRoundFilter(current => current && championshipEvents.some(item => String(item.ronda) === current) ? current : String(selected.ronda));
  }, [complaintChampionshipFilter, events]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!authorized || !resultChampionshipId) {
        setResults([]);
        setSavedResults([]);
        setResultCellErrors({});
        setDirtyResultCells({});
        return;
      }

      setLoadingResults(true);
      setResultMessage('');
      setResults([]);
      setSavedResults([]);
      setDirtyResults({});
      setDirtyResultCells({});
      setResultCellErrors({});
      try {
        const res = await resultsApi.getAll({
          idcampeonato: resultChampionshipId,
        });
        const loadedResults = res.data.data ?? [];
        setResults(buildEditableResultRows(loadedResults));
        setSavedResults(loadedResults);
        setDirtyResults({});
        setDirtyResultCells({});
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

  const loadFreeRegistrationDrivers = async id => {
    if (!id) return;
    try {
      const response = await registrationFormsApi.getFreeDrivers(id);
      const selectedIds = (response.data.data || []).map(driver => Number(driver.id));
      setRegistrationConfig(current => ({ ...current, pilotos_gratis: selectedIds }));
    } catch (error) {
      setFreeDriversMessage(error.response?.data?.error || 'No se pudieron cargar los pilotos con inscripción gratuita.');
    }
  };

  const selectRegistrationConfigChampionship = id => {
    setRegistrationConfigChampionshipId(id);
    setRegistrationConfigMessage('');
    setRegistrationGalleryMessage('');
    setOfficialCarsMessage('');
    setFreeDriversMessage('');
    setFreeDriverSearch('');
    setOfficialCarForm(emptyOfficialCarForm);
    setOfficialCarCollapsedBrands({});
    setRegistrationFormCollapsed({ backgrounds: true, enabledCars: true, freeDrivers: true });
    loadChampionshipPrizes(id);
    if (officialCarPhotoInputRef.current) officialCarPhotoInputRef.current.value = '';
    setRegistrationImageFiles([]);
    if (registrationImagesInputRef.current) registrationImagesInputRef.current.value = '';
    const existing = registrationConfigs.find(item => String(item.idcampeonato) === String(id));
    if (existing) {
      loadRegistrationGallery(id);
      loadOfficialCars(id);
      loadFreeRegistrationDrivers(id);
    } else {
      setRegistrationGallery([]);
      setRegistrationGalleryPath('');
      setOfficialCars([]);
    }
    setRegistrationConfig(existing ? {
      visible: existing.visible !== false,
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
      limites_por_modelo: existing.limites_por_modelo || {},
      pilotos_gratis: [],
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
      const nextCarIds = removing
        ? current.autos_habilitados.filter(carId => carId !== numericId)
        : [...current.autos_habilitados, numericId];
      const total = Number(current.limite_inscriptos || 0);
      const base = nextCarIds.length ? Math.floor(total / nextCarIds.length) : 0;
      const remainder = nextCarIds.length ? total % nextCarIds.length : 0;
      return {
        ...current,
        autos_habilitados: nextCarIds,
        limites_por_modelo: Object.fromEntries(nextCarIds.map((carId, index) => [carId, Math.max(1, base + (index < remainder ? 1 : 0))])),
        planes: removing
          ? current.planes.map(plan => ({ ...plan, autos_habilitados: plan.autos_habilitados.filter(carId => carId !== numericId) }))
          : current.planes,
      };
    });
  };

  const updateRegistrationCarLimit = (id, value) => {
    setRegistrationConfig(current => ({
      ...current,
      limites_por_modelo: { ...current.limites_por_modelo, [Number(id)]: value },
    }));
  };

  const distributeRegistrationCarLimits = () => {
    setRegistrationConfig(current => {
      const total = Number(current.limite_inscriptos || 0);
      const base = current.autos_habilitados.length ? Math.floor(total / current.autos_habilitados.length) : 0;
      const remainder = current.autos_habilitados.length ? total % current.autos_habilitados.length : 0;
      return {
        ...current,
        limites_por_modelo: Object.fromEntries(current.autos_habilitados.map((carId, index) => [carId, Math.max(1, base + (index < remainder ? 1 : 0))])),
      };
    });
  };

  const updateRegistrationPlan = (id, field, value) => {
    setRegistrationConfig(current => ({
      ...current,
      planes: current.planes.map(plan => plan.id === id ? { ...plan, [field]: value } : plan),
    }));
  };

  const toggleFreeRegistrationDriver = id => {
    const numericId = Number(id);
    setRegistrationConfig(current => ({
      ...current,
      pilotos_gratis: current.pilotos_gratis.includes(numericId)
        ? current.pilotos_gratis.filter(driverId => driverId !== numericId)
        : [...current.pilotos_gratis, numericId],
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
      const freeDriversResponse = await registrationFormsApi.updateFreeDrivers(registrationConfigChampionshipId, registrationConfig.pilotos_gratis);
      const saved = response.data.data;
      setRegistrationConfigs(current => [saved, ...current.filter(item => String(item.idcampeonato) !== String(saved.idcampeonato))]);
      setRegistrationConfigMessage(response.data.message);
      setFreeDriversMessage(freeDriversResponse.data.message || 'Pilotos con inscripción gratuita actualizados.');
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

  const toggleRegistrationConfigVisibility = async config => {
    const id = String(config.idcampeonato);
    const nextVisible = !config.visible;
    setSavingRegistrationVisibilityId(id);
    setRegistrationConfigMessage('');
    try {
      const response = await registrationFormsApi.updateVisibility(id, nextVisible);
      const saved = response.data.data;
      setRegistrationConfigs(current => current.map(item => String(item.idcampeonato) === id ? saved : item));
      if (String(registrationConfigChampionshipId) === id) {
        setRegistrationConfig(current => ({ ...current, visible: saved.visible }));
      }
      setRegistrationConfigMessage(response.data.message);
    } catch (error) {
      setRegistrationConfigMessage(error.response?.data?.error || 'No se pudo cambiar la visibilidad del formulario.');
    } finally {
      setSavingRegistrationVisibilityId('');
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

  const uploadEventBanners = async () => {
    if (!resultChampionshipId || !resultRound?.ronda || !eventBannerFiles.length) return;
    setSavingEventBanners(true);
    setResultMessage('');
    try {
      const data = new FormData();
      eventBannerFiles.forEach(file => data.append('banners', file));
      const response = await eventsApi.uploadBanners(resultChampionshipId, resultRound.ronda, data);
      const banners = response.data.data || [];
      setEventBanners(banners);
      setEventBannerFiles([]);
      if (eventBannerInputRef.current) eventBannerInputRef.current.value = '';
      setEvents(current => current.map(item => String(item.idcampeonato) === String(resultChampionshipId) && String(item.ronda) === String(resultRound.ronda)
        ? { ...item, banners }
        : item));
      setResultMessage(response.data.message || 'Banners del resultado cargados correctamente.');
    } catch (error) {
      setResultMessage(error.response?.data?.error || 'No se pudieron cargar los banners del resultado.');
    } finally {
      setSavingEventBanners(false);
    }
  };

  const removeEventBanner = async banner => {
    if (!resultChampionshipId || !resultRound?.ronda || !window.confirm('¿Eliminar este banner del resultado?')) return;
    setResultMessage('');
    try {
      const response = await eventsApi.removeBanner(resultChampionshipId, resultRound.ronda, banner.filename);
      const banners = response.data.data || [];
      setEventBanners(banners);
      setEvents(current => current.map(item => String(item.idcampeonato) === String(resultChampionshipId) && String(item.ronda) === String(resultRound.ronda)
        ? { ...item, banners }
        : item));
      setResultMessage(response.data.message || 'Banner del resultado eliminado.');
    } catch (error) {
      setResultMessage(error.response?.data?.error || 'No se pudo eliminar el banner del resultado.');
    }
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

  const findRegisteredResultDriver = driverName => {
    const normalizedName = normalizeAssettoDriverName(driverName);
    return resultRegisteredDrivers.find(driver => normalizeAssettoDriverName(driver.nombre) === normalizedName) || null;
  };

  const buildResultSessionWorkspace = sessionKey => {
    if (!resultRound) return null;
    const session = assettoSessionOptions.find(option => option.key === sessionKey);
    if (!session) return null;

    const qualifying = sessionKey.startsWith('qualy');
    const sessionRows = resultRoundResults
      .map((result, index) => ({
        result,
        index,
        driverName: String(result[session.pilotField] || result.piloto || '').trim(),
      }))
      .filter(entry => entry.driverName)
      .sort((a, b) => compareResultPositions(a.result, b.result, session.positionField));

    if (!sessionRows.length) return null;

    const preparedRows = sessionRows.map((entry, index) => {
      const details = sessionKey === 'sprint' || sessionKey === 'final'
        ? entry.result[`_sanciones_detalle_${sessionKey}`]
        : parseResultSanctionDetails(entry.result.sanciones_detalle)?.[sessionKey];
      const items = Array.isArray(details) ? details : [];
      const aggregate = aggregateAssettoSanctions({ items });
      const storedBasePosition = items
        .map(item => Number(item?._basePosition))
        .find(position => Number.isInteger(position) && position > 0);
      const displayedPosition = parseNumericPosition(entry.result[session.positionField]) || index + 1;
      return {
        ...entry,
        items,
        aggregate,
        displayedIndex: index,
        claimedBasePosition: storedBasePosition || Math.max(1, displayedPosition - Math.max(0, Number(aggregate.positions) || 0)),
      };
    });
    const basePositionByDriver = new Map([...preparedRows]
      .sort((a, b) => a.claimedBasePosition - b.claimedBasePosition
        || Number(b.aggregate.positions || 0) - Number(a.aggregate.positions || 0)
        || a.displayedIndex - b.displayedIndex)
      .map((entry, index) => [normalizeAssettoDriverName(entry.driverName), index + 1]));

    const entries = preparedRows.map(entry => {
      const driver = findRegisteredResultDriver(entry.driverName);
      const basePosition = basePositionByDriver.get(normalizeAssettoDriverName(entry.driverName)) || entry.displayedIndex + 1;
      const positionLabel = String(entry.result[session.positionField] || (qualifying ? 'S/TIEMPO' : 'NO LARGÓ')).trim();
      const normalizedPosition = positionLabel
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleUpperCase('es-AR');
      const lapMatch = positionLabel.match(/^\(\s*(\d+)\s*V\s*\)$/i);
      const hasTime = normalizedPosition !== 'S/TIEMPO';
      const started = normalizedPosition !== 'NO LARGO';

      return {
        key: `planilla:${sessionKey}:${driver?.id || normalizeAssettoDriverName(entry.driverName)}`,
        sourcePosition: basePosition,
        driverName: driver?.nombre || entry.driverName,
        normalizedName: normalizeAssettoDriverName(driver?.nombre || entry.driverName),
        driverGuid: '',
        carId: '',
        carModel: [driver?.marca, driver?.modelo].filter(Boolean).join(' '),
        laps: qualifying ? 1 : (started ? (lapMatch ? Number(lapMatch[1]) : 100) : 0),
        totalTimeMs: started ? basePosition * 1000 : null,
        bestLapMs: hasTime ? basePosition * 1000 : null,
        automaticPenaltyMs: 0,
        serverDisqualified: normalizedPosition === 'DQ',
        raw: null,
      };
    });

    const sanctions = {};
    preparedRows.forEach((entry, index) => {
      if (entry.items.length) {
        sanctions[entries[index].key] = { items: entry.items };
        if (entry.aggregate.dq) entries[index].serverDisqualified = false;
      }
    });

    return {
      fileName: `Planilla de Fecha ${resultRound.ronda}`,
      metadata: { source: 'planilla' },
      entries,
      sanctions,
      orderedRows: orderAssettoResults(entries, sanctions, sessionKey),
    };
  };

  const applyAssettoSessionToGrid = (sessionKey, orderedRows, { preservePoints = false } = {}) => {
    if (!resultRound) return;
    const session = assettoSessionOptions.find(option => option.key === sessionKey);
    if (!session) return;
    const roundNumber = Number(resultRound.ronda);
    const outsideRound = results.filter(result => Number(result.ronda) !== roundNumber);
    const currentRoundRows = results.filter(result => Number(result.ronda) === roundNumber && !result._delete);
    const savedByDriver = new Map(savedResultRoundResults.map(result => [String(result.idpiloto), {
      ...result,
      sanciones_detalle: parseResultSanctionDetails(result.sanciones_detalle),
    }]));
    const canonicalByDriver = new Map([...savedByDriver.entries()].map(([key, result]) => [`id:${key}`, result]));
    const gridGroups = [
      {
        pilotField: 'piloto',
        fields: ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'desc_sancion_qualy_sprint', 'pos_qualy_final', 'pts_qualy_final', 'desc_sancion_qualy_final', ...resultAchievementFields.map(field => field.key)],
        detailSessions: ['qualy_sprint', 'qualy_final'],
      },
      {
        pilotField: 'piloto_sprint',
        fields: ['pos_sprint', 'pts_sprint', 'kg_sprint', 'rec_tiempo_sprint', 'rec_pos_sprint', 'aps_sprint', 'kg_sancion_sprint', 'desc_sancion_sprint'],
        detailSessions: ['sprint'],
      },
      {
        pilotField: 'piloto_final',
        fields: ['pos_final', 'pts_final', 'kg_final', 'rec_tiempo_final', 'rec_pos_final', 'aps_final', 'kg_sancion_final', 'desc_sancion_final'],
        detailSessions: ['final'],
      },
    ];

    const resolveIdentity = driverName => {
      const driver = findRegisteredResultDriver(driverName);
      const normalizedName = normalizeAssettoDriverName(driver?.nombre || driverName);
      return {
        driver,
        normalizedName,
        key: driver ? `id:${driver.id}` : `name:${normalizedName}`,
      };
    };
    const ensureCanonicalResult = (driverName, index = 0) => {
      const identity = resolveIdentity(driverName);
      if (!identity.normalizedName) return null;
      if (!canonicalByDriver.has(identity.key)) {
        canonicalByDriver.set(identity.key, {
          _key: `import-${roundNumber}-${identity.key}-${index}`,
          _isNew: true,
          idcampeonato: Number(resultChampionshipId),
          fecha: String(resultRound.fecha || '').slice(0, 10),
          ronda: roundNumber,
          idcircuito: Number(resultRound.idcircuito),
          idpiloto: identity.driver ? Number(identity.driver.id) : null,
          piloto: identity.driver?.nombre || String(driverName || '').trim(),
          circuito: resultRound.circuito,
          sanciones_detalle: {},
        });
      }
      const canonical = canonicalByDriver.get(identity.key);
      canonical.idpiloto = canonical.idpiloto || (identity.driver ? Number(identity.driver.id) : null);
      canonical.piloto = identity.driver?.nombre || canonical.piloto || String(driverName || '').trim();
      canonical.sanciones_detalle = parseResultSanctionDetails(canonical.sanciones_detalle);
      return canonical;
    };

    // First collapse the editable spreadsheet back to one canonical row per driver.
    // Every session is linked by driver identity, never by its visual row index.
    currentRoundRows.forEach((gridRow, rowIndex) => {
      gridGroups.forEach(group => {
        const driverName = String(gridRow[group.pilotField] || (group.pilotField === 'piloto' ? gridRow.piloto : '') || '').trim();
        if (!driverName) return;
        const canonical = ensureCanonicalResult(driverName, rowIndex);
        if (!canonical) return;
        group.fields.forEach(field => { canonical[field] = gridRow[field] ?? ''; });
        const sourceDetails = parseResultSanctionDetails(gridRow.sanciones_detalle);
        group.detailSessions.forEach(detailSession => {
          const items = detailSession === 'sprint' || detailSession === 'final'
            ? gridRow[`_sanciones_detalle_${detailSession}`]
            : sourceDetails[detailSession];
          canonical.sanciones_detalle[detailSession] = Array.isArray(items) ? items : [];
        });
      });
    });

    const sessionConfig = {
      qualy_sprint: {
        clear: { pos_qualy_sprint: '', pts_qualy_sprint: '', desc_sancion_qualy_sprint: '', pole_sprint: 0 },
      },
      sprint: {
        clear: { pos_sprint: '', pts_sprint: '', kg_sprint: 0, rec_tiempo_sprint: 0, rec_pos_sprint: 0, aps_sprint: 0, kg_sancion_sprint: 0, desc_sancion_sprint: '', ganador_sprint: 0 },
        sanctionFields: { time: 'rec_tiempo_sprint', positions: 'rec_pos_sprint', warnings: 'aps_sprint', ballast: 'kg_sancion_sprint' },
      },
      qualy_final: {
        clear: { pos_qualy_final: '', pts_qualy_final: '', desc_sancion_qualy_final: '', pole_final: 0 },
      },
      final: {
        clear: { pos_final: '', pts_final: '', kg_final: 0, rec_tiempo_final: 0, rec_pos_final: 0, aps_final: 0, kg_sancion_final: 0, desc_sancion_final: '', ganador_final: 0 },
        sanctionFields: { time: 'rec_tiempo_final', positions: 'rec_pos_final', warnings: 'aps_final', ballast: 'kg_sancion_final' },
      },
    }[sessionKey];

    const pointsField = resultScoringByPosition[session.positionField]?.pointsField;

    canonicalByDriver.forEach(canonical => {
      const clearPatch = { ...sessionConfig.clear };
      if (preservePoints && pointsField) delete clearPatch[pointsField];
      Object.assign(canonical, clearPatch);
      canonical.sanciones_detalle = {
        ...parseResultSanctionDetails(canonical.sanciones_detalle),
        [sessionKey]: [],
      };
    });

    const importedDriverKeys = new Set();
    orderedRows.forEach((entry, index) => {
      importedDriverKeys.add(resolveIdentity(entry.driverName).key);
      const canonical = ensureCanonicalResult(entry.driverName, index);
      if (!canonical) return;
      const sanction = aggregateAssettoSanctions(entry.sanction || emptyAssettoSanction());
      Object.assign(canonical, preservePoints ? {} : getScoringPatch(session.positionField, entry.positionLabel), {
        [session.positionField]: entry.positionLabel,
        [session.sanctionField]: String(entry.sanctionLabel || '').slice(0, 500),
      });
      canonical.sanciones_detalle = {
        ...parseResultSanctionDetails(canonical.sanciones_detalle),
        [sessionKey]: getAssettoSanctionItems(entry.sanction),
      };
      if (sessionConfig.sanctionFields) {
        canonical[sessionConfig.sanctionFields.time] = sanction.noSanction ? 0 : Number(sanction.time || 0);
        canonical[sessionConfig.sanctionFields.positions] = sanction.noSanction ? 0 : Number(sanction.positions || 0);
        canonical[sessionConfig.sanctionFields.warnings] = sanction.noSanction ? 0 : Number(sanction.warnings || 0);
        canonical[sessionConfig.sanctionFields.ballast] = sanction.noSanction ? 0 : Number(sanction.ballast || 0);
      }
    });

    // A driver already present in this round but absent from the imported
    // session did not take part in that session. Keep the row and give it the
    // corresponding terminal position instead of leaving an empty cell.
    const missingPosition = sessionKey.startsWith('qualy') ? 'S/TIEMPO' : 'NO LARGÓ';
    canonicalByDriver.forEach((canonical, driverKey) => {
      if (importedDriverKeys.has(driverKey)) return;
      Object.assign(canonical, preservePoints ? {} : getScoringPatch(session.positionField, missingPosition), {
        [session.positionField]: missingPosition,
        [session.sanctionField]: '',
      });
    });

    const canonicalRoundRows = [...canonicalByDriver.values()];
    const editableRoundRows = buildEditableResultRows(canonicalRoundRows);
    const nextResults = [...outsideRound, ...editableRoundRows];
    const dirty = Object.fromEntries(editableRoundRows.map(result => [result._key || `id-${result.id}`, true]));
    const modifiedCells = {};
    editableRoundRows.forEach(result => {
      const resultKey = result._key || `id-${result.id}`;
      modifiedCells[`${resultKey}:${session.positionField}`] = true;
      if (!preservePoints && pointsField) modifiedCells[`${resultKey}:${pointsField}`] = true;
    });
    setResults(nextResults);
    setDirtyResults(current => ({ ...current, ...dirty }));
    setDirtyResultCells(current => ({ ...current, ...modifiedCells }));
    setResultSheetSize(current => Math.max(current, editableRoundRows.length));
    setResultCellErrors({});
  };

  const handleResultJsonImport = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !resultRound) return;

    try {
      const parsed = parseAssettoResultJson(JSON.parse(await file.text()));
      // A newly imported file is the complete source of truth for this session.
      // Previous positions and sanctions from the same session are intentionally discarded.
      const sanctions = {};
      const orderedRows = orderAssettoResults(parsed.entries, sanctions, resultImportSession);
      setResultImportedSessions(current => ({
        ...current,
        [resultImportSession]: {
          fileName: file.name,
          metadata: parsed.metadata,
          entries: parsed.entries,
          sanctions,
          orderedRows,
        },
      }));
      applyAssettoSessionToGrid(resultImportSession, orderedRows);
      const matched = orderedRows.filter(entry => findRegisteredResultDriver(entry.driverName)).length;
      setResultMessage(`${file.name}: ${orderedRows.length} pilotos reemplazaron por completo la tanda ${assettoSessionOptions.find(option => option.key === resultImportSession)?.label}. Las demás tandas no fueron modificadas. ${matched} vinculados con inscriptos; ${orderedRows.length - matched} pendientes de revisar.`);
    } catch (error) {
      setResultMessage(`No se pudo leer el JSON: ${error.message}`);
    }
  };

  const openAssettoSanctions = (sessionKey, entryKey = '', providedWorkspace = null) => {
    const imported = resultImportedSessions[sessionKey] || providedWorkspace || buildResultSessionWorkspace(sessionKey);
    const selectedEntry = imported?.orderedRows.find(entry => entry.key === entryKey) || imported?.orderedRows[0];
    if (!imported || !selectedEntry) return;
    if (!resultImportedSessions[sessionKey]) {
      setResultImportedSessions(current => ({ ...current, [sessionKey]: imported }));
    }
    setAssettoSanctionModal({ sessionKey, entryKey: selectedEntry.key });
    setAssettoSanctionDraft(emptyAssettoSanction());
    setAssettoSanctionEdit(null);
    setAssettoSanctionMessage('');
    setAssettoRepositionTarget('');
  };

  const selectAssettoSanctionDriver = entryKey => {
    if (!assettoSanctionModal) return;
    setAssettoSanctionModal(current => ({ ...current, entryKey }));
    setAssettoSanctionDraft(emptyAssettoSanction());
    setAssettoSanctionEdit(null);
    setAssettoSanctionMessage('');
    setAssettoRepositionTarget('');
  };

  const getAssettoBasePosition = (imported, sessionKey, entryKey) => {
    const baseIndex = orderAssettoResults(imported?.entries || [], {}, sessionKey)
      .findIndex(entry => entry.key === entryKey);
    return baseIndex >= 0 ? baseIndex + 1 : 0;
  };

  const getAssettoWarningProjection = (sessionKey, entryKey, proposedWarnings = 0, editingIndex = null) => {
    const imported = resultImportedSessions[sessionKey];
    const entry = imported?.orderedRows.find(item => item.key === entryKey)
      || imported?.entries.find(item => item.key === entryKey);
    const driver = entry ? findRegisteredResultDriver(entry.driverName) : null;
    const warningField = sessionKey === 'sprint' ? 'aps_sprint' : sessionKey === 'final' ? 'aps_final' : '';
    const levels = championshipWarningLevels
      .map(level => ({ ...level, cantidad: Number(level.cantidad) || 0 }))
      .filter(level => level.cantidad > 0)
      .sort((a, b) => a.cantidad - b.cantidad);
    const limit = levels.at(-1)?.cantidad || 0;
    const championshipDriver = championshipWarningDrivers.find(item => String(item.idpiloto) === String(driver?.id));
    const championshipTotal = Number(championshipDriver?.apercibimientos || 0);

    if (!imported || !entry || !driver || !warningField) {
      return { enabled: false, driver, levels, limit, currentTotal: championshipTotal, projectedTotal: championshipTotal, reachedLevels: [], exceeded: false };
    }

    const savedResult = savedResultRoundResults.find(result => String(result.idpiloto) === String(driver.id));
    const savedSessionWarnings = Number(savedResult?.[warningField] || 0);
    const currentItems = getAssettoSanctionItems(imported.sanctions[entryKey]);
    const workspaceWarnings = currentItems.reduce((total, item, index) => (
      index === editingIndex || item.noSanction ? total : total + Math.max(0, Math.trunc(Number(item.warnings) || 0))
    ), 0);
    const currentTotal = Math.max(0, championshipTotal - savedSessionWarnings + workspaceWarnings);
    const addedWarnings = Math.max(0, Math.trunc(Number(proposedWarnings) || 0));
    const projectedTotal = currentTotal + addedWarnings;
    const reachedLevels = levels.filter(level => level.cantidad > currentTotal && level.cantidad <= projectedTotal);

    return {
      enabled: true,
      driver,
      levels,
      limit,
      currentTotal,
      projectedTotal,
      reachedLevels,
      exceeded: limit > 0 && projectedTotal > limit,
    };
  };

  const validateAssettoWarningLimit = (sessionKey, entryKey, proposedWarnings, editingIndex = null) => {
    const projection = getAssettoWarningProjection(sessionKey, entryKey, proposedWarnings, editingIndex);
    if (Number(proposedWarnings) > 0 && !projection.enabled) {
      setAssettoSanctionMessage('Los apercibimientos solamente se acumulan en las tandas Sprint y Final.');
      return null;
    }
    if (projection.exceeded) {
      setAssettoSanctionMessage(`${projection.driver?.nombre || 'El piloto'} ya acumula ${projection.currentTotal} AP. El límite del campeonato es ${projection.limit} AP y esta sanción lo llevaría a ${projection.projectedTotal} AP.`);
      return null;
    }
    return projection;
  };

  const applyAssettoSanction = () => {
    if (!assettoSanctionModal) return;
    const { sessionKey, entryKey } = assettoSanctionModal;
    const imported = resultImportedSessions[sessionKey];
    if (!imported) return;

    const existingItems = getAssettoSanctionItems(imported.sanctions[entryKey]);
    const normalizedDraft = {
      ...assettoSanctionDraft,
      _basePosition: Number(existingItems[0]?._basePosition) || getAssettoBasePosition(imported, sessionKey, entryKey),
      minute: Math.max(0, Math.trunc(Number(assettoSanctionDraft.minute) || 0)),
      second: Math.min(59, Math.max(0, Math.trunc(Number(assettoSanctionDraft.second) || 0))),
      time: Math.max(0, Number(assettoSanctionDraft.time) || 0),
      positions: Math.max(0, Math.trunc(Number(assettoSanctionDraft.positions) || 0)),
      warnings: Math.max(0, Math.trunc(Number(assettoSanctionDraft.warnings) || 0)),
      ballast: Math.max(0, Math.trunc(Number(assettoSanctionDraft.ballast) || 0)),
      description: String(assettoSanctionDraft.description || '').trim(),
    };
    if (normalizedDraft.minute === 0 && normalizedDraft.second === 0) {
      setAssettoSanctionMessage('Indicá el minuto y segundo de la maniobra. No puede quedar en 0:00.');
      return;
    }
    const hasSanction = normalizedDraft.dq || normalizedDraft.noSanction
      || normalizedDraft.time > 0 || normalizedDraft.positions > 0
      || normalizedDraft.warnings > 0 || normalizedDraft.ballast !== 0
      || normalizedDraft.description;
    if (!hasSanction) {
      setAssettoSanctionMessage('Ingresá al menos una medida o una descripción para agregar la sanción.');
      return;
    }
    const warningProjection = validateAssettoWarningLimit(
      sessionKey,
      entryKey,
      normalizedDraft.noSanction ? 0 : normalizedDraft.warnings,
    );
    if (!warningProjection) return;
    const sanctions = { ...imported.sanctions, [entryKey]: { items: [...existingItems, normalizedDraft] } };
    const previousAggregate = aggregateAssettoSanctions({ items: existingItems });
    const nextItems = getAssettoSanctionItems(sanctions[entryKey]);
    const nextAggregate = aggregateAssettoSanctions({ items: nextItems });
    const changesPositions = Number(previousAggregate.time || 0) !== Number(nextAggregate.time || 0)
      || Number(previousAggregate.positions || 0) !== Number(nextAggregate.positions || 0)
      || Boolean(previousAggregate.dq) !== Boolean(nextAggregate.dq);

    if (!changesPositions) {
      const orderedRows = imported.orderedRows.map(entry => entry.key === entryKey
        ? { ...entry, sanction: nextAggregate, sanctionLabel: buildAssettoSanctionLabel({ items: nextItems }) }
        : entry);
      setResultImportedSessions(current => ({ ...current, [sessionKey]: { ...imported, sanctions, orderedRows } }));
      updateAssettoSanctionDetailsWithoutReordering(sessionKey, entryKey, imported, nextItems);
      setAssettoSanctionDraft(emptyAssettoSanction());
      setAssettoSanctionEdit(null);
      setAssettoSanctionMessage('');
      setAssettoRepositionTarget('');
      const reachedWarningText = warningProjection.reachedLevels.length
        ? ` Llegó a ${warningProjection.projectedTotal} AP: ${warningProjection.reachedLevels.map(level => `${level.cantidad} AP · ${level.sancion}`).join(' / ')}.`
        : normalizedDraft.warnings > 0 ? ` Acumula ${warningProjection.projectedTotal}${warningProjection.limit ? ` de ${warningProjection.limit}` : ''} AP.` : '';
      setResultMessage(`Sanción aplicada sin modificar las posiciones.${reachedWarningText} Podés continuar con otro piloto; al terminar, cerrá el modal y presioná Guardar.`);
      return;
    }

    const orderedRows = orderAssettoResults(imported.entries, sanctions, sessionKey);
    setResultImportedSessions(current => ({
      ...current,
      [sessionKey]: { ...imported, sanctions, orderedRows },
    }));
    applyAssettoSessionToGrid(sessionKey, orderedRows, { preservePoints: true });
    setAssettoSanctionDraft(emptyAssettoSanction());
    setAssettoSanctionEdit(null);
    setAssettoSanctionMessage('');
    setAssettoRepositionTarget('');
    const reachedWarningText = warningProjection.reachedLevels.length
      ? ` Llegó a ${warningProjection.projectedTotal} AP: ${warningProjection.reachedLevels.map(level => `${level.cantidad} AP · ${level.sancion}`).join(' / ')}.`
      : normalizedDraft.warnings > 0 ? ` Acumula ${warningProjection.projectedTotal}${warningProjection.limit ? ` de ${warningProjection.limit}` : ''} AP.` : '';
    setResultMessage(`Sanción aplicada y posiciones recalculadas.${reachedWarningText} Podés continuar con otro piloto; al terminar, cerrá el modal y presioná Guardar.`);
  };

  const removeAssettoSanction = (entryKey, sanctionIndex) => {
    if (!assettoSanctionModal) return;
    const { sessionKey } = assettoSanctionModal;
    const imported = resultImportedSessions[sessionKey];
    if (!imported) return;
    const previousItems = getAssettoSanctionItems(imported.sanctions[entryKey]);
    const items = previousItems.filter((_, index) => index !== sanctionIndex);
    const sanctions = { ...imported.sanctions };
    if (items.length) sanctions[entryKey] = { items };
    else delete sanctions[entryKey];
    const previousAggregate = aggregateAssettoSanctions({ items: previousItems });
    const nextAggregate = aggregateAssettoSanctions({ items });
    const changesPositions = Number(previousAggregate.time || 0) !== Number(nextAggregate.time || 0)
      || Number(previousAggregate.positions || 0) !== Number(nextAggregate.positions || 0)
      || Boolean(previousAggregate.dq) !== Boolean(nextAggregate.dq);

    if (!changesPositions) {
      const orderedRows = imported.orderedRows.map(entry => entry.key === entryKey
        ? { ...entry, sanction: nextAggregate, sanctionLabel: buildAssettoSanctionLabel({ items }) }
        : entry);
      setResultImportedSessions(current => ({ ...current, [sessionKey]: { ...imported, sanctions, orderedRows } }));
      updateAssettoSanctionDetailsWithoutReordering(sessionKey, entryKey, imported, items);
      setAssettoSanctionEdit(null);
      setAssettoSanctionMessage('');
      setAssettoRepositionTarget('');
      setResultMessage('Sanción eliminada sin modificar las posiciones.');
      return;
    }

    const orderedRows = orderAssettoResults(imported.entries, sanctions, sessionKey);
    setResultImportedSessions(current => ({ ...current, [sessionKey]: { ...imported, sanctions, orderedRows } }));
    applyAssettoSessionToGrid(sessionKey, orderedRows, { preservePoints: true });
    setAssettoSanctionEdit(null);
    setAssettoSanctionMessage('');
    setAssettoRepositionTarget('');
    setResultMessage('Sanción eliminada y posiciones recalculadas.');
  };

  const updateAssettoSanctionDetailsWithoutReordering = (sessionKey, entryKey, imported, items) => {
    const session = assettoSessionOptions.find(option => option.key === sessionKey);
    const entry = imported.entries.find(item => item.key === entryKey)
      || imported.orderedRows.find(item => item.key === entryKey);
    if (!session || !entry || !resultRound) return;

    const targetDriver = normalizeAssettoDriverName(entry.driverName);
    const aggregate = aggregateAssettoSanctions({ items });
    const sanctionLabel = buildAssettoSanctionLabel({ items });
    const dirty = {};
    const modifiedCells = {};
    const nextResults = results.map(result => {
      if (Number(result.ronda) !== Number(resultRound.ronda)) return result;
      const rowDriver = normalizeAssettoDriverName(result[session.pilotField]);
      if (!rowDriver || rowDriver !== targetDriver) return result;

      const resultKey = result._key || `id-${result.id}`;
      dirty[resultKey] = true;
      modifiedCells[`${resultKey}:${session.sanctionField}`] = true;
      const patch = { [session.sanctionField]: sanctionLabel };

      if (sessionKey === 'sprint' || sessionKey === 'final') {
        const prefix = sessionKey === 'sprint' ? 'sprint' : 'final';
        patch[`_sanciones_detalle_${sessionKey}`] = items;
        patch[`rec_tiempo_${prefix}`] = aggregate.noSanction ? 0 : Number(aggregate.time || 0);
        patch[`rec_pos_${prefix}`] = aggregate.noSanction ? 0 : Number(aggregate.positions || 0);
        patch[`aps_${prefix}`] = aggregate.noSanction ? 0 : Number(aggregate.warnings || 0);
        patch[`kg_sancion_${prefix}`] = aggregate.noSanction ? 0 : Number(aggregate.ballast || 0);
      } else {
        patch.sanciones_detalle = {
          ...parseResultSanctionDetails(result.sanciones_detalle),
          [sessionKey]: items,
        };
      }

      return { ...result, ...patch };
    });

    setResults(nextResults);
    setDirtyResults(current => ({ ...current, ...dirty }));
    setDirtyResultCells(current => ({ ...current, ...modifiedCells }));
    setResultCellErrors({});
  };

  const saveAssettoSanctionEdit = () => {
    if (!assettoSanctionModal || !assettoSanctionEdit) return;
    const { sessionKey } = assettoSanctionModal;
    const { entryKey, index } = assettoSanctionEdit;
    const imported = resultImportedSessions[sessionKey];
    if (!imported) return;
    const items = getAssettoSanctionItems(imported.sanctions[entryKey]);
    if (!items[index]) return;
    const normalizedEdit = {
      _basePosition: Number(items[index]?._basePosition) || getAssettoBasePosition(imported, sessionKey, entryKey),
      type: assettoSanctionEdit.type === 'SANCIÓN DE OFICIO' ? 'SANCIÓN DE OFICIO' : 'DENUNCIA',
      minute: Math.max(0, Math.trunc(Number(assettoSanctionEdit.minute) || 0)),
      second: Math.min(59, Math.max(0, Math.trunc(Number(assettoSanctionEdit.second) || 0))),
      time: Math.max(0, Number(assettoSanctionEdit.time) || 0),
      positions: Math.max(0, Math.trunc(Number(assettoSanctionEdit.positions) || 0)),
      warnings: Math.max(0, Math.trunc(Number(assettoSanctionEdit.warnings) || 0)),
      ballast: Math.max(0, Math.trunc(Number(assettoSanctionEdit.ballast) || 0)),
      dq: Boolean(assettoSanctionEdit.dq),
      noSanction: Boolean(assettoSanctionEdit.noSanction),
      description: String(assettoSanctionEdit.description || '').trim(),
    };
    if (normalizedEdit.minute === 0 && normalizedEdit.second === 0) {
      setAssettoSanctionMessage('Indicá el minuto y segundo de la maniobra. No puede quedar en 0:00.');
      return;
    }
    const hasSanction = normalizedEdit.dq || normalizedEdit.noSanction
      || normalizedEdit.time > 0 || normalizedEdit.positions > 0
      || normalizedEdit.warnings > 0 || normalizedEdit.ballast !== 0
      || normalizedEdit.description;
    if (!hasSanction) {
      setAssettoSanctionMessage('Ingresá al menos una medida o una descripción para guardar los cambios.');
      return;
    }
    const warningProjection = validateAssettoWarningLimit(
      sessionKey,
      entryKey,
      normalizedEdit.noSanction ? 0 : normalizedEdit.warnings,
      index,
    );
    if (!warningProjection) return;
    const previousAggregate = aggregateAssettoSanctions({ items });
    items[index] = normalizedEdit;
    const sanctions = { ...imported.sanctions, [entryKey]: { items } };
    const nextAggregate = aggregateAssettoSanctions({ items });
    const changesPositions = Number(previousAggregate.time || 0) !== Number(nextAggregate.time || 0)
      || Number(previousAggregate.positions || 0) !== Number(nextAggregate.positions || 0)
      || Boolean(previousAggregate.dq) !== Boolean(nextAggregate.dq);

    if (!changesPositions) {
      const orderedRows = imported.orderedRows.map(entry => entry.key === entryKey
        ? { ...entry, sanction: nextAggregate, sanctionLabel: buildAssettoSanctionLabel({ items }) }
        : entry);
      setResultImportedSessions(current => ({ ...current, [sessionKey]: { ...imported, sanctions, orderedRows } }));
      updateAssettoSanctionDetailsWithoutReordering(sessionKey, entryKey, imported, items);
      setAssettoSanctionEdit(null);
      setAssettoSanctionMessage('');
      const reachedWarningText = warningProjection.reachedLevels.length
        ? ` Llegó a ${warningProjection.projectedTotal} AP: ${warningProjection.reachedLevels.map(level => `${level.cantidad} AP · ${level.sancion}`).join(' / ')}.`
        : normalizedEdit.warnings > 0 ? ` Acumula ${warningProjection.projectedTotal}${warningProjection.limit ? ` de ${warningProjection.limit}` : ''} AP.` : '';
      setResultMessage(`Sanción actualizada sin modificar las posiciones.${reachedWarningText} Presioná Guardar para confirmar.`);
      return;
    }

    const orderedRows = orderAssettoResults(imported.entries, sanctions, sessionKey);
    setResultImportedSessions(current => ({ ...current, [sessionKey]: { ...imported, sanctions, orderedRows } }));
    applyAssettoSessionToGrid(sessionKey, orderedRows, { preservePoints: true });
    setAssettoSanctionEdit(null);
    setAssettoSanctionMessage('');
    const reachedWarningText = warningProjection.reachedLevels.length
      ? ` Llegó a ${warningProjection.projectedTotal} AP: ${warningProjection.reachedLevels.map(level => `${level.cantidad} AP · ${level.sancion}`).join(' / ')}.`
      : normalizedEdit.warnings > 0 ? ` Acumula ${warningProjection.projectedTotal}${warningProjection.limit ? ` de ${warningProjection.limit}` : ''} AP.` : '';
    setResultMessage(`Sanción actualizada y posiciones recalculadas.${reachedWarningText} Presioná Guardar para confirmar.`);
  };

  const addChampionshipWarningLevel = () => {
    const nextAmount = Math.max(0, ...championshipWarningLevels.map(level => Number(level.cantidad) || 0)) + 1;
    setChampionshipWarningLevels(current => [...current, { cantidad: String(nextAmount), sancion: '' }]);
    setChampionshipWarningsMessage('');
  };

  const updateChampionshipWarningLevel = (index, field, value) => {
    setChampionshipWarningLevels(current => current.map((level, levelIndex) => (
      levelIndex === index ? { ...level, [field]: value } : level
    )));
    setChampionshipWarningsMessage('');
  };

  const removeChampionshipWarningLevel = index => {
    setChampionshipWarningLevels(current => current.filter((_, levelIndex) => levelIndex !== index));
    setChampionshipWarningsMessage('Recordá guardar para confirmar la eliminación.');
  };

  const saveChampionshipWarnings = async () => {
    if (!resultChampionshipId) return;
    setSavingChampionshipWarnings(true);
    setChampionshipWarningsMessage('');
    try {
      const response = await championshipsApi.saveWarnings(resultChampionshipId, championshipWarningLevels);
      const refreshed = await championshipsApi.getWarnings(resultChampionshipId);
      setChampionshipWarningLevels((response.data.data || []).map(level => ({
        cantidad: String(level.cantidad),
        sancion: String(level.sancion || ''),
      })));
      setChampionshipWarningDrivers(refreshed.data.data?.pilotos || []);
      setChampionshipWarningsMessage(response.data.message || 'Escala guardada correctamente.');
    } catch (error) {
      setChampionshipWarningsMessage(error.response?.data?.error || 'No se pudo guardar la escala de apercibimientos.');
    } finally {
      setSavingChampionshipWarnings(false);
    }
  };

  const getScoringPatch = (positionField, value, multiplierOverride = null) => {
    const scoringField = resultScoringByPosition[positionField];
    const normalizedPosition = String(value ?? '').trim().toLocaleUpperCase('es-AR');
    if (!scoringField) return { [positionField]: normalizedPosition };
    const numericPosition = parseNumericPosition(normalizedPosition);
    const configuredRow = numericPosition
      ? championshipScoringRows.find(row => Number(row.posicion) === numericPosition)
      : null;
    const multiplier = scoringField.pointsField === 'pts_sprint'
      ? Number(multiplierOverride?.sprint ?? resultRound?.multiplicador_sprint ?? 1)
      : scoringField.pointsField === 'pts_final'
        ? Number(multiplierOverride?.final ?? resultRound?.multiplicador_final ?? 1)
        : 1;
    const basePoints = configuredRow ? parseResultPoints(configuredRow[scoringField.pointsField]) : 0;
    const multipliedPoints = Math.round((basePoints * (Number.isFinite(multiplier) ? multiplier : 1)) * 1000) / 1000;
    return {
      [positionField]: normalizedPosition,
      [scoringField.pointsField]: configuredRow ? String(multipliedPoints) : '',
    };
  };

  const addChampionshipScoringRow = () => {
    const nextPosition = Math.max(0, ...championshipScoringRows.map(row => Number(row.posicion) || 0)) + 1;
    setChampionshipScoringRows(current => [...current, {
      posicion: String(nextPosition),
      ...Object.fromEntries(resultScoringFields.map(field => [field.pointsField, ''])),
    }]);
    setChampionshipScoringMessage('');
  };

  const updateChampionshipScoringRow = (index, field, value) => {
    setChampionshipScoringRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    setChampionshipScoringMessage('');
  };

  const removeChampionshipScoringRow = index => {
    setChampionshipScoringRows(current => current.filter((_, rowIndex) => rowIndex !== index));
    setChampionshipScoringMessage('Recordá guardar para confirmar la eliminación.');
  };

  const handleChampionshipScoringKeyDown = (event, rowIndex, field) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const nextRowIndex = rowIndex + direction;
    if (nextRowIndex < 0) return;

    const focusCell = targetRow => {
      const input = document.querySelector(`[data-scoring-cell="${targetRow}:${field}"]`);
      input?.focus();
      input?.select();
    };
    if (nextRowIndex < championshipScoringRows.length) {
      focusCell(nextRowIndex);
      return;
    }
    addChampionshipScoringRow();
    window.requestAnimationFrame(() => focusCell(nextRowIndex));
  };

  const saveChampionshipScoring = async () => {
    if (!resultChampionshipId) return;
    setSavingChampionshipScoring(true);
    setChampionshipScoringMessage('');
    try {
      const response = await championshipsApi.saveScoring(resultChampionshipId, championshipScoringRows);
      setChampionshipScoringRows((response.data.data || []).map(row => ({
        posicion: String(row.posicion),
        ...Object.fromEntries(resultScoringFields.map(field => [field.pointsField, toScoringInputValue(row[field.pointsField])])),
      })));
      setChampionshipScoringMessage(response.data.message || 'Escala guardada correctamente.');
    } catch (error) {
      setChampionshipScoringMessage(error.response?.data?.error || 'No se pudo guardar la escala de puntajes.');
    } finally {
      setSavingChampionshipScoring(false);
    }
  };

  const saveResultDebutBallasts = async () => {
    if (!resultChampionshipId) return;
    setSavingResultDebutBallasts(true);
    setResultDebutBallastMessage('');
    try {
      const lastres = Object.entries(resultDebutBallasts).map(([idpiloto, kilos]) => ({ idpiloto: Number(idpiloto), kilos }));
      const response = await championshipsApi.saveDebutBallasts(resultChampionshipId, lastres);
      setResultDebutBallasts(Object.fromEntries((response.data.data || []).map(row => [String(row.idpiloto), toScoringInputValue(row.kilos)])));
      setResultDebutBallastMessage(response.data.message || 'Lastres debut guardados correctamente.');
    } catch (error) {
      setResultDebutBallastMessage(error.response?.data?.error || 'No se pudieron guardar los lastres debut.');
    } finally {
      setSavingResultDebutBallasts(false);
    }
  };

  const setChampionshipChampion = async (standing, checked) => {
    if (!resultChampionshipId || savingChampionshipChampion) return;
    if (Object.keys(dirtyResults).length) {
      setChampionshipChampionMessage('Primero guardá los cambios pendientes de la planilla y después marcá al campeón.');
      return;
    }
    const driverResults = savedResults
      .filter(result => String(result.idpiloto) === String(standing.idpiloto) && result.id)
      .sort((a, b) => Number(b.ronda) - Number(a.ronda));
    const targetResult = checked
      ? driverResults[0]
      : driverResults.find(result => Boolean(Number(result.campeon)));
    if (!targetResult) {
      setChampionshipChampionMessage('El piloto necesita al menos un resultado guardado para marcarlo como campeón.');
      return;
    }

    setSavingChampionshipChampion(true);
    setChampionshipChampionMessage('');
    try {
      await resultsApi.saveBulk([{
        id: targetResult.id,
        data: {
          idcampeonato: Number(resultChampionshipId),
          campeon: checked ? 1 : 0,
        },
      }]);
      const response = await resultsApi.getAll({ idcampeonato: resultChampionshipId });
      const savedRows = response.data.data ?? [];
      setResults(buildEditableResultRows(savedRows));
      setSavedResults(savedRows);
      setDirtyResults({});
      setDirtyResultCells({});
      setChampionshipChampionMessage(checked
        ? `${standing.piloto} quedó marcado como campeón del campeonato.`
        : 'La marca de campeón fue eliminada.');
    } catch (error) {
      setChampionshipChampionMessage(error.response?.data?.error || 'No se pudo actualizar el campeón del campeonato.');
    } finally {
      setSavingChampionshipChampion(false);
    }
  };

  const generateChampionshipStandingsImage = async () => {
    const standings = resultChampionshipStandings;
    if (!resultChampionship || !standings.length) {
      setStandingsImageMessage('Todavía no hay pilotos para generar las imágenes del campeonato.');
      return;
    }

    setGeneratingStandingsImage(true);
    setStandingsImageMessage('');
    try {
      await document.fonts?.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no pudo crear la imagen.');

      const completedRounds = resultRounds.filter(round => savedResults.some(result =>
        !result._delete && String(result.ronda) === String(round.ronda)
      )).length;
      const nextRound = resultRounds.find(round => !savedResults.some(result =>
        !result._delete && String(result.ronda) === String(round.ronda)
      )) || null;
      const [categoryLogo, cadpoLogo, ...carLogos] = await Promise.all([
        loadCanvasImage(resultChampionship.categoria_logo),
        loadCanvasImage('/logo.png'),
        ...standings.map(standing => loadCanvasImage(standing.autoLogo)),
      ]);
      const pages = Array.from({ length: Math.ceil(standings.length / 10) }, (_, index) => standings.slice(index * 10, (index + 1) * 10));
      const leaderTotal = Number(standings[0]?.total || 0);
      const achievementsByDriver = savedResults.reduce((map, result) => {
        const driverKey = String(result.idpiloto);
        const current = map.get(driverKey) || { poles: 0, sprints: 0, finals: 0 };
        current.poles += Number(Boolean(Number(result.pole_sprint))) + Number(Boolean(Number(result.pole_final)));
        current.sprints += Number(Boolean(Number(result.ganador_sprint)));
        current.finals += Number(Boolean(Number(result.ganador_final)));
        map.set(driverKey, current);
        return map;
      }, new Map());
      const safeCategory = String(resultChampionship.categoria || 'campeonato')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLocaleLowerCase('es-AR');

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const pageStandings = pages[pageIndex];
        context.clearRect(0, 0, 1920, 1080);
        context.globalAlpha = 1;
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        context.font = '400 16px Arial, sans-serif';

      const background = context.createLinearGradient(0, 0, 1920, 1080);
      background.addColorStop(0, '#05070a');
      background.addColorStop(0.55, '#11151b');
      background.addColorStop(1, '#07090d');
      context.fillStyle = background;
      context.fillRect(0, 0, 1920, 1080);

      const redGlow = context.createRadialGradient(1550, 100, 20, 1550, 100, 850);
      redGlow.addColorStop(0, 'rgba(220, 38, 38, 0.27)');
      redGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
      context.fillStyle = redGlow;
      context.fillRect(0, 0, 1920, 1080);
      context.fillStyle = '#dc2626';
      context.fillRect(0, 0, 18, 1080);
      context.fillStyle = 'rgba(220, 38, 38, 0.15)';
      context.beginPath();
      context.moveTo(1420, 0);
      context.lineTo(1920, 0);
      context.lineTo(1920, 210);
      context.closePath();
      context.fill();

      drawContainedCanvasImage(context, categoryLogo, 70, 45, 150, 150);
      context.fillStyle = '#ef4444';
      context.font = '700 26px Arial, sans-serif';
      context.fillText('TABLA DEL CAMPEONATO', 250, 82);
      context.fillStyle = '#ffffff';
      context.font = '900 66px Arial Black, Arial, sans-serif';
      context.fillText(fitCanvasText(context, String(resultChampionship.categoria || '').toLocaleUpperCase('es-AR'), 1120), 250, 151);
      context.fillStyle = '#9ca3af';
      context.font = '700 26px Arial, sans-serif';
      context.fillText(`TEMPORADA ${resultChampionship.temporada} · ${resultChampionship.anio}`, 252, 191);

      context.textAlign = 'right';
      context.fillStyle = '#ffffff';
      context.font = '900 42px Arial Black, Arial, sans-serif';
      context.fillText(`${completedRounds} FECHA${completedRounds === 1 ? '' : 'S'} CUMPLIDA${completedRounds === 1 ? '' : 'S'}`, 1815, 115);
      context.fillStyle = '#ffffff';
      context.font = '700 20px Arial, sans-serif';
      const nextRoundLabel = nextRound ? `PRÓXIMA FECHA: ${nextRound.circuito}` : 'CAMPEONATO FINALIZADO';
      context.fillText(fitCanvasText(context, nextRoundLabel, 670), 1815, 151);
      if (nextRound) {
        const nextRoundLocation = [nextRound.localidad, nextRound.provincia, getCountryName(nextRound.pais)].filter(Boolean).join(', ');
        context.fillStyle = '#9ca3af';
        context.font = '600 17px Arial, sans-serif';
        context.fillText(fitCanvasText(context, nextRoundLocation, 670), 1815, 179);
      }
      drawContainedCanvasImage(context, cadpoLogo, 1670, 25, 145, 65);
      context.textAlign = 'left';

      const tableX = 70;
      const tableWidth = 1780;
      const headerY = 230;
      const headerHeight = 54;
      context.fillStyle = '#dc2626';
      context.beginPath();
      context.roundRect(tableX, headerY, tableWidth, headerHeight, 8);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '800 21px Arial, sans-serif';
      context.fillText('POS.', 100, 265);
      context.fillText('PILOTO', 310, 265);
      context.textAlign = 'right';
      context.fillText('PUNTOS', 1260, 265);
      context.fillText('DIFERENCIA', 1480, 265);
      context.font = '800 17px Arial, sans-serif';
      context.fillText('TRAYECTORIA', 1810, 265);
      context.textAlign = 'left';

      const rowStart = 296;
      const rowHeight = 70;
      pageStandings.forEach((standing, index) => {
        const y = rowStart + index * rowHeight;
        context.fillStyle = index % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.075)';
        context.beginPath();
        context.roundRect(tableX, y, tableWidth, rowHeight - 7, 7);
        context.fill();
        if (standing.position <= 3) {
          context.fillStyle = standing.position === 1 ? '#facc15' : standing.position === 2 ? '#d1d5db' : '#c56a30';
          context.fillRect(tableX, y, 8, rowHeight - 7);
        }

        context.fillStyle = standing.position === 1 ? '#facc15' : standing.position === 2 ? '#e5e7eb' : standing.position === 3 ? '#fb923c' : '#9ca3af';
        context.font = '900 38px Arial Black, Arial, sans-serif';
        context.fillText(`${standing.position}°`, 105, y + 45);
        drawContainedCanvasImage(context, carLogos[(pageIndex * 10) + index], 190, y + 8, 90, 47);

        context.fillStyle = '#ffffff';
        context.font = '800 27px Arial, sans-serif';
        context.fillText(fitCanvasText(context, standing.piloto, standing.campeon ? 560 : 700), 310, y + 30);
        if (standing.campeon) {
          context.fillStyle = '#facc15';
          context.font = '900 16px Arial, sans-serif';
          context.fillText('CAMPEÓN', 900, y + 29);
        }
        context.fillStyle = '#7f8794';
        context.font = '600 17px Arial, sans-serif';
        context.fillText(fitCanvasText(context, [standing.marca, standing.modelo].filter(Boolean).join(' ') || 'Auto sin informar', 700), 310, y + 53);

        context.textAlign = 'right';
        context.fillStyle = '#22d3ee';
        context.font = '900 34px Arial Black, Arial, sans-serif';
        context.fillText(formatResultPoints(standing.total), 1260, y + 44);
        const difference = Math.max(0, Math.round((leaderTotal - Number(standing.total || 0)) * 100) / 100);
        context.fillStyle = '#d1d5db';
        context.font = '800 21px Arial, sans-serif';
        context.fillText(standing.position === 1 ? '' : formatResultPoints(difference), 1480, y + 43);
        const achievements = achievementsByDriver.get(String(standing.idpiloto)) || { poles: 0, sprints: 0, finals: 0 };
        const achievementLabel = [
          achievements.poles ? `${achievements.poles} POLE${achievements.poles === 1 ? '' : 'S'}` : '',
          achievements.sprints ? `${achievements.sprints} SPRINT` : '',
          achievements.finals ? `${achievements.finals} FINAL${achievements.finals === 1 ? '' : 'ES'}` : '',
        ].filter(Boolean).join(' • ');
        context.fillStyle = '#ffffff';
        context.font = '700 14px Arial, sans-serif';
        context.fillText(achievementLabel, 1810, y + 42);
        context.textAlign = 'left';
      });

      context.fillStyle = '#59616d';
      context.font = '600 18px Arial, sans-serif';
      context.fillText('CADPO TORNEOS · Comunidad Argentina de Pilotos Online', 72, 1040);
      context.textAlign = 'right';
      context.fillText('www.cadpotorneos.com', 1848, 1040);

      const blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo generar el archivo PNG.')), 'image/png');
        } catch (error) {
          reject(error);
        }
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `posiciones-${safeCategory}-temporada-${resultChampionship.temporada}-pagina-${pageIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setStandingsImageMessage(`${pages.length} imagen${pages.length === 1 ? '' : 'es'} 16:9 generada${pages.length === 1 ? '' : 's'} correctamente.`);
    } catch (error) {
      setStandingsImageMessage(error.message || 'No se pudo generar la imagen del campeonato.');
    } finally {
      setGeneratingStandingsImage(false);
    }
  };

  const toggleWarningFulfillment = async (driverId, amount, completed) => {
    if (!resultChampionshipId) return;
    const key = `${driverId}:${amount}`;
    setUpdatingWarningFulfillment(key);
    setChampionshipWarningsMessage('');
    try {
      const response = await championshipsApi.setWarningFulfillment(resultChampionshipId, driverId, amount, completed);
      setChampionshipWarningDrivers(current => current.map(driver => String(driver.idpiloto) === String(driverId)
        ? {
            ...driver,
            sanciones_alcanzadas: (driver.sanciones_alcanzadas || []).map(sanction => Number(sanction.cantidad) === Number(amount)
              ? { ...sanction, cumplida: completed }
              : sanction),
          }
        : driver));
      setChampionshipWarningsMessage(response.data.message || 'Estado de la sanción actualizado.');
    } catch (error) {
      setChampionshipWarningsMessage(error.response?.data?.error || 'No se pudo actualizar el cumplimiento de la sanción.');
    } finally {
      setUpdatingWarningFulfillment('');
    }
  };

  const handleResultFieldChange = (standing, round, currentResult, field, value) => {
    const resultKey = currentResult?._key
      || (currentResult?.id ? `id-${currentResult.id}` : `new-${standing.idpiloto}-${round.ronda}`);
    const normalizedValue = field.startsWith('pos_') ? value.toLocaleUpperCase('es-AR') : value;
    const fieldPatch = { [field]: normalizedValue };

    setResults(current => {
      const index = current.findIndex(result =>
        result._key === resultKey
        || (currentResult?.id && result.id === currentResult.id)
      );

      if (index >= 0) {
        return current.map((result, resultIndex) =>
          resultIndex === index
            ? { ...result, _key: resultKey, ...fieldPatch }
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
          ...fieldPatch,
        },
      ];
    });
    setDirtyResults(current => ({ ...current, [resultKey]: true }));
    setDirtyResultCells(current => ({ ...current, [`${resultKey}:${field}`]: true }));
    setResultMessage('');
  };

  const handleApplyAttendanceToRound = () => {
    if (!resultRound) return;
    const normalized = String(resultAttendancePoints).trim();
    if (!/^\d+$/.test(normalized)) {
      setResultMessage('El presentismo debe ser un número entero igual o mayor que cero.');
      return;
    }
    const attendance = Number(normalized);
    const targetKeys = new Set(resultRoundResults
      .filter(result => String(result.piloto || '').trim())
      .map(result => result._key || `id-${result.id}`));
    if (!targetKeys.size) {
      setResultMessage('Primero cargá los pilotos de esta fecha para poder aplicarles el presentismo.');
      return;
    }
    setResults(current => current.map(result => {
      const resultKey = result._key || `id-${result.id}`;
      return targetKeys.has(resultKey) ? { ...result, _key: resultKey, presentismo: attendance } : result;
    }));
    setDirtyResults(current => ({
      ...current,
      ...Object.fromEntries([...targetKeys].map(key => [key, true])),
    }));
    setDirtyResultCells(current => ({
      ...current,
      ...Object.fromEntries([...targetKeys].map(key => [`${key}:presentismo`, true])),
    }));
    setResultCellErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(':presentismo'))));
    setResultMessage(`Se aplicaron ${attendance} puntos de presentismo a ${targetKeys.size} piloto${targetKeys.size === 1 ? '' : 's'} de la Fecha ${resultRound.ronda}. Presioná Guardar para confirmar.`);
  };

  const saveResultRoundMultipliers = async () => {
    if (!resultRound || savingResultMultipliers) return;
    const sprint = Number(String(resultSprintMultiplier).replace(',', '.'));
    const final = Number(String(resultFinalMultiplier).replace(',', '.'));
    if (!Number.isFinite(sprint) || sprint < 0 || sprint > 10 || !Number.isFinite(final) || final < 0 || final > 10) {
      setResultMultiplierMessage('Los multiplicadores deben ser números entre 0 y 10.');
      return;
    }

    setSavingResultMultipliers(true);
    setResultMultiplierMessage('');
    try {
      await eventsApi.updateMultipliers(resultChampionshipId, resultRound.ronda, {
        multiplicador_sprint: sprint,
        multiplicador_final: final,
      });
      setEvents(current => current.map(event => (
        String(event.idcampeonato) === String(resultChampionshipId) && String(event.ronda) === String(resultRound.ronda)
          ? { ...event, multiplicador_sprint: sprint, multiplicador_final: final }
          : event
      )));

      const targetKeys = new Set(resultRoundResults
        .filter(result => String(result.piloto || '').trim())
        .map(result => result._key || `id-${result.id}`));
      setResults(current => current.map(result => {
        const resultKey = result._key || `id-${result.id}`;
        if (!targetKeys.has(resultKey)) return result;
        return {
          ...result,
          _key: resultKey,
          ...getScoringPatch('pos_sprint', result.pos_sprint, { sprint, final }),
          ...getScoringPatch('pos_final', result.pos_final, { sprint, final }),
        };
      }));
      if (targetKeys.size) {
        setDirtyResults(current => ({
          ...current,
          ...Object.fromEntries([...targetKeys].map(key => [key, true])),
        }));
        setDirtyResultCells(current => ({
          ...current,
          ...Object.fromEntries([...targetKeys].flatMap(key => [
            [`${key}:pts_sprint`, true],
            [`${key}:pts_final`, true],
          ])),
        }));
      }
      setResultMessage(targetKeys.size
        ? `Fecha ${resultRound.ronda}: Sprint x${formatResultPoints(sprint)} y Final x${formatResultPoints(final)}. Se recalcularon ${targetKeys.size} piloto${targetKeys.size === 1 ? '' : 's'}; presioná Guardar para confirmar los puntos.`
        : `Multiplicadores guardados para la Fecha ${resultRound.ronda}. Se aplicarán cuando cargues los resultados.`);
    } catch (error) {
      setResultMultiplierMessage(error.response?.data?.error || 'No se pudieron guardar los multiplicadores de la fecha.');
    } finally {
      setSavingResultMultipliers(false);
    }
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

  const openResultAchievementModal = result => {
    if (!result?.piloto) return;
    setResultAchievementModal(result);
    setResultAchievementDraft(Object.fromEntries(resultAchievementFields.map(field => [field.key, Boolean(Number(result[field.key]))])));
  };

  const applyResultAchievements = () => {
    if (!resultAchievementModal) return;
    resultAchievementFields.forEach(field => {
      const previousValue = Boolean(Number(resultAchievementModal[field.key]));
      if (previousValue !== Boolean(resultAchievementDraft[field.key])) {
        handleResultAchievementChange(resultAchievementModal, field.key);
      }
    });
    setResultAchievementModal(null);
    setResultMessage(`Marcas oficiales de ${resultAchievementModal.piloto} actualizadas. Presioná Guardar para confirmar.`);
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
    setDirtyResultCells(current => ({ ...current, [`${resultKey}:${pilotField}`]: true }));
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
    const pastedDirtyCells = {};
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
      const changedColumnKeys = new Set();
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
            changedColumnKeys.add(column.key);
          }
          continue;
        }

        const normalizedValue = column.type === 'position'
          ? rawValue.toLocaleUpperCase('es-AR')
          : rawValue;
        if (String(nextResult[column.key] ?? '') !== normalizedValue) {
          nextResult[column.key] = normalizedValue;
          rowChanged = true;
          changedColumnKeys.add(column.key);
        }
      }

      if (!rowChanged) continue;
      const resultKey = nextResult._key || `id-${nextResult.id}`;
      nextResult._key = resultKey;
      pastedDirtyResults[resultKey] = true;
      changedColumnKeys.forEach(columnKey => { pastedDirtyCells[`${resultKey}:${columnKey}`] = true; });
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
    setDirtyResultCells(current => ({ ...current, ...pastedDirtyCells }));
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
    const clearedDirtyCells = {};
    let clearedCells = 0;

    for (let rowIndex = bounds.firstRow; rowIndex <= bounds.lastRow; rowIndex += 1) {
      const row = resultSheetRows[rowIndex];
      if (!row?.result) continue;

      const originalResult = row.result;
      const nextResult = { ...originalResult };
      let rowChanged = false;
      const changedColumnKeys = new Set();

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
            changedColumnKeys.add(column.key);
          }
          continue;
        }

        if (String(nextResult[column.key] ?? '') !== '') {
          nextResult[column.key] = '';
          rowChanged = true;
          clearedCells += 1;
          changedColumnKeys.add(column.key);
        }
      }

      if (!rowChanged) continue;
      const resultKey = nextResult._key || `id-${nextResult.id}`;
      nextResult._key = resultKey;
      clearedDirtyResults[resultKey] = true;
      changedColumnKeys.forEach(columnKey => { clearedDirtyCells[`${resultKey}:${columnKey}`] = true; });
      const resultIndex = nextResults.findIndex(result => result === originalResult);
      if (resultIndex >= 0) nextResults[resultIndex] = nextResult;
    }

    if (!clearedCells) return;
    setResults(nextResults);
    setDirtyResults(current => ({ ...current, ...clearedDirtyResults }));
    setDirtyResultCells(current => ({ ...current, ...clearedDirtyCells }));
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
      setDirtyResultCells(current => Object.fromEntries(Object.entries(current).filter(([key]) => (
        ![...emptyKeys].some(emptyKey => key.startsWith(`${emptyKey}:`))
      ))));
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
    const signedFields = [
      ['kg_sprint', 'KG Sprint'],
      ['kg_final', 'KG Final'],
    ];
    const resultGroups = [
      {
        pilotField: 'piloto',
        label: 'clasificación',
        fields: ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'desc_sancion_qualy_sprint', 'pos_qualy_final', 'pts_qualy_final', 'desc_sancion_qualy_final', ...resultAchievementFields.map(field => field.key)],
        detailSessions: ['qualy_sprint', 'qualy_final'],
      },
      { pilotField: 'piloto_sprint', label: 'Sprint', fields: ['pos_sprint', 'pts_sprint', 'kg_sprint', 'rec_tiempo_sprint', 'rec_pos_sprint', 'aps_sprint', 'kg_sancion_sprint', 'desc_sancion_sprint'], detailSessions: ['sprint'] },
      { pilotField: 'piloto_final', label: 'Final', fields: ['pos_final', 'pts_final', 'kg_final', 'rec_tiempo_final', 'rec_pos_final', 'aps_final', 'kg_sancion_final', 'desc_sancion_final'], detailSessions: ['final'] },
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
      signedFields.forEach(([field, label]) => {
        if (/^-?\d*[.,]?\d*$/.test(String(result[field] ?? '').trim())) return;
        const message = `${label} debe ser un número y puede ser negativo.`;
        validationErrors[`${resultKey}:${field}`] = message;
        validationMessages.push(message);
      });
      resultScoringFields.forEach(scoringField => {
        const position = String(result[scoringField.positionField] ?? '').trim();
        const points = parseResultPoints(result[scoringField.pointsField]);
        if (!position || parseNumericPosition(position) || points === 0) return;
        const message = `${scoringField.label}: no se pueden asignar puntos a una posición no numérica (${position}).`;
        validationErrors[`${resultKey}:${scoringField.pointsField}`] = message;
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
      const editableFields = ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'pos_sprint', 'pts_sprint', 'kg_sprint', 'pos_qualy_final', 'pts_qualy_final', 'pos_final', 'pts_final', 'kg_final', 'sanciones_detalle', ...resultSanctionFields.map(field => field.key), ...resultStructuredSanctionFields, ...resultAchievementFields.map(field => field.key)];
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
            if (group.detailSessions?.length) {
              const details = parseResultSanctionDetails(assignment.data.sanciones_detalle);
              group.detailSessions.forEach(sessionKey => {
                const sessionItems = sessionKey === 'sprint' || sessionKey === 'final'
                  ? result[`_sanciones_detalle_${sessionKey}`]
                  : parseResultSanctionDetails(result.sanciones_detalle)[sessionKey];
                details[sessionKey] = Array.isArray(sessionItems) ? sessionItems : [];
              });
              assignment.data.sanciones_detalle = details;
            }
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
            kg_sprint: parseResultPoints(data.kg_sprint),
            pos_qualy_final: String(data.pos_qualy_final || '').trim(),
            pts_qualy_final: Number(data.pts_qualy_final || 0),
            pos_final: String(data.pos_final || '').trim(),
            pts_final: parseResultPoints(data.pts_final),
            kg_final: parseResultPoints(data.kg_final),
            desc_sancion_qualy_sprint: String(data.desc_sancion_qualy_sprint || '').trim(),
            desc_sancion_sprint: String(data.desc_sancion_sprint || '').trim(),
            desc_sancion_qualy_final: String(data.desc_sancion_qualy_final || '').trim(),
            desc_sancion_final: String(data.desc_sancion_final || '').trim(),
            sanciones_detalle: parseResultSanctionDetails(data.sanciones_detalle),
            rec_tiempo_sprint: Number(data.rec_tiempo_sprint || 0),
            rec_pos_sprint: Number(data.rec_pos_sprint || 0),
            aps_sprint: Number(data.aps_sprint || 0),
            kg_sancion_sprint: Number(data.kg_sancion_sprint || 0),
            rec_tiempo_final: Number(data.rec_tiempo_final || 0),
            rec_pos_final: Number(data.rec_pos_final || 0),
            aps_final: Number(data.aps_final || 0),
            kg_sancion_final: Number(data.kg_sancion_final || 0),
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

      const [response, warningsResponse] = await Promise.all([
        resultsApi.getAll({ idcampeonato: resultChampionshipId }),
        championshipsApi.getWarnings(resultChampionshipId),
      ]);
      const savedRows = response.data.data ?? [];
      setResults(buildEditableResultRows(savedRows));
      setSavedResults(savedRows);
      setChampionshipWarningDrivers(warningsResponse.data.data?.pilotos || []);
      setDirtyResults({});
      setDirtyResultCells({});
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
        idcircuito: serializeEventCircuit(eventForm.idcircuito),
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
        idcircuito: serializeEventCircuit(row.idcircuito),
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
      regla_porcentaje: String(championship.regla_porcentaje ?? 0),
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
      idcircuito: isPendingCircuitName(event.circuito) ? pendingCircuitValue : event.idcircuito || '',
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
      const chunkSize = 8 * 1024 * 1024;
      const totalChunks = Math.ceil(replayFile.size / chunkSize);
      const initResponse = await replaysApi.initUpload({
        idcampeonato: replayForm.idcampeonato,
        ronda: replayForm.ronda,
        tanda: replayForm.tanda.trim(),
        nombre_original: replayFile.name,
        tamano: replayFile.size,
        total_chunks: totalChunks,
        chunk_size: chunkSize,
      });
      const uploadId = initResponse.data.data.uploadId;
      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * chunkSize;
        const chunk = replayFile.slice(start, Math.min(replayFile.size, start + chunkSize));
        const data = new FormData();
        data.append('index', String(index));
        data.append('chunk', chunk, `${replayFile.name}.part-${index + 1}`);
        let attempt = 0;
        while (attempt < 3) {
          try {
            await replaysApi.uploadChunk(uploadId, data, progressEvent => {
              const loaded = Number(progressEvent.loaded || 0);
              const uploadedBytes = Math.min(replayFile.size, start + loaded);
              setReplayUploadProgress(Math.min(99, Math.max(0, Math.round((uploadedBytes / replayFile.size) * 100))));
            });
            break;
          } catch (chunkError) {
            attempt += 1;
            if (attempt >= 3 || (chunkError.response?.status && chunkError.response.status < 500)) throw chunkError;
          }
        }
        setReplayUploadProgress(Math.min(99, Math.round(((index + 1) / totalChunks) * 100)));
      }
      setReplayUploadProgress(100);
      const response = await replaysApi.completeUpload(uploadId);
      const refreshed = await replaysApi.getAll();
      setReplays(refreshed.data.data || []);
      setReplayFile(null);
      if (replayInputRef.current) replayInputRef.current.value = '';
      setReplayMessage(response.data.message || 'Repetición publicada correctamente.');
    } catch (error) {
      const status = error.response?.status;
      setReplayMessage(error.response?.data?.error || (status === 413
        ? 'El servidor rechazó uno de los bloques por su tamaño. Revisá el límite de carga de Hostinger.'
        : 'La subida se interrumpió. Podés volver a intentarlo; el archivo se envía en bloques para evitar cortes por su tamaño.'));
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

  const resetProjectForm = () => {
    setProjectForm(emptyProjectForm);
    setProjectPhotoFiles([]);
    setEditingProjectId(null);
    if (projectPhotosInputRef.current) projectPhotosInputRef.current.value = '';
  };

  const editProject = project => {
    setEditingProjectId(project.id);
    setProjectForm({ tipo: project.tipo || 'categoria', titulo: project.titulo || '', descripcion: project.descripcion || '', activo: Boolean(project.activo) });
    setProjectPhotoFiles([]);
    if (projectPhotosInputRef.current) projectPhotosInputRef.current.value = '';
    setProjectMessage(`Editando ${project.titulo}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveProject = async event => {
    event.preventDefault();
    if (!projectForm.titulo.trim()) return;
    setSavingProject(true);
    setProjectMessage('');
    try {
      const data = new FormData();
      data.append('tipo', projectForm.tipo);
      data.append('titulo', projectForm.titulo.trim());
      data.append('descripcion', projectForm.descripcion.trim());
      data.append('activo', String(projectForm.activo));
      projectPhotoFiles.forEach(file => data.append('fotos', file));
      const response = editingProjectId ? await projectsApi.update(editingProjectId, data) : await projectsApi.create(data);
      const refreshed = await projectsApi.getAdminAll();
      setProjects(refreshed.data.data || []);
      resetProjectForm();
      setProjectMessage(response.data.message || 'Proyecto guardado correctamente.');
    } catch (error) {
      setProjectMessage(error.response?.data?.error || 'No se pudo guardar el proyecto.');
    } finally { setSavingProject(false); }
  };

  const deleteProjectPhoto = async (project, photo) => {
    if (!window.confirm(`¿Eliminar esta imagen de ${project.titulo}?`)) return;
    try {
      await projectsApi.removePhoto(project.id, photo.id);
      setProjects(current => current.map(item => String(item.id) === String(project.id) ? { ...item, fotos: item.fotos.filter(image => image.id !== photo.id) } : item));
    } catch (error) { setProjectMessage(error.response?.data?.error || 'No se pudo eliminar la imagen.'); }
  };

  const deleteProject = async project => {
    if (!window.confirm(`¿Eliminar el proyecto ${project.titulo} y todas sus imágenes?`)) return;
    try {
      const response = await projectsApi.remove(project.id);
      setProjects(current => current.filter(item => String(item.id) !== String(project.id)));
      if (String(editingProjectId) === String(project.id)) resetProjectForm();
      setProjectMessage(response.data.message || 'Proyecto eliminado correctamente.');
    } catch (error) { setProjectMessage(error.response?.data?.error || 'No se pudo eliminar el proyecto.'); }
  };

  const resetSponsorForm = () => {
    setSponsorForm(emptySponsorForm);
    setSponsorLogoFile(null);
    setSponsorPhotoFiles([]);
    setEditingSponsorId(null);
    if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    if (sponsorPhotosInputRef.current) sponsorPhotosInputRef.current.value = '';
  };

  const editSponsor = sponsor => {
    setEditingSponsorId(sponsor.id);
    setSponsorForm({
      empresa: sponsor.empresa || '',
      descripcion: sponsor.descripcion || '',
      ubicacion: sponsor.ubicacion || sponsor.direccion || '',
      contacto: sponsor.contacto || '',
      sitio: sponsor.sitio || '',
      activo: Boolean(sponsor.activo),
    });
    setSponsorLogoFile(null);
    setSponsorPhotoFiles([]);
    if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    if (sponsorPhotosInputRef.current) sponsorPhotosInputRef.current.value = '';
    setSponsorMessage(`Editando ${sponsor.empresa}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveSponsor = async event => {
    event.preventDefault();
    if (!sponsorForm.empresa.trim()) return;
    setSavingSponsor(true);
    setSponsorMessage('');
    try {
      const data = new FormData();
      data.append('empresa', sponsorForm.empresa.trim());
      data.append('descripcion', sponsorForm.descripcion.trim());
      data.append('ubicacion', sponsorForm.ubicacion.trim());
      data.append('contacto', sponsorForm.contacto.trim());
      data.append('sitio', sponsorForm.sitio.trim());
      data.append('activo', String(sponsorForm.activo));
      if (sponsorLogoFile) data.append('logo', sponsorLogoFile);
      sponsorPhotoFiles.forEach(file => data.append('fotos', file));
      const response = editingSponsorId
        ? await sponsorsApi.update(editingSponsorId, data)
        : await sponsorsApi.create(data);
      const refreshed = await sponsorsApi.getAdminAll();
      setSponsors(refreshed.data.data || []);
      resetSponsorForm();
      setSponsorMessage(response.data.message || 'Sponsor guardado correctamente.');
    } catch (error) {
      setSponsorMessage(error.response?.data?.error || 'No se pudo guardar el sponsor.');
    } finally {
      setSavingSponsor(false);
    }
  };

  const deleteSponsorPhoto = async (sponsor, photo) => {
    if (!window.confirm(`¿Eliminar esta foto de ${sponsor.empresa}?`)) return;
    setSponsorMessage('');
    try {
      await sponsorsApi.removePhoto(sponsor.id, photo.id);
      setSponsors(current => current.map(item => String(item.id) === String(sponsor.id)
        ? { ...item, fotos: (item.fotos || []).filter(itemPhoto => String(itemPhoto.id) !== String(photo.id)) }
        : item));
      setSponsorMessage('Foto eliminada correctamente.');
    } catch (error) {
      setSponsorMessage(error.response?.data?.error || 'No se pudo eliminar la foto.');
    }
  };

  const deleteSponsor = async sponsor => {
    if (!window.confirm(`¿Eliminar a ${sponsor.empresa} y toda su galería?`)) return;
    setSponsorMessage('');
    try {
      const response = await sponsorsApi.remove(sponsor.id);
      setSponsors(current => current.filter(item => String(item.id) !== String(sponsor.id)));
      if (String(editingSponsorId) === String(sponsor.id)) resetSponsorForm();
      setSponsorMessage(response.data.message || 'Sponsor eliminado correctamente.');
    } catch (error) {
      setSponsorMessage(error.response?.data?.error || 'No se pudo eliminar el sponsor.');
    }
  };

  const editComplaint = complaint => {
    setEditingComplaint({
      ...complaint,
      idcampeonato: String(complaint.idcampeonato),
      ronda: String(complaint.ronda),
      idpiloto_denunciado: String(complaint.idpiloto_denunciado),
      descripcion: complaint.descripcion || '',
    });
    setComplaintMessage('');
  };

  const saveComplaint = async event => {
    event.preventDefault();
    if (!editingComplaint || savingComplaint) return;
    setSavingComplaint(true);
    setComplaintMessage('');
    try {
      const response = await complaintsApi.update(editingComplaint.id, editingComplaint);
      const refreshed = await complaintsApi.getAdminAll();
      setComplaints(refreshed.data.data || []);
      setEditingComplaint(null);
      setComplaintMessage(response.data.message || 'Denuncia actualizada correctamente.');
    } catch (error) {
      setComplaintMessage(error.response?.data?.error || 'No se pudo actualizar la denuncia.');
    } finally {
      setSavingComplaint(false);
    }
  };

  const deleteComplaint = async complaint => {
    if (!window.confirm(`¿Eliminar la denuncia contra ${complaint.piloto}?`)) return;
    setComplaintMessage('');
    try {
      const response = await complaintsApi.remove(complaint.id);
      setComplaints(current => current.filter(item => String(item.id) !== String(complaint.id)));
      if (String(editingComplaint?.id) === String(complaint.id)) setEditingComplaint(null);
      setComplaintMessage(response.data.message || 'Denuncia eliminada correctamente.');
    } catch (error) {
      setComplaintMessage(error.response?.data?.error || 'No se pudo eliminar la denuncia.');
    }
  };

  const toggleComplaintSeen = async complaint => {
    const nextSeen = !complaint.visto;
    setComplaints(current => current.map(item => String(item.id) === String(complaint.id) ? { ...item, visto: nextSeen } : item));
    try {
      await complaintsApi.markSeen(complaint.id, nextSeen);
    } catch (error) {
      setComplaints(current => current.map(item => String(item.id) === String(complaint.id) ? { ...item, visto: complaint.visto } : item));
      setComplaintMessage(error.response?.data?.error || 'No se pudo actualizar el estado de la denuncia.');
    }
  };

  const renderSection = () => {
    if (activeSection === 'votaciones') return <PollsAdmin />;
    if (activeSection === 'relaciones-caja') return <div className="space-y-12"><GearRatioCalculator/><EnginePowerCalculator/><BrakesCalculator/><TyresCalculator/></div>;

    if (activeSection === 'denuncias') {
      const filteredComplaints = complaints.filter(item =>
        !complaintChampionshipFilter || String(item.idcampeonato) === complaintChampionshipFilter
      ).filter(item => !complaintRoundFilter || String(item.ronda) === complaintRoundFilter);
      const complaintRounds = events
        .filter(item => String(item.idcampeonato) === complaintChampionshipFilter)
        .sort((a, b) => Number(b.ronda) - Number(a.ronda));
      const complaintMinute = value => {
        const [minutes = 0, seconds = 0] = String(value || '0').replace(',', '.').replace(':', '.').split('.').map(Number);
        return (Number(minutes) * 60) + Number(seconds);
      };
      const complaintsBySession = ['SPRINT', 'FINAL'].map(session => ({
        session,
        items: filteredComplaints.filter(item => item.tanda === session).sort((a, b) => complaintMinute(a.minuto_repeticion) - complaintMinute(b.minuto_repeticion) || Number(a.id) - Number(b.id)),
      }));
      const editingRounds = editingComplaint
        ? events.filter(item => String(item.idcampeonato) === String(editingComplaint.idcampeonato)).sort((a, b) => Number(a.ronda) - Number(b.ronda))
        : [];
      const editingDrivers = editingComplaint
        ? registrations.filter(item => String(item.idcampeonato) === String(editingComplaint.idcampeonato)).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es-AR', { sensitivity: 'base' }))
        : [];
      return (
        <div className="space-y-6">
          <header className="flex flex-col gap-4 border-b border-racing-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-racing-red">Revisión deportiva</p><h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Denuncias recibidas</h2><p className="mt-1 text-sm text-gray-500">{filteredComplaints.length} denuncia{filteredComplaints.length === 1 ? '' : 's'}.</p></div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto"><label className="w-full lg:w-80"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Campeonato</span><select value={complaintChampionshipFilter} onChange={event => { setComplaintChampionshipFilter(event.target.value); setComplaintRoundFilter(''); }} className="input-field mt-1.5 py-2.5"><option value="">Todos los campeonatos</option>{championships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label><label className="w-full lg:w-72"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fecha</span><select value={complaintRoundFilter} onChange={event => setComplaintRoundFilter(event.target.value)} disabled={!complaintChampionshipFilter} className="input-field mt-1.5 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"><option value="">Todas las fechas</option>{complaintRounds.map(item => <option key={`${item.idcampeonato}-${item.ronda}`} value={item.ronda}>Fecha {item.ronda} · {item.circuito}</option>)}</select></label></div>
          </header>

          {complaintMessage ? <p className="border border-racing-border bg-black/25 p-3 text-sm text-gray-300">{complaintMessage}</p> : null}

          {editingComplaint ? <section className="border border-racing-red/35 bg-racing-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">Modificando denuncia #{editingComplaint.id}</p><h3 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Corregir datos</h3></div><button type="button" onClick={() => setEditingComplaint(null)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-400 hover:border-white hover:text-white" aria-label="Cerrar edición"><XMarkIcon className="h-5 w-5" /></button></div>
            <form onSubmit={saveComplaint} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label><span className="text-sm text-gray-300">Campeonato</span><select value={editingComplaint.idcampeonato} onChange={event => setEditingComplaint(current => ({ ...current, idcampeonato: event.target.value, ronda: '', idpiloto_denunciado: '' }))} className="input-field mt-2" required>{championships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label>
              <label><span className="text-sm text-gray-300">Fecha</span><select value={editingComplaint.ronda} onChange={event => setEditingComplaint(current => ({ ...current, ronda: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar fecha</option>{editingRounds.map(item => <option key={item.id} value={item.ronda}>Fecha {item.ronda} · {item.circuito}</option>)}</select></label>
              <label><span className="text-sm text-gray-300">Piloto denunciado</span><select value={editingComplaint.idpiloto_denunciado} onChange={event => setEditingComplaint(current => ({ ...current, idpiloto_denunciado: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar piloto</option>{editingDrivers.map(item => <option key={item.idpiloto} value={item.idpiloto}>{item.nombre}</option>)}</select></label>
              <label><span className="text-sm text-gray-300">Tanda</span><select value={editingComplaint.tanda} onChange={event => setEditingComplaint(current => ({ ...current, tanda: event.target.value }))} className="input-field mt-2" required><option value="SPRINT">Sprint</option><option value="FINAL">Final</option></select></label>
              <label><span className="text-sm text-gray-300">Minuto</span><input value={editingComplaint.minuto_repeticion} onChange={event => setEditingComplaint(current => ({ ...current, minuto_repeticion: event.target.value }))} className="input-field mt-2" placeholder="1.24" required /></label>
              <label className="md:col-span-2 xl:col-span-3"><span className="text-sm text-gray-300">Descripción</span><input value={editingComplaint.descripcion} onChange={event => setEditingComplaint(current => ({ ...current, descripcion: event.target.value }))} className="input-field mt-2" maxLength={1000} /></label>
              <div className="flex gap-2 md:col-span-2 xl:col-span-4"><button type="submit" disabled={savingComplaint} className="bg-racing-red px-6 py-3 font-racing text-xs font-bold uppercase text-white hover:bg-racing-red-dark disabled:opacity-50">{savingComplaint ? 'Guardando...' : 'Guardar cambios'}</button><button type="button" onClick={() => setEditingComplaint(null)} className="border border-racing-border px-5 py-3 font-racing text-xs font-bold uppercase text-gray-300 hover:border-white">Cancelar</button></div>
            </form>
          </section> : null}

          <section className="space-y-6">
            {complaintsBySession.map(group => group.items.length ? <div key={group.session} className="overflow-hidden border border-racing-border bg-racing-card"><div className="flex items-center justify-between border-b border-racing-border bg-black/30 px-4 py-3"><h3 className="font-racing text-xl font-bold uppercase text-white">{group.session}</h3><span className="rounded-full bg-racing-red/15 px-3 py-1 text-xs font-bold text-racing-red">{group.items.length}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-racing-border text-[9px] font-bold uppercase tracking-widest text-gray-500"><th className="w-16 px-3 py-2 text-center">Vista</th><th className="w-20 px-3 py-2">Minuto</th><th className="w-56 px-3 py-2">Piloto</th><th className="px-3 py-2">Descripción</th><th className="w-24 px-3 py-2 text-right">Acciones</th></tr></thead><tbody>{group.items.map(complaint => <tr key={complaint.id} className={`border-b border-racing-border/70 last:border-b-0 ${complaint.visto ? 'bg-black/10 text-gray-500' : 'bg-racing-red/[0.06] text-gray-200'}`}><td className="px-3 py-2 text-center"><input type="checkbox" checked={Boolean(complaint.visto)} onChange={() => toggleComplaintSeen(complaint)} className="h-4 w-4 cursor-pointer accent-violet-500" aria-label={`Marcar denuncia contra ${complaint.piloto} como ${complaint.visto ? 'pendiente' : 'vista'}`}/></td><td className="px-3 py-2 font-racing text-lg font-bold text-yellow-200">{complaint.minuto_repeticion}</td><td className="px-3 py-2"><strong className="block whitespace-nowrap text-sm text-white">{complaint.piloto}</strong></td><td className="px-3 py-2"><p className="text-sm leading-relaxed text-gray-300">{complaint.descripcion || <span className="italic text-gray-600">Sin descripción adicional.</span>}</p></td><td className="px-3 py-2"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => editComplaint(complaint)} className="inline-flex h-8 w-8 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-white" aria-label="Editar denuncia"><PencilSquareIcon className="h-4 w-4"/></button><button type="button" onClick={() => deleteComplaint(complaint)} className="inline-flex h-8 w-8 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar denuncia"><TrashIcon className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div></div> : null)}
            {!filteredComplaints.length ? <div className="border border-dashed border-racing-border py-20 text-center"><ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-700"/><p className="mt-3 text-sm text-gray-500">No hay denuncias registradas para este filtro.</p></div> : null}
          </section>
        </div>
      );
    }

    if (activeSection === 'proyectos') {
      return (
        <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="card-glass self-start p-5 sm:p-6 xl:sticky xl:top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Categorías y circuitos</p>
            <h2 className="mt-2 font-racing text-2xl font-bold">{editingProjectId ? 'Modificar proyecto' : 'Agregar proyecto'}</h2>
            <form onSubmit={saveProject} className="mt-6 space-y-4">
              <label className="block"><span className="text-sm text-gray-300">Tipo</span><select value={projectForm.tipo} onChange={event => setProjectForm(current => ({ ...current, tipo: event.target.value }))} className="input-field mt-2"><option value="categoria">Categoría</option><option value="circuito">Circuito</option></select></label>
              <label className="block"><span className="text-sm text-gray-300">Título</span><input value={projectForm.titulo} onChange={event => setProjectForm(current => ({ ...current, titulo: event.target.value }))} className="input-field mt-2" placeholder="Nombre del proyecto" required/></label>
              <label className="block"><span className="text-sm text-gray-300">Descripción</span><textarea value={projectForm.descripcion} onChange={event => setProjectForm(current => ({ ...current, descripcion: event.target.value }))} className="input-field mt-2 min-h-36 resize-y" placeholder="Información y estado del proyecto..."/></label>
              <label className="block"><span className="text-sm text-gray-300">Imágenes</span><input ref={projectPhotosInputRef} type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setProjectPhotoFiles(Array.from(event.target.files || []).slice(0, 20))} className="input-field mt-2 file:mr-3 file:border-0 file:bg-racing-red file:px-3 file:py-2 file:font-semibold file:text-white"/><small className="mt-1 block text-gray-500">Hasta 20 imágenes nuevas por carga, 8 MB cada una.</small></label>
              <label className="flex cursor-pointer items-center justify-between gap-4 border border-racing-border bg-black/25 px-4 py-3"><span><strong className="block text-sm text-white">Visible en Proyectos</strong><span className="text-xs text-gray-500">Podés ocultarlo sin eliminarlo.</span></span><input type="checkbox" checked={projectForm.activo} onChange={event => setProjectForm(current => ({ ...current, activo: event.target.checked }))} className="h-5 w-5 accent-red-500"/></label>
              <div className="grid gap-2 sm:grid-cols-2"><button type="submit" disabled={savingProject} className="min-h-12 bg-racing-red px-5 font-racing text-sm font-bold uppercase text-white hover:bg-racing-red-dark disabled:opacity-50">{savingProject ? 'Guardando...' : editingProjectId ? 'Guardar cambios' : 'Agregar proyecto'}</button>{editingProjectId ? <button type="button" onClick={() => { resetProjectForm(); setProjectMessage(''); }} className="min-h-12 border border-racing-border px-4 font-racing text-xs font-bold uppercase text-gray-300 hover:border-white">Cancelar</button> : null}</div>
              {projectMessage ? <p className="border border-racing-border bg-black/30 p-3 text-sm text-gray-300">{projectMessage}</p> : null}
            </form>
          </section>
          <div className="space-y-10">
            <AdminProjectList type="categoria" projects={projects} onEdit={editProject} onDelete={deleteProject} onDeletePhoto={deleteProjectPhoto}/>
            <AdminProjectList type="circuito" projects={projects} onEdit={editProject} onDelete={deleteProject} onDeletePhoto={deleteProjectPhoto}/>
          </div>
        </div>
      );
    }

    if (activeSection === 'sponsors') {
      return (
        <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="card-glass self-start p-5 xl:sticky xl:top-24 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Presencia comercial</p>
            <h2 className="mt-2 font-racing text-2xl font-bold">{editingSponsorId ? 'Modificar sponsor' : 'Agregar sponsor'}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">Cargá la empresa, su identidad y las imágenes que se mostrarán en la sección comercial del inicio.</p>
            <form onSubmit={saveSponsor} className="mt-6 space-y-4">
              <label className="block"><span className="text-sm text-gray-300">Empresa o emprendimiento</span><input value={sponsorForm.empresa} onChange={event => setSponsorForm(current => ({ ...current, empresa: event.target.value }))} className="input-field mt-2" placeholder="Nombre comercial" required/></label>
              <label className="block"><span className="text-sm text-gray-300">Descripción</span><textarea value={sponsorForm.descripcion} onChange={event => setSponsorForm(current => ({ ...current, descripcion: event.target.value }))} className="input-field mt-2 min-h-28 resize-y" placeholder="Contá brevemente a qué se dedica..."/></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm text-gray-300">Ubicación</span><input value={sponsorForm.ubicacion} onChange={event => setSponsorForm(current => ({ ...current, ubicacion: event.target.value }))} className="input-field mt-2" placeholder="Ciudad, provincia o dirección"/></label><label className="block"><span className="text-sm text-gray-300">Contacto</span><input value={sponsorForm.contacto} onChange={event => setSponsorForm(current => ({ ...current, contacto: event.target.value }))} className="input-field mt-2" placeholder="Teléfono, WhatsApp o correo"/></label></div>
              <label className="block"><span className="text-sm text-gray-300">Sitio web</span><input value={sponsorForm.sitio} onChange={event => setSponsorForm(current => ({ ...current, sitio: event.target.value }))} className="input-field mt-2" placeholder="www.empresa.com.ar"/></label>
              <label className="block"><span className="text-sm text-gray-300">Logo</span><input ref={sponsorLogoInputRef} type="file" accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setSponsorLogoFile(event.target.files?.[0] || null)} className="input-field mt-2 file:mr-3 file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:font-semibold file:text-black"/><small className="mt-1 block text-gray-500">PNG transparente, WEBP, JPG o AVIF. Máximo 8 MB.</small></label>
              <label className="block"><span className="text-sm text-gray-300">Fotos de la galería</span><input ref={sponsorPhotosInputRef} type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setSponsorPhotoFiles(Array.from(event.target.files || []).slice(0, 10))} className="input-field mt-2 file:mr-3 file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:font-semibold file:text-black"/><small className="mt-1 block text-gray-500">Hasta 10 imágenes nuevas por carga.</small></label>
              <label className="flex cursor-pointer items-center justify-between gap-4 border border-racing-border bg-black/25 px-4 py-3"><span><strong className="block text-sm text-white">Visible en el inicio</strong><span className="text-xs text-gray-500">Podés ocultarlo sin eliminar sus datos.</span></span><input type="checkbox" checked={sponsorForm.activo} onChange={event => setSponsorForm(current => ({ ...current, activo: event.target.checked }))} className="h-5 w-5 accent-cyan-400"/></label>
              <div className="grid gap-2 sm:grid-cols-2"><button type="submit" disabled={savingSponsor} className="inline-flex min-h-12 items-center justify-center gap-2 bg-cyan-300 px-5 font-racing text-sm font-bold uppercase text-black transition hover:bg-cyan-200 disabled:opacity-50">{savingSponsor ? 'Guardando...' : editingSponsorId ? 'Guardar cambios' : 'Agregar sponsor'}</button>{editingSponsorId ? <button type="button" onClick={() => { resetSponsorForm(); setSponsorMessage(''); }} className="min-h-12 border border-racing-border px-4 font-racing text-xs font-bold uppercase text-gray-300 hover:border-white hover:text-white">Cancelar</button> : null}</div>
              {sponsorMessage ? <p className="border border-racing-border bg-black/30 p-3 text-sm text-gray-300">{sponsorMessage}</p> : null}
            </form>
          </section>

          <section className="space-y-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Sponsors cargados</p><h2 className="mt-1 font-racing text-3xl font-bold">Empresas y emprendimientos</h2><p className="mt-1 text-sm text-gray-500">{sponsors.length} sponsor{sponsors.length === 1 ? '' : 's'} registrado{sponsors.length === 1 ? '' : 's'}.</p></div>
            {sponsors.length ? sponsors.map(sponsor => <article key={sponsor.id} className={`card-glass overflow-hidden border-l-4 ${sponsor.activo ? 'border-l-cyan-300' : 'border-l-gray-700 opacity-70'}`}>
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
                {sponsor.logo ? <img src={sponsor.logo} alt={`Logo de ${sponsor.empresa}`} className="h-32 w-full shrink-0 object-contain sm:w-44"/> : <BuildingOffice2Icon className="h-12 w-12 shrink-0 text-gray-700"/>}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-racing text-2xl font-bold uppercase text-white">{sponsor.empresa}</h3><span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${sponsor.activo ? 'bg-cyan-300 text-black' : 'bg-gray-700 text-gray-300'}`}>{sponsor.activo ? 'Visible' : 'Oculto'}</span></div><div className="mt-1 space-y-0.5 text-xs text-cyan-300">{sponsor.ubicacion ? <p>{sponsor.ubicacion}</p> : null}{sponsor.contacto ? <p>{sponsor.contacto}</p> : null}{sponsor.sitio ? <p className="break-all">{sponsor.sitio}</p> : null}</div></div><div className="flex gap-2"><button type="button" onClick={() => editSponsor(sponsor)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-cyan-300 hover:text-cyan-300" aria-label={`Editar ${sponsor.empresa}`}><PencilSquareIcon className="h-4 w-4"/></button><button type="button" onClick={() => deleteSponsor(sponsor)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red hover:text-racing-red" aria-label={`Eliminar ${sponsor.empresa}`}><TrashIcon className="h-4 w-4"/></button></div></div>{sponsor.descripcion ? <p className="mt-3 text-sm leading-relaxed text-gray-400">{sponsor.descripcion}</p> : null}</div>
              </div>
              <div className="border-t border-racing-border bg-black/20 p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Galería · {(sponsor.fotos || []).length} fotos</p><button type="button" onClick={() => editSponsor(sponsor)} className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-white">Agregar fotos</button></div>{sponsor.fotos?.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">{sponsor.fotos.map(photo => <div key={photo.id} className="group relative aspect-video overflow-hidden bg-black"><img src={photo.imagen} alt={`${sponsor.empresa}`} className="h-full w-full object-cover"/><button type="button" onClick={() => deleteSponsorPhoto(sponsor, photo)} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center bg-black/85 text-gray-300 transition hover:bg-racing-red hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label="Eliminar foto"><TrashIcon className="h-4 w-4"/></button></div>)}</div> : <div className="border border-dashed border-racing-border py-7 text-center text-xs text-gray-600">Todavía no tiene fotos cargadas.</div>}</div>
            </article>) : <div className="card-glass border border-dashed border-racing-border py-16 text-center"><BuildingOffice2Icon className="mx-auto h-12 w-12 text-gray-700"/><p className="mt-3 text-sm text-gray-500">Todavía no hay sponsors cargados.</p></div>}
          </section>
        </div>
      );
    }

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
      const assignedModelLimit = registrationConfig.autos_habilitados.reduce((total, carId) => total + Number(registrationConfig.limites_por_modelo?.[carId] || 0), 0);
      const modelLimitDifference = Number(registrationConfig.limite_inscriptos || 0) - assignedModelLimit;
      const freeDriverIds = new Set(registrationConfig.pilotos_gratis || []);
      const selectedFreeDrivers = drivers.filter(driver => freeDriverIds.has(Number(driver.id)))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es-AR', { sensitivity: 'base' }));
      const normalizedFreeDriverSearch = freeDriverSearch.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const freeDriverCandidates = drivers.filter(driver => {
        if (freeDriverIds.has(Number(driver.id))) return false;
        const searchable = `${driver.nombre || ''} ${driver.localidad || ''}`.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return !normalizedFreeDriverSearch || searchable.includes(normalizedFreeDriverSearch);
      }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es-AR', { sensitivity: 'base' })).slice(0, 12);
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
              {registrationConfigs.map(item => <div key={item.idcampeonato} className={`flex items-center gap-2 border p-2 ${String(item.idcampeonato) === String(registrationConfigChampionshipId) ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><button type="button" onClick={() => selectRegistrationConfigChampionship(String(item.idcampeonato))} className="min-w-0 flex-1 px-2 py-1 text-left"><div className="flex items-center justify-between gap-3"><span className="truncate font-semibold">{item.categoria} · T{item.temporada}</span><span className={`text-xs font-bold uppercase ${item.phase === 'open' ? 'text-green-400' : item.phase === 'full' ? 'text-yellow-300' : 'text-gray-500'}`}>{item.phase === 'open' ? 'Abierto' : item.phase === 'upcoming' ? 'Próximo' : item.phase === 'full' ? 'Completo' : 'Cerrado'}</span></div><p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-400">Pilotos:</span> Manuales {Number(item.preinscriptos || 0)} · Reales {Number(item.inscriptos_actuales || 0)} · Límite {Number(item.limite_inscriptos || 0)}</p></button><button type="button" onClick={() => toggleRegistrationConfigVisibility(item)} disabled={savingRegistrationVisibilityId === String(item.idcampeonato)} className={`inline-flex h-9 shrink-0 items-center justify-center border px-3 text-[9px] font-bold uppercase transition disabled:opacity-40 ${item.visible ? 'border-green-400/40 bg-green-500/10 text-green-300 hover:bg-green-500 hover:text-black' : 'border-gray-600 bg-black/20 text-gray-500 hover:border-gray-400 hover:text-gray-200'}`} aria-label={`${item.visible ? 'Ocultar' : 'Mostrar'} formulario en el inicio`}>{savingRegistrationVisibilityId === String(item.idcampeonato) ? '...' : item.visible ? 'Visible' : 'Oculto'}</button><button type="button" onClick={() => deleteRegistrationConfig(item.idcampeonato)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar formulario"><TrashIcon className="h-4 w-4"/></button></div>)}
              {!registrationConfigs.length ? <p className="border border-dashed border-racing-border p-4 text-center text-sm text-gray-500">Todavía no hay formularios guardados.</p> : null}
            </div>
          </section>

          <section className="card-glass p-6">
            {!championship ? <div className="py-20 text-center text-gray-500"><ClipboardDocumentListIcon className="mx-auto h-12 w-12"/><p className="mt-3">Seleccioná un campeonato para configurar su formulario.</p></div> : <form onSubmit={saveRegistrationConfig} className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-racing-red">{editingRegistrationConfig ? 'Modificar formulario' : 'Nuevo formulario'}</p><h2 className="mt-1 font-racing text-3xl font-bold">{championship.categoria}</h2><p className="text-gray-400">Temporada {championship.temporada} · {championship.anio}</p></div><label className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-xs font-bold uppercase transition ${registrationConfig.visible ? 'border-green-400/40 bg-green-500/10 text-green-300' : 'border-racing-border bg-black/20 text-gray-500'}`}><input name="visible" type="checkbox" checked={registrationConfig.visible} onChange={handleRegistrationConfigChange} className="h-4 w-4 accent-green-500"/>Mostrar en el inicio</label></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label><span className="text-sm text-gray-300">Apertura automática</span><input name="fecha_apertura" type="datetime-local" value={registrationConfig.fecha_apertura} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Cierre automático</span><input name="fecha_cierre" type="datetime-local" value={registrationConfig.fecha_cierre} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Precio base</span><input name="precio" type="number" min="0" step="0.01" value={registrationConfig.precio} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/><small className="mt-1 block text-gray-500">A este importe se suma el valor de cada plan.</small></label>
                <label><span className="text-sm text-gray-300">Límite total</span><input name="limite_inscriptos" type="number" min="1" max="65535" value={registrationConfig.limite_inscriptos} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Inscriptos manuales</span><input name="preinscriptos" type="number" min="0" max={registrationConfig.limite_inscriptos || 0} value={registrationConfig.preinscriptos} onChange={handleRegistrationConfigChange} className="input-field mt-2" required/><small className="mt-1 block text-gray-500">Sirve para ajustar el contador público. Antes de abrir se muestra como preinscriptos y, al abrir, se suma visualmente a los reales sin ocupar cupos.</small></label>
                <div className={`border p-4 md:col-span-2 ${modelLimitDifference === 0 ? 'border-green-400/30 bg-green-500/[0.05]' : 'border-yellow-400/40 bg-yellow-400/[0.06]'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-sm text-gray-400">Cupos distribuidos por modelo</span><p className="mt-1 font-racing text-2xl font-bold text-white">{assignedModelLimit} / {registrationConfig.limite_inscriptos || 0}</p></div><button type="button" onClick={distributeRegistrationCarLimits} disabled={!registrationConfig.autos_habilitados.length} className="border border-racing-border px-4 py-2 text-xs font-bold uppercase text-gray-300 transition hover:border-green-400 hover:text-green-300 disabled:opacity-40">Distribuir equitativamente</button></div><p className={`mt-2 text-xs ${modelLimitDifference === 0 ? 'text-green-300' : 'text-yellow-300'}`}>{modelLimitDifference === 0 ? 'La distribución coincide con el límite total.' : modelLimitDifference > 0 ? `Falta asignar ${modelLimitDifference} cupo${modelLimitDifference === 1 ? '' : 's'}.` : `Hay ${Math.abs(modelLimitDifference)} cupo${Math.abs(modelLimitDifference) === 1 ? '' : 's'} de más.`} Las pinturas oficiales no consumen estos cupos.</p></div>
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
              <section className="overflow-hidden border border-green-400/30 bg-green-500/[0.03]">
                <button type="button" onClick={() => setRegistrationFormCollapsed(current => ({ ...current, freeDrivers: !current.freeDrivers }))} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-green-400/[0.05] sm:p-5" aria-expanded={!registrationFormCollapsed.freeDrivers}>
                  <span><span className="block font-racing text-xl font-bold text-white">Pilotos con inscripción gratuita</span><span className="mt-1 block text-xs text-gray-500">La bonificación elimina solamente el precio base. Los diseños y adicionales se cobran normalmente.</span></span>
                  <span className="flex shrink-0 items-center gap-3"><span className="border border-green-400/35 bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-300">{selectedFreeDrivers.length}</span><ChevronDownIcon className={`h-5 w-5 text-green-300 transition-transform duration-500 ${registrationFormCollapsed.freeDrivers ? '-rotate-90' : ''}`}/></span>
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${registrationFormCollapsed.freeDrivers ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden"><div className="border-t border-green-400/20 p-4 sm:p-5">
                  <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Buscar piloto</span><span className="relative mt-2 block"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600"/><input value={freeDriverSearch} onChange={event => setFreeDriverSearch(event.target.value)} className="input-field pl-10" placeholder="Nombre o localidad"/></span></label>
                  {selectedFreeDrivers.length ? <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-green-300">Bonificados</p><div className="mt-2 flex flex-wrap gap-2">{selectedFreeDrivers.map(driver => <button key={driver.id} type="button" onClick={() => toggleFreeRegistrationDriver(driver.id)} className="group inline-flex items-center gap-2 border border-green-400/35 bg-green-500/10 px-3 py-2 text-left text-xs font-semibold text-green-200 transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-200"><span>{driver.nombre}</span><XMarkIcon className="h-4 w-4"/></button>)}</div></div> : <p className="mt-4 border border-dashed border-racing-border py-4 text-center text-xs text-gray-600">Todavía no seleccionaste pilotos.</p>}
                  <div className="mt-4 max-h-72 divide-y divide-racing-border overflow-y-auto border border-racing-border bg-black/20">{freeDriverCandidates.map(driver => <button key={driver.id} type="button" onClick={() => toggleFreeRegistrationDriver(driver.id)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-green-500/10"><span className="min-w-0"><strong className="block truncate text-sm text-white">{driver.nombre}</strong><span className="block truncate text-xs text-gray-500">{[driver.localidad, driver.provincia].filter(Boolean).join(', ') || 'Sin localidad'}</span></span><span className="shrink-0 text-[10px] font-bold uppercase text-green-300">Agregar gratis</span></button>)}{!freeDriverCandidates.length ? <p className="p-5 text-center text-xs text-gray-600">No hay pilotos para mostrar.</p> : null}</div>
                  {freeDriversMessage ? <p className="mt-4 text-sm text-green-200">{freeDriversMessage}</p> : null}
                </div></div></div>
              </section>
              <section className="overflow-hidden border border-racing-border bg-black/20">
                <button type="button" onClick={() => setRegistrationFormCollapsed(current => ({ ...current, enabledCars: !current.enabledCars }))} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.04] sm:p-5" aria-expanded={!registrationFormCollapsed.enabledCars}>
                  <span><span className="block font-racing text-xl font-bold text-white">Autos habilitados</span><span className="mt-1 block text-xs text-gray-500">Seleccioná cada marca y modelo, y definí manualmente su límite.</span></span>
                  <span className="flex shrink-0 items-center gap-3"><span className="text-xs font-bold uppercase text-gray-500">{registrationConfig.autos_habilitados.length}/{categoryCars.length}</span><ChevronDownIcon className={`h-5 w-5 text-racing-red transition-transform duration-500 ${registrationFormCollapsed.enabledCars ? '-rotate-90' : ''}`}/></span>
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${registrationFormCollapsed.enabledCars ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden"><div className="grid gap-2 border-t border-racing-border p-4 md:grid-cols-3 sm:p-5">{categoryCars.map(car => {
                  const enabled = registrationConfig.autos_habilitados.includes(Number(car.id));
                  return <div key={car.id} className={`border p-3 ${enabled ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={enabled} onChange={() => toggleRegistrationCar(car.id)} className="h-4 w-4 accent-racing-red"/><span className="min-w-0 flex-1 truncate">{car.marca} {car.modelo}</span></label>{enabled ? <label className="mt-3 flex items-center justify-between gap-3 border-t border-racing-border/70 pt-3"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Límite</span><input type="number" min="1" max="65535" step="1" value={registrationConfig.limites_por_modelo?.[car.id] ?? ''} onChange={event => updateRegistrationCarLimit(car.id, event.target.value)} className="h-10 w-24 border border-racing-border bg-black/40 px-3 text-center font-racing text-xl font-bold text-white outline-none focus:border-racing-red" required/></label> : null}</div>;
                })}{!categoryCars.length ? <p className="text-sm text-yellow-300 md:col-span-3">La categoría no tiene autos cargados.</p> : null}</div></div></div>
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

    if (activeSection === 'importador') {
      return <CadpoImporter />;
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

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[minmax(250px,330px)_minmax(190px,250px)_auto] xl:items-end">
                <label>
                  <span className="text-xs font-semibold uppercase text-gray-400">Campeonato</span>
                  <select
                    value={resultChampionshipId}
                    onChange={event => {
                      setResultChampionshipId(event.target.value);
                      setResultRoundId('');
                      setResultSheetSize(35);
                      setResultGridSelection(null);
                      setStandingsImageMessage('');
                      setChampionshipChampionMessage('');
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
                <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
                  {resultRound ? (
                    <div className="flex shrink-0 items-end gap-1.5">
                      <label className="w-20">
                        <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-cyan-300">Presentismo</span>
                        <span className="sr-only">Puntos de presentismo para todos los pilotos de la fecha</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={resultAttendancePoints}
                          onChange={event => setResultAttendancePoints(event.target.value)}
                          placeholder="PTS"
                          className="mt-2 h-[46px] w-full border border-racing-border bg-black/25 px-2 text-center font-racing text-sm font-bold text-cyan-300 outline-none focus:border-cyan-400"
                          disabled={savingResults}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleApplyAttendanceToRound}
                        disabled={savingResults || !resultRoundResults.length}
                        className="h-[46px] shrink-0 border border-cyan-400/50 px-3 text-[9px] font-bold uppercase text-cyan-300 transition hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Aplicar
                      </button>
                    </div>
                  ) : null}
                  {resultChampionshipId ? (
                    <button
                      type="button"
                      onClick={() => setShowChampionshipScoring(true)}
                      className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 border border-cyan-400/50 bg-cyan-400/[0.06] px-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400 hover:text-black"
                    >
                      <TrophyIcon className="h-4 w-4" /> Puntajes
                    </button>
                  ) : null}
                  {resultChampionshipId ? (
                    <button
                      type="button"
                      onClick={() => setShowChampionshipWarnings(true)}
                      className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 border border-amber-400/50 bg-amber-400/[0.06] px-3 text-[9px] font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400 hover:text-black"
                    >
                      <BellAlertIcon className="h-4 w-4" /> Apercibimientos
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSaveResults}
                    disabled={!Object.keys(dirtyResults).length || savingResults}
                    className="btn-primary h-[46px] min-w-28 flex-1 shrink-0 justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingResults ? 'Guardando...' : `Guardar${Object.keys(dirtyResults).length ? ` (${Object.keys(dirtyResults).length})` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {resultRound ? (
            <div className="border-b border-racing-border bg-black/20 px-4 py-3 lg:px-6">
              <section className="mb-4 border border-racing-border bg-racing-dark/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <PhotoIcon className="mt-0.5 h-6 w-6 shrink-0 text-racing-red"/>
                    <div>
                      <h3 className="font-racing text-lg font-bold uppercase text-white">Banners del resultado · Fecha {resultRound.ronda}</h3>
                      <p className="mt-1 text-xs text-gray-500">Cargá las imágenes del ganador, el podio o el campeón. En la vista pública aparecerán una debajo de la otra.</p>
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(260px,1fr)_auto] sm:items-end lg:w-[560px]">
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Seleccionar imágenes</span>
                      <input ref={eventBannerInputRef} type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => setEventBannerFiles(Array.from(event.target.files || []).slice(0, 10))} className="input-field mt-1 file:mr-3 file:border-0 file:bg-racing-red file:px-3 file:py-2 file:font-semibold file:text-white"/>
                    </label>
                    <button type="button" onClick={uploadEventBanners} disabled={!eventBannerFiles.length || savingEventBanners} className="btn-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-40"><ArrowUpTrayIcon className="h-5 w-5"/>{savingEventBanners ? 'Subiendo...' : `Subir ${eventBannerFiles.length || ''}`}</button>
                  </div>
                </div>
                {eventBanners.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{eventBanners.map(banner => <article key={banner.filename} className="group relative aspect-video overflow-hidden border border-racing-border bg-black"><img src={banner.url} alt="Banner del resultado" className="h-full w-full object-cover"/><button type="button" onClick={() => removeEventBanner(banner)} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center border border-red-400/60 bg-black/80 text-red-300 opacity-100 transition hover:bg-red-600 hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label="Eliminar banner"><TrashIcon className="h-4 w-4"/></button></article>)}</div> : <p className="mt-4 border border-dashed border-racing-border px-4 py-4 text-center text-xs text-gray-600">Esta fecha todavía no tiene banners de resultados.</p>}
              </section>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="sm:w-64">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Importar JSON de Assetto Corsa</span>
                    <select value={resultImportSession} onChange={event => setResultImportSession(event.target.value)} className="input-field mt-1 h-10 py-0">
                      {assettoSessionOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                  </label>
                  <input ref={resultJsonInputRef} type="file" accept=".json,application/json" onChange={handleResultJsonImport} className="hidden" />
                  <button type="button" onClick={() => resultJsonInputRef.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 border border-sky-400/60 bg-sky-400/10 px-4 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-400 hover:text-black">
                    <ArrowUpTrayIcon className="h-4 w-4" /> Cargar archivo
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Multiplicadores de la Fecha {resultRound.ronda}</p>
                  <div className="mt-1 flex flex-wrap items-end gap-2">
                    <label className="w-24"><span className="text-[8px] font-bold uppercase text-gray-500">Sprint</span><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-300">×</span><input type="number" min="0" max="10" step="0.1" value={resultSprintMultiplier} onChange={event => { setResultSprintMultiplier(event.target.value); setResultMultiplierMessage(''); }} className="input-field h-10 py-0 pl-6 text-center font-racing text-sm"/></div></label>
                    <label className="w-24"><span className="text-[8px] font-bold uppercase text-gray-500">Final</span><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-300">×</span><input type="number" min="0" max="10" step="0.1" value={resultFinalMultiplier} onChange={event => { setResultFinalMultiplier(event.target.value); setResultMultiplierMessage(''); }} className="input-field h-10 py-0 pl-6 text-center font-racing text-sm"/></div></label>
                    <button type="button" onClick={saveResultRoundMultipliers} disabled={savingResultMultipliers} className="h-10 border border-violet-400/50 bg-violet-400/[0.07] px-3 text-[9px] font-bold uppercase tracking-wider text-violet-300 transition hover:bg-violet-400 hover:text-black disabled:opacity-40">{savingResultMultipliers ? 'Aplicando...' : 'Aplicar'}</button>
                  </div>
                  {resultMultiplierMessage ? <p className="mt-1 text-[9px] font-semibold text-red-300">{resultMultiplierMessage}</p> : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {assettoSessionOptions.map(option => {
                    const imported = resultImportedSessions[option.key] || buildResultSessionWorkspace(option.key);
                    const sanctioned = Object.values(imported?.sanctions || {}).filter(sanction => getAssettoSanctionItems(sanction).length > 0).length;
                    const unmatched = (imported?.orderedRows || []).filter(entry => !findRegisteredResultDriver(entry.driverName)).length;
                    return (
                      <div key={option.key} className="flex items-center justify-between gap-3 border border-racing-border bg-racing-dark px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold uppercase text-white">{option.label}</p>
                          <p className="truncate text-[10px] text-gray-500" title={imported?.fileName}>{imported ? `${imported.fileName} · ${imported.orderedRows.length} pilotos` : 'Sin pilotos cargados'}</p>
                          {unmatched ? <p className="text-[9px] font-bold uppercase text-amber-400">{unmatched} sin vincular</p> : null}
                        </div>
                        <button type="button" onClick={() => openAssettoSanctions(option.key, '', imported)} disabled={!imported?.orderedRows.length} className={`inline-flex h-8 shrink-0 items-center gap-1.5 border px-2 text-[9px] font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-35 ${sanctioned ? 'border-red-400/70 bg-red-500/15 text-red-300' : 'border-racing-border text-gray-400 hover:border-red-400 hover:text-red-300'}`}>
                          <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Sanciones{sanctioned ? ` (${sanctioned})` : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
            </div>
          ) : null}

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
                    return (
                      <tr key={row.unpositioned ? `unpositioned-${resultKey}` : `position-${row.position}`} className={rowIndex % 2 ? 'bg-black/10' : 'bg-racing-gray'}>
                        <td className={`sticky left-0 z-10 h-10 border border-racing-border p-0 text-center font-racing text-base ${row.unpositioned ? 'bg-gray-900 text-gray-500' : row.position <= 3 ? 'bg-racing-dark text-racing-red' : 'bg-racing-dark text-gray-300'}`}>
                          {row.unpositioned ? '—' : row.position}
                        </td>
                        <td className="sticky left-16 z-10 h-10 w-64 max-w-64 border border-racing-border bg-racing-gray p-0 font-semibold text-white">
                          <div className="relative">
                          <ResultSpreadsheetCell
                            value={result?.piloto || ''}
                            type="pilot"
                            disabled={row.unpositioned && !result}
                            label={`Piloto, fila ${row.position || 'sin posición'}`}
                            rowIndex={rowIndex}
                            columnIndex={0}
                            selected={isResultCellSelected(rowIndex, 0)}
                            error={result ? resultCellErrors[`${resultKey}:piloto`] : ''}
                            modified={Boolean(result && dirtyResultCells[`${resultKey}:piloto`])}
                            onCommit={nextValue => handleResultPilotChange(row, result, nextValue)}
                            onSelect={handleResultCellSelect}
                            onExtendSelection={handleResultCellSelectionExtend}
                            onPaste={handleResultGridPaste}
                            onClearSelection={handleResultGridClear}
                            withAction={Boolean(result?.piloto)}
                          />
                          {result?.piloto ? (
                            <button
                              type="button"
                              onMouseDown={event => event.stopPropagation()}
                              onClick={() => openResultAchievementModal(result)}
                              className={`absolute right-1 top-1 z-20 inline-flex h-8 w-8 items-center justify-center border transition-colors ${resultAchievementFields.some(field => Boolean(Number(result[field.key])))
                                ? 'border-amber-300/70 bg-amber-400/20 text-amber-300'
                                : 'border-racing-border bg-racing-dark text-gray-500 hover:border-amber-300 hover:text-amber-300'
                                }`}
                              title="Marcar poles y victorias"
                              aria-label={`Marcas oficiales de ${result.piloto}`}
                            >
                              <TrophyIcon className="h-4 w-4" />
                            </button>
                          ) : null}
                          </div>
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
                                  modified={Boolean(result && dirtyResultCells[`${resultKey}:${column.key}`])}
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
                                modified={Boolean(result && dirtyResultCells[`${resultKey}:${column.key}`])}
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

          {resultChampionshipId ? (
            <>
            <div className="mt-14 border-y-4 border-black bg-racing-gray shadow-2xl">
              <div className="flex flex-col gap-1 border-b border-racing-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-400">Actualización al guardar</p>
                  <h3 className="mt-1 font-racing text-xl font-bold text-white">Tabla completa del campeonato</h3>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-xs text-gray-500">Incluye presentismo, clasificaciones, sprint y final de todas las fechas.</p>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {championshipChampionMessage ? <span className="text-[10px] font-semibold text-yellow-300">{championshipChampionMessage}</span> : null}
                    {standingsImageMessage ? <span className="text-[10px] font-semibold text-cyan-300">{standingsImageMessage}</span> : null}
                    <button type="button" onClick={generateChampionshipStandingsImage} disabled={generatingStandingsImage || !resultChampionshipStandings.length} className="inline-flex h-9 items-center justify-center gap-2 border border-cyan-400/50 bg-cyan-400/[0.07] px-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35">
                      <PhotoIcon className="h-4 w-4" /> {generatingStandingsImage ? 'Generando...' : 'Generar imágenes PNG'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/45">
                      <th rowSpan={2} className="w-14 whitespace-nowrap border border-racing-border px-2 py-2.5 text-center uppercase text-gray-400">Pos.</th>
                      <th rowSpan={2} className="min-w-64 border border-racing-border px-3 py-2.5 text-left uppercase text-gray-400">Piloto / Auto</th>
                      <th rowSpan={2} className="min-w-48 border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2.5 text-center uppercase text-amber-300">AP / Sanciones</th>
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
                    {resultChampionshipStandings.map((standing, index) => {
                      const warningDriver = championshipWarningDrivers.find(driver => String(driver.idpiloto) === String(standing.idpiloto));
                      const warningTotal = Number(warningDriver?.apercibimientos || 0);
                      const reachedSanctions = [...(warningDriver?.sanciones_alcanzadas || [])]
                        .sort((a, b) => Number(a.cantidad) - Number(b.cantidad));
                      return <tr key={standing.idpiloto} className={index % 2 ? 'bg-black/10' : 'bg-transparent'}>
                        <td className={`whitespace-nowrap border border-racing-border px-2 py-2 text-center font-racing text-lg font-bold ${standing.position === 1 ? 'bg-yellow-400/10 text-yellow-300' : standing.position === 2 ? 'bg-slate-300/10 text-slate-200' : standing.position === 3 ? 'bg-orange-700/10 text-orange-400' : 'text-gray-400'}`}>{standing.position}</td>
                        <td className="border border-racing-border px-3 py-2 text-white">
                          <div className="flex min-w-60 items-center gap-3">
                            {standing.autoLogo ? <img src={standing.autoLogo} alt={`Logo ${standing.marca || ''}`} className="h-9 w-12 shrink-0 object-contain" /> : <div className="h-9 w-12 shrink-0" />}
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-semibold" title={standing.piloto}><span className="truncate">{standing.piloto}</span></p>
                              <p className="truncate text-[11px] font-normal text-gray-500">{[standing.marca, standing.modelo].filter(Boolean).join(' ') || 'Auto sin informar'}</p>
                              <label className={`mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide ${standing.campeon ? 'text-yellow-300' : 'text-gray-600 hover:text-yellow-200'}`}><input type="checkbox" checked={Boolean(standing.campeon)} disabled={savingChampionshipChampion} onChange={event => setChampionshipChampion(standing, event.target.checked)} className="h-3.5 w-3.5 accent-yellow-400 disabled:opacity-40"/><span>Campeón</span></label>
                            </div>
                          </div>
                        </td>
                        <td className="border border-amber-400/25 bg-amber-400/[0.035] px-2 py-2 align-top">
                          <div className="flex min-w-44 flex-col items-center gap-1.5">
                            <span className={`inline-flex min-w-14 items-center justify-center px-2.5 py-1 font-racing text-sm font-bold ${warningTotal > 0 ? 'bg-amber-400 text-black' : 'border border-racing-border bg-black/20 text-gray-600'}`}>
                              {loadingChampionshipWarnings ? '…' : `${warningTotal} AP`}
                            </span>
                            {!loadingChampionshipWarnings && reachedSanctions.map(sanction => {
                              const statusKey = `${standing.idpiloto}:${sanction.cantidad}`;
                              return (
                                <label
                                  key={sanction.cantidad}
                                  title={sanction.sancion}
                                  className={`flex w-full cursor-pointer items-center gap-2 border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide transition ${sanction.cumplida ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300' : 'border-red-500/35 bg-red-500/[0.08] text-red-300'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sanction.cumplida)}
                                    disabled={updatingWarningFulfillment === statusKey}
                                    onChange={event => toggleWarningFulfillment(standing.idpiloto, sanction.cantidad, event.target.checked)}
                                    className="h-3.5 w-3.5 shrink-0 accent-emerald-500 disabled:opacity-40"
                                  />
                                  <span className="min-w-0 truncate">{sanction.cantidad} AP · {sanction.cumplida ? 'Cumplida' : 'Pendiente'}</span>
                                </label>
                              );
                            })}
                            {!loadingChampionshipWarnings && warningTotal > 0 && !reachedSanctions.length ? <span className="text-center text-[9px] text-gray-600">Sin nivel de sanción alcanzado</span> : null}
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
                      </tr>;
                    })}
                    {!resultChampionshipStandings.length ? <tr><td colSpan={(resultRounds.length * 5) + 4} className="border border-racing-border px-6 py-10 text-center text-gray-500">No hay pilotos para calcular la tabla.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-10 border-y-4 border-black bg-racing-gray shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-racing-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-orange-300">Control por campeonato</p>
                  <h3 className="mt-1 font-racing text-xl font-bold text-white">Tabla de lastres</h3>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="max-w-2xl text-xs text-gray-500">Suma el lastre debut, Sprint, Final y sus sanciones. La última fecha queda excluida y los valores negativos descuentan kilos del total.</p>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                      Ordenar por
                      <select value={resultBallastSort} onChange={event => setResultBallastSort(event.target.value)} className="h-9 border border-racing-border bg-black/30 px-3 text-[10px] font-bold uppercase text-gray-200 outline-none focus:border-orange-400">
                        <option value="name">Piloto A-Z</option>
                        <option value="total_desc">Mayor lastre</option>
                        <option value="total_asc">Menor lastre</option>
                      </select>
                    </label>
                    {resultDebutBallastMessage ? <span className="text-[10px] font-bold text-violet-300">{resultDebutBallastMessage}</span> : null}
                    <button type="button" onClick={saveResultDebutBallasts} disabled={savingResultDebutBallasts} className="border border-violet-400/50 bg-violet-400/10 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-violet-300 transition hover:bg-violet-400 hover:text-black disabled:opacity-40">{savingResultDebutBallasts ? 'Guardando...' : 'Guardar lastres debut'}</button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full table-auto border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/45">
                      <th rowSpan={2} className="min-w-64 border border-racing-border px-3 py-2.5 text-left uppercase text-gray-400">Piloto / Auto</th>
                      <th rowSpan={2} className="whitespace-nowrap border border-orange-400/30 bg-orange-400/10 px-4 py-2.5 text-center font-racing text-sm uppercase text-orange-200">Total de lastre</th>
                      <th rowSpan={2} className="w-24 min-w-24 whitespace-nowrap border border-racing-border bg-black/15 px-2 py-2.5 text-center text-[9px] font-normal uppercase text-gray-600">Lastre debut</th>
                      {resultBallastRounds.map(round => (
                        <th key={round.id} colSpan={4} className="whitespace-nowrap border border-racing-border px-3 py-3 text-center font-racing text-sm uppercase text-gray-300" title={`Fecha ${round.ronda}: ${round.circuito}${round.variante ? ` · ${round.variante}` : ''}`}>
                          Fecha {round.ronda} · {round.circuito}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-black/30 text-[10px] uppercase text-gray-500">
                      {resultBallastRounds.flatMap(round => [
                        <th key={`${round.id}-ballast-sprint`} className="min-w-14 border border-racing-border px-2 py-2" title="Lastre por Sprint">S</th>,
                        <th key={`${round.id}-ballast-sprint-sanction`} className="min-w-14 border border-red-500/30 bg-red-500/[0.06] px-2 py-2 text-red-400" title="Lastre por sanción en Sprint">Sanc. S</th>,
                        <th key={`${round.id}-ballast-final`} className="min-w-14 border border-racing-border px-2 py-2" title="Lastre por Final">F</th>,
                        <th key={`${round.id}-ballast-final-sanction`} className="min-w-14 border border-red-500/30 bg-red-500/[0.06] px-2 py-2 text-red-400" title="Lastre por sanción en Final">Sanc. F</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {resultBallastStandings.map((standing, index) => (
                      <tr key={standing.idpiloto} className={index % 2 ? 'bg-black/10' : 'bg-transparent'}>
                        <td className="border border-racing-border px-3 py-2 text-white">
                          <div className="flex min-w-60 items-center gap-3">
                            {standing.autoLogo ? <img src={standing.autoLogo} alt={`Logo ${standing.marca || ''}`} className="h-8 w-11 shrink-0 object-contain" /> : <div className="h-8 w-11 shrink-0" />}
                            <div className="min-w-0"><p className="truncate font-semibold">{standing.piloto}</p><p className="truncate text-[11px] text-gray-500">{[standing.marca, standing.modelo].filter(Boolean).join(' ') || 'Auto sin informar'}</p></div>
                          </div>
                        </td>
                        <td className={`whitespace-nowrap border border-orange-400/30 bg-orange-400/[0.09] px-4 py-2 text-center font-racing text-xl font-bold ${getResultBallastClass(standing.ballastTotal)}`}>{formatResultBallast(standing.ballastTotal)}</td>
                        <td className="w-24 min-w-24 border border-racing-border bg-black/[0.08] p-1 text-center"><input type="number" min="0" step="5" value={resultDebutBallasts[String(standing.idpiloto)] ?? ''} onChange={event => setResultDebutBallasts(current => ({ ...current, [String(standing.idpiloto)]: event.target.value }))} className="h-8 w-20 border border-racing-border bg-black/20 px-1 text-center font-racing text-sm text-gray-500 outline-none transition focus:border-violet-400 focus:text-violet-300" placeholder="—" aria-label={`Lastre debut de ${standing.piloto}`}/></td>
                        {resultBallastRounds.flatMap(round => {
                          const detail = standing.ballastRounds.get(String(round.ronda));
                          return [
                            <td key={`${round.id}-${standing.idpiloto}-s`} className={`border border-racing-border px-2 py-2 text-center font-racing text-sm ${getResultBallastClass(detail?.sprint)}`}>{formatResultBallast(detail?.sprint)}</td>,
                            <td key={`${round.id}-${standing.idpiloto}-ss`} className={`border px-2 py-2 text-center font-racing text-sm ${parseResultPoints(detail?.sprintSanction) !== 0 ? 'border-red-500/25 bg-red-500/[0.05] text-red-400' : 'border-racing-border text-gray-600'}`}>{formatResultBallast(detail?.sprintSanction)}</td>,
                            <td key={`${round.id}-${standing.idpiloto}-f`} className={`border border-racing-border px-2 py-2 text-center font-racing text-sm ${getResultBallastClass(detail?.final)}`}>{formatResultBallast(detail?.final)}</td>,
                            <td key={`${round.id}-${standing.idpiloto}-fs`} className={`border px-2 py-2 text-center font-racing text-sm ${parseResultPoints(detail?.finalSanction) !== 0 ? 'border-red-500/25 bg-red-500/[0.05] text-red-400' : 'border-racing-border text-gray-600'}`}>{formatResultBallast(detail?.finalSanction)}</td>,
                          ];
                        })}
                      </tr>
                    ))}
                    {!resultBallastStandings.length ? <tr><td colSpan={(resultBallastRounds.length * 4) + 3} className="border border-racing-border px-6 py-10 text-center text-gray-500">No hay pilotos para calcular los lastres.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          ) : null}

          {showChampionshipScoring && resultChampionshipId ? (
            <div className="fixed inset-0 z-[116] flex items-start justify-center overflow-hidden bg-black/90 px-3 py-3 sm:px-4 sm:py-6" onMouseDown={event => { if (event.target === event.currentTarget) setShowChampionshipScoring(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="championship-scoring-title" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden border border-cyan-400/40 bg-racing-dark shadow-2xl shadow-black/70 sm:max-h-[calc(100vh-3rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-racing-border px-4 py-4 sm:px-5">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Configuración por campeonato</p><h3 id="championship-scoring-title" className="mt-1 font-racing text-2xl font-bold text-white">Escala de posiciones y puntajes</h3><p className="mt-1 text-xs leading-relaxed text-gray-500">{resultChampionship?.categoria} · Temporada {resultChampionship?.temporada}. Solo las posiciones enteras reciben puntaje automático.</p></div>
                  <button type="button" onClick={() => setShowChampionshipScoring(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition hover:border-cyan-300 hover:text-white" aria-label="Cerrar configuración de puntajes"><XMarkIcon className="h-5 w-5"/></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-racing text-xl font-bold text-white">Puntaje automático</h4><p className="mt-1 text-xs text-gray-500">Al importar o modificar una posición, la planilla completa el valor configurado. Después podés editarlo manualmente.</p></div><button type="button" onClick={addChampionshipScoringRow} className="border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-[10px] font-bold uppercase text-cyan-300 transition hover:bg-cyan-400 hover:text-black">Agregar posición</button></div>
                  {loadingChampionshipScoring ? <p className="py-14 text-center text-sm text-gray-500">Cargando escala...</p> : <div className="mt-3 max-h-[58vh] overflow-auto border border-racing-border"><table className="w-full min-w-[620px] border-collapse text-xs"><thead className="sticky top-0 z-10"><tr className="bg-racing-gray text-[9px] uppercase tracking-wider text-gray-500"><th className="w-24 border border-racing-border px-2 py-2 text-center">Posición</th>{resultScoringFields.map(field => <th key={field.pointsField} className="border border-racing-border px-2 py-2 text-center" title={field.label}>{field.shortLabel}</th>)}<th className="w-10 border border-racing-border"/></tr></thead><tbody>{championshipScoringRows.map((row, index) => <tr key={index} className={index % 2 ? 'bg-black/10' : 'bg-transparent'}><td className="h-8 border border-racing-border p-0"><input type="number" min="1" max="999" step="1" value={row.posicion} data-scoring-cell={`${index}:posicion`} onKeyDown={event => handleChampionshipScoringKeyDown(event, index, 'posicion')} onChange={event => updateChampionshipScoringRow(index, 'posicion', event.target.value)} className="h-8 w-full border-0 bg-transparent px-2 text-center font-racing text-base font-bold text-white outline-none focus:bg-cyan-400/10 focus:ring-1 focus:ring-inset focus:ring-cyan-400"/></td>{resultScoringFields.map(field => <td key={field.pointsField} className="h-8 border border-racing-border p-0"><input type="number" min="0" step={field.integer ? '1' : '0.01'} value={row[field.pointsField]} data-scoring-cell={`${index}:${field.pointsField}`} onKeyDown={event => handleChampionshipScoringKeyDown(event, index, field.pointsField)} onChange={event => updateChampionshipScoringRow(index, field.pointsField, event.target.value)} className="h-8 w-full border-0 bg-transparent px-2 text-center font-racing text-base text-cyan-300 outline-none focus:bg-cyan-400/10 focus:ring-1 focus:ring-inset focus:ring-cyan-400" placeholder="" aria-label={`${field.label}, posición ${row.posicion}`}/></td>)}<td className="h-8 border border-racing-border p-0 text-center"><button type="button" onClick={() => removeChampionshipScoringRow(index)} className="inline-flex h-7 w-7 items-center justify-center text-gray-600 transition hover:bg-red-600 hover:text-white" aria-label={`Eliminar posición ${row.posicion}`}><TrashIcon className="h-3.5 w-3.5"/></button></td></tr>)}{!championshipScoringRows.length ? <tr><td colSpan={resultScoringFields.length + 2} className="border border-dashed border-racing-border px-5 py-10 text-center text-sm text-gray-500">Todavía no configuraste posiciones. Agregá la primera para comenzar.</td></tr> : null}</tbody></table></div>}
                  <div className="mt-5 flex flex-col-reverse gap-3 border-t border-racing-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm ${championshipScoringMessage.toLocaleLowerCase('es-AR').includes('correctamente') ? 'text-emerald-300' : 'text-amber-300'}`}>{championshipScoringMessage}</p><button type="button" onClick={saveChampionshipScoring} disabled={savingChampionshipScoring || loadingChampionshipScoring} className="bg-cyan-400 px-6 py-3 text-xs font-bold uppercase text-black transition hover:bg-cyan-300 disabled:opacity-40">{savingChampionshipScoring ? 'Guardando...' : 'Guardar escala'}</button></div>
                </div>
              </section>
            </div>
          ) : null}

          {showChampionshipWarnings && resultChampionshipId ? (
            <div className="fixed inset-0 z-[115] flex items-start justify-center overflow-hidden bg-black/90 px-4 py-4 sm:py-6" onMouseDown={event => { if (event.target === event.currentTarget) setShowChampionshipWarnings(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="championship-warnings-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden border border-amber-400/40 bg-racing-dark shadow-2xl shadow-black/70 sm:max-h-[calc(100vh-3rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-racing-border px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">Configuración por campeonato</p>
                    <h3 id="championship-warnings-title" className="mt-1 font-racing text-2xl font-bold text-white">Escala de apercibimientos</h3>
                    <p className="mt-1 text-xs text-gray-500">{resultChampionship?.categoria} · Temporada {resultChampionship?.temporada}. Los AP de Sprint y Final se acumulan durante todo este campeonato.</p>
                  </div>
                  <button type="button" onClick={() => setShowChampionshipWarnings(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition hover:border-amber-300 hover:text-white" aria-label="Cerrar configuración de apercibimientos"><XMarkIcon className="h-5 w-5" /></button>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h4 className="font-racing text-xl font-bold text-white">Sanciones por acumulación</h4><p className="mt-1 text-xs text-gray-500">Definí la sanción que corresponde al alcanzar cada cantidad de AP.</p></div>
                      <button type="button" onClick={addChampionshipWarningLevel} className="border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-[10px] font-bold uppercase text-amber-300 transition hover:bg-amber-400 hover:text-black">Agregar nivel</button>
                    </div>

                    {loadingChampionshipWarnings ? <p className="py-12 text-center text-sm text-gray-500">Cargando configuración...</p> : (
                      <div className="mt-4 space-y-2">
                        {championshipWarningLevels.map((level, index) => (
                          <div key={index} className="grid gap-3 border border-racing-border bg-black/20 p-3 sm:grid-cols-[110px_1fr_42px] sm:items-end">
                            <label><span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Cantidad AP</span><input type="number" min="1" max="65535" step="1" value={level.cantidad} onChange={event => updateChampionshipWarningLevel(index, 'cantidad', event.target.value)} className="input-field mt-1 text-center font-racing text-xl font-bold text-amber-300" /></label>
                            <label><span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Sanción al alcanzar este nivel</span><input type="text" maxLength="500" value={level.sancion} onChange={event => updateChampionshipWarningLevel(index, 'sancion', event.target.value)} className="input-field mt-1" placeholder="Ej.: largar desde boxes en la próxima fecha" /></label>
                            <button type="button" onClick={() => removeChampionshipWarningLevel(index)} className="inline-flex h-[46px] items-center justify-center border border-racing-border text-gray-500 transition hover:border-red-400 hover:text-red-400" aria-label={`Eliminar nivel de ${level.cantidad || 0} apercibimientos`}><TrashIcon className="h-5 w-5" /></button>
                          </div>
                        ))}
                        {!championshipWarningLevels.length ? <p className="border border-dashed border-racing-border py-10 text-center text-sm text-gray-500">Este campeonato todavía no tiene una escala configurada.</p> : null}
                      </div>
                    )}
                    {championshipWarningsMessage ? <p className="mt-4 border border-amber-400/20 bg-amber-400/[0.05] p-3 text-sm text-amber-100">{championshipWarningsMessage}</p> : null}
                    <button type="button" onClick={saveChampionshipWarnings} disabled={loadingChampionshipWarnings || savingChampionshipWarnings} className="mt-4 w-full bg-amber-400 px-5 py-3 text-xs font-bold uppercase text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">{savingChampionshipWarnings ? 'Guardando...' : 'Guardar escala'}</button>
                  </div>

                  <aside className="min-w-0 border border-racing-border bg-black/20">
                    <div className="border-b border-racing-border px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">Acumulado actual</p><h4 className="mt-1 font-racing text-xl font-bold text-white">Pilotos con AP</h4></div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {championshipWarningDrivers.map(driver => {
                        const total = Number(driver.apercibimientos || 0);
                        const reachedSanctions = [...(driver.sanciones_alcanzadas || [])]
                          .sort((a, b) => Number(a.cantidad) - Number(b.cantidad));
                        const next = championshipWarningLevels
                          .filter(level => Number(level.cantidad) > total)
                          .sort((a, b) => Number(a.cantidad) - Number(b.cantidad))[0];
                        return (
                          <article key={driver.idpiloto} className="border-b border-racing-border/70 px-4 py-3 last:border-b-0">
                            <div className="flex items-center justify-between gap-3"><strong className="truncate text-sm text-white">{driver.nombre}</strong><span className="shrink-0 bg-amber-400 px-2.5 py-1 font-racing text-sm font-bold text-black">{total} AP</span></div>
                            {reachedSanctions.length ? <div className="mt-2 space-y-1.5">{reachedSanctions.map(sanction => {
                              const statusKey = `${driver.idpiloto}:${sanction.cantidad}`;
                              return <label key={sanction.cantidad} className={`flex cursor-pointer items-start gap-2 border px-2.5 py-2 text-xs ${sanction.cumplida ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300' : 'border-red-500/30 bg-red-500/[0.07] text-red-200'}`}><input type="checkbox" checked={Boolean(sanction.cumplida)} disabled={updatingWarningFulfillment === statusKey} onChange={event => toggleWarningFulfillment(driver.idpiloto, sanction.cantidad, event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500 disabled:opacity-40"/><span className="min-w-0"><strong className="block uppercase tracking-wider">{sanction.cantidad} AP · {sanction.cumplida ? 'Cumplida' : 'Pendiente'}</strong><span className="mt-0.5 block leading-relaxed">{sanction.sancion}</span></span></label>;
                            })}</div> : <p className="mt-2 text-xs text-gray-500">Todavía sin sanción configurada alcanzada.</p>}
                            {next ? <p className="mt-1 text-[10px] text-gray-600">Próximo nivel: {next.cantidad} AP · faltan {Number(next.cantidad) - total}</p> : null}
                          </article>
                        );
                      })}
                      {!championshipWarningDrivers.length ? <p className="px-5 py-12 text-center text-sm text-gray-500">Todavía no hay apercibimientos cargados en los resultados.</p> : null}
                    </div>
                  </aside>
                </div>
              </section>
            </div>
          ) : null}

          {assettoSanctionModal ? (() => {
            const imported = resultImportedSessions[assettoSanctionModal.sessionKey];
            const selectedEntry = imported?.orderedRows.find(entry => entry.key === assettoSanctionModal.entryKey);
            const sessionLabel = assettoSessionOptions.find(option => option.key === assettoSanctionModal.sessionKey)?.label || 'Tanda';
            if (!imported || !selectedEntry) return null;
            const appliedSanctions = getAssettoSanctionItems(imported.sanctions[assettoSanctionModal.entryKey]);
            const draftHasValue = assettoSanctionDraft.dq || assettoSanctionDraft.noSanction
              || Number(assettoSanctionDraft.time) > 0 || Number(assettoSanctionDraft.positions) > 0
              || Number(assettoSanctionDraft.warnings) > 0 || Number(assettoSanctionDraft.ballast) !== 0
              || String(assettoSanctionDraft.description || '').trim();
            const previewSanctions = {
              ...imported.sanctions,
              [assettoSanctionModal.entryKey]: { items: draftHasValue ? [...appliedSanctions, { ...emptyAssettoSanction(), ...assettoSanctionDraft }] : appliedSanctions },
            };
            const accumulatedSanction = aggregateAssettoSanctions(imported.sanctions[assettoSanctionModal.entryKey]);
            const accumulatedLabels = [
              accumulatedSanction.dq ? 'DQ' : '',
              accumulatedSanction.time > 0 ? `${formatResultPoints(accumulatedSanction.time)} SEG.` : '',
              accumulatedSanction.positions > 0 ? `${accumulatedSanction.positions} PUESTO${accumulatedSanction.positions === 1 ? '' : 'S'}` : '',
              accumulatedSanction.ballast !== 0 ? `${accumulatedSanction.ballast} KG` : '',
              accumulatedSanction.warnings > 0 ? `${accumulatedSanction.warnings} AP` : '',
            ].filter(Boolean);
            const draftWarningProjection = getAssettoWarningProjection(
              assettoSanctionModal.sessionKey,
              assettoSanctionModal.entryKey,
              assettoSanctionDraft.noSanction ? 0 : assettoSanctionDraft.warnings,
            );
            const editWarningProjection = assettoSanctionEdit
              ? getAssettoWarningProjection(
                  assettoSanctionModal.sessionKey,
                  assettoSanctionEdit.entryKey,
                  assettoSanctionEdit.noSanction ? 0 : assettoSanctionEdit.warnings,
                  assettoSanctionEdit.index,
                )
              : null;
            const previewRows = orderAssettoResults(imported.entries, previewSanctions, assettoSanctionModal.sessionKey);
            const previewSelectedEntry = previewRows.find(entry => entry.key === assettoSanctionModal.entryKey);
            const originalOrder = new Map(imported.orderedRows.map((entry, index) => [entry.key, index]));
            const repositionBaseSanctions = {
              ...previewSanctions,
              [assettoSanctionModal.entryKey]: {
                items: getAssettoSanctionItems(previewSanctions[assettoSanctionModal.entryKey]).map(sanction => ({
                  ...sanction,
                  positions: 0,
                  dq: false,
                })),
              },
            };
            const repositionBaseRows = orderAssettoResults(imported.entries, repositionBaseSanctions, assettoSanctionModal.sessionKey);
            const repositionPilotIndex = repositionBaseRows.findIndex(entry => entry.key === assettoSanctionModal.entryKey);
            const repositionTargets = repositionPilotIndex >= 0 ? repositionBaseRows.slice(repositionPilotIndex + 1) : [];
            const applyRepositionTarget = targetKey => {
              const targetIndex = repositionBaseRows.findIndex(entry => entry.key === targetKey);
              if (repositionPilotIndex < 0 || targetIndex <= repositionPilotIndex) return;
              setAssettoSanctionDraft(current => ({
                ...current,
                positions: targetIndex - repositionPilotIndex,
                dq: false,
                noSanction: false,
              }));
            };
            return (
              <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/90 px-4 py-6">
                <section role="dialog" aria-modal="true" aria-labelledby="assetto-sanction-title" className="w-full max-w-[1400px] border border-red-500/40 bg-racing-dark shadow-2xl shadow-black/70">
                  <div className="flex items-start justify-between gap-4 border-b border-racing-border px-5 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Sanciones · {sessionLabel}</p>
                      <h3 id="assetto-sanction-title" className="mt-1 font-racing text-2xl font-bold text-white">Recalcular resultado de la tanda</h3>
                      <p className="mt-1 text-xs text-gray-500">Los recargos modifican inmediatamente el orden cargado de la tanda.</p>
                    </div>
                    <button type="button" onClick={() => setAssettoSanctionModal(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition hover:border-red-400 hover:text-white" aria-label="Cerrar sanciones importadas"><XMarkIcon className="h-5 w-5" /></button>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-[minmax(200px,0.65fr)_minmax(400px,1.5fr)_minmax(360px,1.15fr)]">
                    <div>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Piloto</span>
                        <select value={assettoSanctionModal.entryKey} onChange={event => selectAssettoSanctionDriver(event.target.value)} className="input-field mt-2">
                          {imported.orderedRows.map(entry => <option key={entry.key} value={entry.key}>{entry.positionLabel} · {entry.driverName}</option>)}
                        </select>
                      </label>
                      <div className="mt-3 border border-racing-border bg-black/25 p-3 text-xs">
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Vueltas</span><strong className="text-white">{selectedEntry.laps}</strong></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Auto</span><strong className="truncate text-white">{selectedEntry.carModel || 'Sin informar'}</strong></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Posición actual</span><strong className="font-racing text-white">{selectedEntry.positionLabel}</strong></div>
                        <div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Posición estimada</span><strong className="font-racing text-red-300">{previewSelectedEntry?.positionLabel || selectedEntry.positionLabel}</strong></div>
                      </div>
                      <div className="mt-3 border border-red-500/25 bg-red-500/[0.05] p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-400">Sanciones aplicadas</span><span className="text-[9px] font-bold text-gray-500">{appliedSanctions.length}</span></div>
                        {accumulatedLabels.length ? <p className="mt-2 font-racing text-sm font-bold uppercase text-white">{accumulatedLabels.join(' • ')}</p> : <p className="mt-2 text-[10px] text-gray-600">Todavía no se aplicaron sanciones.</p>}
                        {appliedSanctions.length ? <div className="mt-3 space-y-2">{appliedSanctions.map((sanction, index) => {
                          const editing = assettoSanctionEdit?.entryKey === assettoSanctionModal.entryKey && assettoSanctionEdit?.index === index;
                          return <article key={`${assettoSanctionModal.entryKey}-sanction-${index}`} className="border-l-2 border-red-500/60 bg-black/25 px-2.5 py-2">
                            {editing ? <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-1"><button type="button" onClick={() => setAssettoSanctionEdit(current => ({ ...current, type: 'DENUNCIA' }))} className={`h-7 border text-[8px] font-bold uppercase ${assettoSanctionEdit.type === 'DENUNCIA' ? 'border-red-400 bg-red-500/15 text-red-300' : 'border-racing-border text-gray-500'}`}>Denuncia</button><button type="button" onClick={() => setAssettoSanctionEdit(current => ({ ...current, type: 'SANCIÓN DE OFICIO' }))} className={`h-7 border text-[8px] font-bold uppercase ${assettoSanctionEdit.type === 'SANCIÓN DE OFICIO' ? 'border-red-400 bg-red-500/15 text-red-300' : 'border-racing-border text-gray-500'}`}>De oficio</button></div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {[
                                  ['minute', 'Minuto', 1],
                                  ['second', 'Segundo', 1],
                                  ['time', 'Tiempo seg.', 0.1],
                                  ['positions', 'Puestos', 1],
                                  ['warnings', 'AP', 1],
                                  ['ballast', 'Lastre KG', 5],
                                ].map(([field, label, step]) => <label key={field}><span className={`text-[7px] font-bold uppercase ${field === 'minute' || field === 'second' ? 'text-red-300' : 'text-gray-500'}`}>{label}</span><input type="number" min="0" max={field === 'second' ? 59 : undefined} step={step} value={assettoSanctionEdit[field]} onChange={event => { setAssettoSanctionEdit(current => ({ ...current, [field]: event.target.value })); setAssettoSanctionMessage(''); }} disabled={assettoSanctionEdit.noSanction && field !== 'minute' && field !== 'second'} className="input-field mt-0.5 h-8 px-1 text-center text-[10px] disabled:opacity-30"/></label>)}
                              </div>
                              {editWarningProjection?.enabled && Number(assettoSanctionEdit.warnings) > 0 ? <div className={`border px-2 py-1.5 text-[8px] font-bold uppercase ${editWarningProjection.exceeded ? 'border-red-500/50 bg-red-500/10 text-red-300' : editWarningProjection.projectedTotal === editWarningProjection.limit && editWarningProjection.limit ? 'border-amber-300/50 bg-amber-400/10 text-amber-200' : 'border-amber-400/25 bg-amber-400/[0.05] text-amber-300'}`}>AP campeonato: {editWarningProjection.currentTotal} → {editWarningProjection.projectedTotal}{editWarningProjection.limit ? ` / ${editWarningProjection.limit}` : ''}{editWarningProjection.exceeded ? ' · Supera el límite' : editWarningProjection.projectedTotal === editWarningProjection.limit && editWarningProjection.limit ? ' · Límite alcanzado' : ''}</div> : null}
                              <div className="grid grid-cols-2 gap-1.5">
                                <label className={`flex cursor-pointer items-center justify-between border px-2 py-1.5 text-[8px] font-bold uppercase ${assettoSanctionEdit.dq ? 'border-red-400 bg-red-500/10 text-red-300' : 'border-racing-border text-gray-500'}`}><span>DQ</span><input type="checkbox" checked={Boolean(assettoSanctionEdit.dq)} onChange={event => setAssettoSanctionEdit(current => ({ ...current, dq: event.target.checked, noSanction: event.target.checked ? false : current.noSanction }))} className="h-4 w-4 accent-red-500"/></label>
                                <label className={`flex cursor-pointer items-center justify-between border px-2 py-1.5 text-[8px] font-bold uppercase ${assettoSanctionEdit.noSanction ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-racing-border text-gray-500'}`}><span>Sin sanción</span><input type="checkbox" checked={Boolean(assettoSanctionEdit.noSanction)} onChange={event => setAssettoSanctionEdit(current => ({ ...current, noSanction: event.target.checked, dq: event.target.checked ? false : current.dq }))} className="h-4 w-4 accent-emerald-400"/></label>
                              </div>
                              <textarea value={assettoSanctionEdit.description} onChange={event => setAssettoSanctionEdit(current => ({ ...current, description: event.target.value }))} maxLength={500} rows={3} className="input-field min-h-20 resize-y text-xs" placeholder="Descripción de la sanción"/>
                              {assettoSanctionMessage ? <p className="text-[8px] font-semibold leading-relaxed text-red-300">{assettoSanctionMessage}</p> : null}
                              <div className="flex justify-end gap-1"><button type="button" onClick={() => { setAssettoSanctionEdit(null); setAssettoSanctionMessage(''); }} className="border border-racing-border px-2 py-1 text-[8px] font-bold uppercase text-gray-400">Cancelar</button><button type="button" onClick={saveAssettoSanctionEdit} className="bg-red-600 px-2 py-1 text-[8px] font-bold uppercase text-white">Guardar cambios</button></div>
                            </div> : <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-[9px] leading-relaxed text-gray-300">{buildAssettoSanctionLabel(sanction)}</p><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setAssettoSanctionEdit({ entryKey: assettoSanctionModal.entryKey, index, ...emptyAssettoSanction(), ...sanction }); setAssettoSanctionMessage(''); }} className="inline-flex h-7 w-7 items-center justify-center border border-sky-500/30 text-sky-300 transition hover:bg-sky-600 hover:text-white" aria-label={`Editar sanción ${index + 1}`}><PencilSquareIcon className="h-3.5 w-3.5"/></button><button type="button" onClick={() => removeAssettoSanction(assettoSanctionModal.entryKey, index)} className="inline-flex h-7 w-7 items-center justify-center border border-red-500/30 text-red-400 transition hover:bg-red-600 hover:text-white" aria-label={`Eliminar sanción ${index + 1}`}><TrashIcon className="h-3.5 w-3.5"/></button></div></div>}
                          </article>;
                        })}</div> : null}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setAssettoSanctionDraft(current => ({ ...current, type: 'DENUNCIA' }))} className={`h-9 border text-[9px] font-bold uppercase ${assettoSanctionDraft.type === 'DENUNCIA' ? 'border-red-400 bg-red-500/15 text-red-300' : 'border-racing-border text-gray-500'}`}>Denuncia</button>
                        <button type="button" onClick={() => setAssettoSanctionDraft(current => ({ ...current, type: 'SANCIÓN DE OFICIO' }))} className={`h-9 border text-[9px] font-bold uppercase ${assettoSanctionDraft.type === 'SANCIÓN DE OFICIO' ? 'border-red-400 bg-red-500/15 text-red-300' : 'border-racing-border text-gray-500'}`}>De oficio</button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {[
                          ['minute', 'Minuto', 1],
                          ['second', 'Segundo', 1],
                          ['time', 'Tiempo seg.', 0.1],
                          ['positions', 'Puestos', 1],
                          ['warnings', 'AP', 1],
                          ['ballast', 'Lastre KG', 5],
                        ].map(([field, label, step]) => (
                          <label key={field}>
                            <span className={`text-[9px] font-bold uppercase ${field === 'minute' || field === 'second' ? 'text-red-300' : 'text-gray-500'}`}>{label}{field === 'minute' || field === 'second' ? ' *' : ''}</span>
                            <input type="number" min="0" max={field === 'second' ? 59 : undefined} step={step} value={assettoSanctionDraft[field]} onChange={event => { setAssettoSanctionDraft(current => ({ ...current, [field]: event.target.value })); setAssettoSanctionMessage(''); }} disabled={assettoSanctionDraft.noSanction && field !== 'minute' && field !== 'second'} className="input-field mt-1 text-center disabled:opacity-30" />
                          </label>
                        ))}
                      </div>
                      {draftWarningProjection.enabled ? (
                        <div className={`border px-3 py-3 ${draftWarningProjection.exceeded ? 'border-red-500/50 bg-red-500/10' : draftWarningProjection.projectedTotal === draftWarningProjection.limit && draftWarningProjection.limit ? 'border-amber-300/50 bg-amber-400/10' : 'border-amber-400/25 bg-amber-400/[0.045]'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-500">Apercibimientos del campeonato</span>
                            <strong className={`font-racing text-lg ${draftWarningProjection.exceeded ? 'text-red-300' : 'text-amber-300'}`}>
                              {draftWarningProjection.currentTotal}{Number(assettoSanctionDraft.warnings) > 0 ? ` → ${draftWarningProjection.projectedTotal}` : ''}{draftWarningProjection.limit ? ` / ${draftWarningProjection.limit} AP` : ' AP'}
                            </strong>
                          </div>
                          {draftWarningProjection.exceeded ? <p className="mt-1 text-xs font-semibold text-red-200">No se puede aplicar: superaría el límite de {draftWarningProjection.limit} AP.</p> : null}
                          {!draftWarningProjection.exceeded && draftWarningProjection.projectedTotal === draftWarningProjection.limit && draftWarningProjection.limit ? <p className="mt-1 text-xs font-semibold uppercase text-amber-200">Este piloto llega al límite de apercibimientos.</p> : null}
                          {draftWarningProjection.reachedLevels.length ? <div className="mt-2 space-y-1">{draftWarningProjection.reachedLevels.map(level => <p key={level.cantidad} className="text-xs text-amber-100"><strong>{level.cantidad} AP:</strong> {level.sancion}</p>)}</div> : null}
                        </div>
                      ) : null}
                      {assettoSanctionMessage ? <div className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{assettoSanctionMessage}</div> : null}
                      <div className="border border-racing-border bg-black/20 p-3">
                        <label className="block min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Reposicionar detrás de</span>
                          <select
                            value={assettoRepositionTarget}
                            onChange={event => {
                              const targetKey = event.target.value;
                              setAssettoRepositionTarget(targetKey);
                              if (targetKey) applyRepositionTarget(targetKey);
                            }}
                            className="input-field mt-1"
                            disabled={!repositionTargets.length || assettoSanctionDraft.dq}
                          >
                            <option value="">Seleccionar piloto</option>
                            {repositionTargets.map(entry => <option key={entry.key} value={entry.key}>{entry.positionLabel} · {entry.driverName}</option>)}
                          </select>
                        </label>
                        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">Al elegir un piloto se calcula automáticamente el recargo para ubicar al sancionado justo detrás. Volver a «Seleccionar piloto» no modifica la posición.</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className={`flex cursor-pointer items-center justify-between border px-4 py-3 ${assettoSanctionDraft.dq ? 'border-red-400 bg-red-500/10 text-red-300' : 'border-racing-border text-gray-400'}`}>
                          <span className="text-xs font-bold uppercase">Descalificar (DQ)</span>
                          <input type="checkbox" checked={Boolean(assettoSanctionDraft.dq)} onChange={event => setAssettoSanctionDraft(current => ({ ...current, dq: event.target.checked, noSanction: event.target.checked ? false : current.noSanction }))} className="h-5 w-5 accent-red-500" />
                        </label>
                        <label className={`flex cursor-pointer items-center justify-between border px-4 py-3 ${assettoSanctionDraft.noSanction ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-racing-border text-gray-400'}`}>
                          <span className="text-xs font-bold uppercase">No hay sanción</span>
                          <input type="checkbox" checked={Boolean(assettoSanctionDraft.noSanction)} onChange={event => setAssettoSanctionDraft(current => ({ ...current, noSanction: event.target.checked, dq: event.target.checked ? false : current.dq }))} className="h-5 w-5 accent-emerald-400" />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Descripción</span>
                        <textarea value={assettoSanctionDraft.description} onChange={event => setAssettoSanctionDraft(current => ({ ...current, description: event.target.value }))} maxLength={500} rows={4} placeholder="Descripción o fundamento de la resolución" className="input-field mt-2 min-h-28 resize-y text-sm" />
                      </label>
                    </div>

                    <aside className="min-w-0 border border-racing-border bg-black/20">
                      <div className="border-b border-racing-border px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-400">Orden en vivo</p>
                        <h4 className="mt-0.5 font-racing text-lg font-bold text-white">Posiciones · {sessionLabel}</h4>
                        <p className="mt-1 text-[10px] text-gray-500">Vista previa antes de aplicar.</p>
                      </div>
                      <div className="max-h-[430px] overflow-y-auto">
                        <table className="w-full table-fixed text-left">
                          <thead className="sticky top-0 z-10 bg-racing-dark text-[8px] font-bold uppercase tracking-wider text-gray-500">
                            <tr>
                              <th className="w-24 px-3 py-2 text-center">Pos.</th>
                              <th className="px-2 py-2">Piloto</th>
                              <th className="w-16 px-2 py-2 text-center">Mov.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((entry, index) => {
                              const movement = (originalOrder.get(entry.key) ?? index) - index;
                              const selected = entry.key === assettoSanctionModal.entryKey;
                              const appliedSanction = imported.sanctions[entry.key];
                              const sanctioned = getAssettoSanctionItems(appliedSanction).length > 0;
                              return (
                                <tr key={entry.key} className={`border-t border-racing-border/70 ${sanctioned ? 'bg-red-500/10' : selected ? 'bg-white/[0.06]' : 'odd:bg-white/[0.015]'}`}>
                                  <td className={`whitespace-nowrap px-3 py-2 text-center font-racing text-base font-bold ${sanctioned ? 'text-red-400' : 'text-white'}`}>{entry.positionLabel}</td>
                                  <td className={`truncate px-2 py-2 text-xs ${sanctioned ? 'font-bold text-red-400' : selected ? 'font-bold text-white' : 'text-gray-300'}`} title={entry.driverName}>{entry.driverName}</td>
                                  <td className={`px-2 py-2 text-center text-[10px] font-bold ${movement > 0 ? 'text-emerald-400' : movement < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                    {movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </aside>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-racing-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={() => setAssettoSanctionDraft(emptyAssettoSanction())} className="btn-secondary justify-center">Limpiar sanción</button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAssettoSanctionModal(null);
                          handleSaveResults();
                        }}
                        disabled={!Object.keys(dirtyResults).length || savingResults || Boolean(assettoSanctionEdit) || draftHasValue}
                        className="btn-secondary justify-center disabled:cursor-not-allowed disabled:opacity-35"
                        title={assettoSanctionEdit || draftHasValue ? 'Primero aplicá o descartá la edición actual' : 'Guardar los resultados de la fecha'}
                      >
                        {savingResults ? 'Guardando...' : 'Guardar resultados'}
                      </button>
                      <button type="button" onClick={applyAssettoSanction} className="btn-primary justify-center">Aplicar y recalcular</button>
                    </div>
                  </div>
                </section>
              </div>
            );
          })() : null}

          {resultAchievementModal ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 py-8"
              onMouseDown={event => {
                if (event.target === event.currentTarget) setResultAchievementModal(null);
              }}
            >
              <section role="dialog" aria-modal="true" aria-labelledby="result-achievement-title" className="w-full max-w-xl border border-amber-400/40 bg-racing-dark shadow-2xl shadow-black/70">
                <div className="flex items-start justify-between gap-4 border-b border-racing-border px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">Marcas oficiales</p>
                    <h3 id="result-achievement-title" className="mt-1 font-racing text-2xl font-bold text-white">Resultados · {resultAchievementModal.piloto}</h3>
                    <p className="mt-1 text-xs text-gray-500">Fecha {resultRound?.ronda} · Seleccioná los reconocimientos del piloto.</p>
                  </div>
                  <button type="button" onClick={() => setResultAchievementModal(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition hover:border-amber-300 hover:text-white" aria-label="Cerrar marcas oficiales">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid gap-2 p-5 sm:grid-cols-2">
                  {resultAchievementFields.map(field => (
                    <label key={field.key} className={`flex cursor-pointer items-center justify-between gap-4 border px-4 py-3 transition-colors ${resultAchievementDraft[field.key] ? 'border-amber-300/70 bg-amber-400/10 text-white' : 'border-racing-border bg-black/20 text-gray-400 hover:border-gray-500'}`}>
                      <span className="text-xs font-bold uppercase tracking-wider">{field.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(resultAchievementDraft[field.key])}
                        onChange={event => setResultAchievementDraft(current => ({ ...current, [field.key]: event.target.checked }))}
                        className="h-5 w-5 accent-amber-400"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-racing-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">Aplicá los cambios y luego presioná Guardar en la planilla.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setResultAchievementModal(null)} className="btn-secondary justify-center">Cancelar</button>
                    <button type="button" onClick={applyResultAchievements} className="btn-primary justify-center">Aplicar marcas</button>
                  </div>
                </div>
              </section>
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
                      <option value={pendingCircuitValue}>A CONFIRMAR</option>
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
                <span className="text-sm text-gray-300">Regla porcentual para habilitar pilotos</span>
                <div className="relative mt-2">
                  <input
                    name="regla_porcentaje"
                    type="number"
                    min="0"
                    max="999.999"
                    step="0.1"
                    value={championshipForm.regla_porcentaje}
                    onChange={handleChampionshipChange}
                    className="input-field pr-12"
                    placeholder="105"
                    required
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-racing text-lg font-bold text-gray-500">%</span>
                </div>
                <small className="mt-1.5 block text-xs leading-relaxed text-gray-500">Ejemplo: 105 habilita a quienes estén dentro del 105% de la mejor vuelta. Usá 0 para desactivar esta regla.</small>
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
                        <td className="px-4 py-3 text-gray-300"><span className="block">:{championship.puerto || '-'} · #{championship.n_server ?? '-'}</span><span className={`mt-1 block text-[10px] font-bold uppercase ${Number(championship.regla_porcentaje || 0) > 0 ? 'text-cyan-300' : 'text-gray-600'}`}>{Number(championship.regla_porcentaje || 0) > 0 ? `Regla ${Number(championship.regla_porcentaje)}%` : 'Sin regla porcentual'}</span></td>
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
                            <option value={pendingCircuitValue}>A CONFIRMAR</option>
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
                      <option value={pendingCircuitValue}>A CONFIRMAR</option>
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
            <nav className="scrollbar-hidden mb-5 overflow-x-auto pb-1" aria-label="Secciones de administración">
              <div className="flex w-full min-w-max flex-nowrap items-center justify-between gap-1">
                {adminSections.map(section => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border px-2.5 font-racing text-[9px] font-semibold transition-colors ${isActive
                        ? 'border-racing-red bg-racing-red text-white'
                        : 'border-transparent bg-racing-card/70 text-gray-400 hover:border-racing-border hover:bg-racing-card hover:text-white'
                        }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div key={activeSection} className="min-w-0">
              {renderSection()}
            </div>
          </>
        )}
      </div>
      {savingResults ? <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 px-5 backdrop-blur-sm" role="status" aria-live="assertive" aria-label="Guardando resultados">
        <div className="w-full max-w-sm border border-racing-red/50 bg-racing-dark px-6 py-8 text-center shadow-2xl shadow-black">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center"><div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-racing-red"/><FlagIcon className="h-9 w-9 animate-pulse text-racing-red"/></div>
          <h2 className="mt-5 font-racing text-2xl font-bold uppercase text-white">Guardando resultados</h2>
          <p className="mt-2 text-sm text-gray-400">Estamos actualizando la planilla, los puntos, lastres y sanciones.</p>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-racing-red">No cierres esta pantalla</p>
        </div>
      </div> : null}
    </div>
  );
}
