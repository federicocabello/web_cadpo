export default function ServerJoinButton({ href, className = '', variant = 'red' }) {
  if (!href) return null;

  const variantClasses = variant === 'green'
    ? 'server-action-green border-emerald-300 bg-emerald-600 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:bg-emerald-500'
    : 'server-action-red border-red-400 bg-racing-red shadow-racing';

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`server-action-button inline-flex items-center gap-3 border px-5 py-3 font-racing text-sm font-bold uppercase text-white transition-transform hover:-translate-y-0.5 active:scale-95 ${variantClasses} ${className}`}
    >
      <span className="server-join-flag h-5 w-7 border border-white/60" aria-hidden="true" />
      Ingresar al servidor
    </a>
  );
}
