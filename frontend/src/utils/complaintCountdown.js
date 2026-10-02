import { parseCalendarDate } from './calendarDate';

export const formatComplaintCountdown = (value, now = Date.now()) => {
  const closingDate = parseCalendarDate(value);
  if (!closingDate) return '';
  const difference = closingDate.getTime() - now;
  if (difference <= 0) return '';
  const totalHours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference / 60000) % 60);
  const parts = [];
  if (totalHours > 0) parts.push(`${totalHours} ${totalHours === 1 ? 'HORA' : 'HORAS'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'MINUTO' : 'MINUTOS'}`);
  return parts.length ? parts.join(' · ') : 'MENOS DE 1 MINUTO';
};
