export function TerminalPreview() {
  return (
    <div
      className="overflow-hidden rounded-b-panel bg-[#1a1a1a] p-4 font-mono text-[13px] leading-relaxed text-[#f2f2f2]"
      aria-label="Example SSH terminal session inside Zvia"
    >
      <div>
        <span className="text-[#4a9d5f]">ubuntu@production</span>
        <span className="text-[#f2f2f2]">:</span>
        <span className="text-[#6b8cce]">~</span>
        <span className="text-[#f2f2f2]">$ </span>
        <span>systemctl status nginx</span>
      </div>
      <div className="mt-3 text-[#f2f2f2]">
        <span className="text-[#4a9d5f]">●</span> nginx.service - A high performance web server
      </div>
      <div className="text-[#999999]">     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)</div>
      <div className="text-[#999999]">     Active: active (running) since Mon 2026-08-25 09:14:02 UTC; 3 days ago</div>
      <div className="mt-3">
        <span className="text-[#4a9d5f]">ubuntu@production</span>
        <span className="text-[#f2f2f2]">:</span>
        <span className="text-[#6b8cce]">~</span>
        <span className="text-[#f2f2f2]">$ </span>
        <span className="inline-block h-[1.1em] w-2 translate-y-[2px] bg-[#f2f2f2]" aria-hidden />
      </div>
    </div>
  )
}
