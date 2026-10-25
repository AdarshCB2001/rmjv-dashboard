export function MadeBy() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-faint">
      Made with fun by
      <a href="https://funkustoms.com" target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/funkustoms-logo.png" alt="FunKustoms" className="h-4 w-auto" />
      </a>
      team
    </p>
  );
}
