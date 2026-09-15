export const formatPrice = value => `$ ${Number(value || 0).toLocaleString('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})}`;
