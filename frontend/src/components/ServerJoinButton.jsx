export default function ServerJoinButton({ href, className = '' }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`server-join-button inline-flex items-center gap-3 border border-red-400 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-racing transition-transform hover:-translate-y-0.5 active:scale-95 ${className}`}
    >
      <span className="server-join-flag h-5 w-7 border border-white/60" aria-hidden="true" />
      Ingresar al servidor
    </a>
  );
}
