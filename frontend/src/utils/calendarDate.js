const DATABASE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const LEAGUE_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export const getDatabaseDateParts = value => {
  if (!value) return null;

  const match = String(value).match(DATABASE_DATE_PATTERN);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  };
};

export const parseCalendarDate = value => {
  const parts = getDatabaseDateParts(value);
  if (!parts) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  // El calendario de CADPO usa la hora argentina guardada literalmente en MySQL.
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour + 3,
    parts.minute,
    parts.second,
  ));
};

export const formatCalendarDate = (value, options) => {
  const date = parseCalendarDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('es-AR', {
    ...options,
    timeZone: LEAGUE_TIME_ZONE,
  }).format(date);
};

export const toDateInputValue = value => {
  const parts = getDatabaseDateParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const toDateTimeInputValue = value => {
  const parts = getDatabaseDateParts(value);
  if (!parts) return '';
  return `${toDateInputValue(value)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
};
