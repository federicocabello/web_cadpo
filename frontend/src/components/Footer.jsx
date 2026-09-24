import { ArrowTopRightOnSquareIcon, CodeBracketIcon } from '@heroicons/react/24/outline';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.07] bg-black/30 px-4 py-5">
      <a
        href="https://www.proyectoprisma.com.ar"
        target="_blank"
        rel="noreferrer"
        className="group mx-auto flex w-fit flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-xs uppercase tracking-[0.14em] text-gray-500 transition-colors duration-300 hover:text-gray-200 sm:text-[13px] sm:tracking-[0.18em]"
        aria-label="Visitar Proyecto Prisma"
      >
        <CodeBracketIcon className="h-5 w-5 text-[#00ffcd]/65 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:text-[#00ffcd] group-hover:drop-shadow-[0_0_7px_rgba(0,255,205,0.65)]"/>
        <span>Desarrollado y diseñado por <strong className="font-semibold text-gray-300 transition-colors duration-300 group-hover:text-[#00ffcd]">Proyecto Prisma</strong></span>
        <span className="normal-case tracking-normal text-gray-600 transition-colors duration-300 group-hover:text-[#00ffcd]/80">www.proyectoprisma.com.ar</span>
        <ArrowTopRightOnSquareIcon className="h-4 w-4 opacity-50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#00ffcd] group-hover:opacity-100"/>
      </a>
    </footer>
  );
}
