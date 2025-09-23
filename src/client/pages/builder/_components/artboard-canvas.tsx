import { useEffect, useMemo, useRef, useState } from "react";
import { useResumeStore } from "@/client/stores/resume";

type Point = { x: number; y: number };

export const ArtboardCanvas = () => {
  const data = useResumeStore((s) => s.resume?.data as any);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<Point | null>(null);
  const [debug, setDebug] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get('debug') === '1'; } catch { return false; }
  });
  const PAGE = { width: 794, height: 1123 };

  // Handle commands from toolbar
  useEffect(() => {
    const onCmd = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      switch (detail.type) {
        case "ZOOM_IN":
          setScale((s) => Math.min(3, s * 1.1));
          break;
        case "ZOOM_OUT":
          setScale((s) => Math.max(0.3, s / 1.1));
          break;
        case "RESET_VIEW": {
          // Fit to view
          const c = containerRef.current;
          if (c) {
            const sw = c.clientWidth;
            const sh = c.clientHeight;
            const fit = Math.min(sw / PAGE.width, sh / PAGE.height) * 0.95;
            setScale(() => Math.max(0.3, Math.min(3, fit)));
          } else {
            setScale(1);
          }
          setPan({ x: 0, y: 0 });
          break;
        }
        case "CENTER_VIEW":
          setPan({ x: 0, y: 0 });
          break;
        case "TOGGLE_PAN_MODE":
          setPanMode(!!detail.panMode);
          break;
        case "PRINT": {
          // Client-side print of current artboard pages
          const pagesRoot = document.getElementById('artboard-pages');
          const content = pagesRoot?.innerHTML || document.querySelector('.artboard-page')?.outerHTML;
          if (!content) return window.print();
          const html = `<!doctype html><html><head><title>Print</title><style>
            @page { size: A4; margin: 0; }
            html, body { height: auto; }
            body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .artboard-page { page-break-after: always; }
            .artboard-page:last-child { page-break-after: auto; }
          </style></head><body>${content}</body></html>`;
          const w = window.open('about:blank', '_blank');
          if (!w) return window.print();
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => { try { w.print(); } finally { w.close(); } }, 100);
          break;
        }
      }
    };
    window.addEventListener("ARTBOARD_CMD", onCmd as EventListener);
    return () => window.removeEventListener("ARTBOARD_CMD", onCmd as EventListener);
  }, []);

  const basics = data?.sections?.basics ?? {};
  const summary = data?.sections?.summary ?? {};
  const experience = data?.sections?.experience?.items ?? [];
  const skills = data?.sections?.skills?.items ?? [];
  const theme = data?.metadata?.theme ?? { primary: "#4f46e5", background: "#ffffff", text: "#0f172a" };
  const layout: string[][][] | undefined = data?.metadata?.layout;
  const pageOptions = data?.metadata?.page?.options ?? { breakLine: false, pageNumbers: true };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') setDebug((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!panMode) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !panMode || !dragStart.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    // Prevent page scroll when interacting with artboard
    e.preventDefault();
    if (panMode) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    } else {
      const delta = -e.deltaY; // wheel up zooms in
      const factor = Math.exp(delta * 0.001);
      setScale((s) => Math.max(0.3, Math.min(3, s * factor)));
    }
  };

  // Fit to container on first mount
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const sw = c.clientWidth;
    const sh = c.clientHeight;
    const fit = Math.min(sw / PAGE.width, sh / PAGE.height) * 0.95;
    setScale(() => Math.max(0.3, Math.min(3, fit)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && (key === '+' || key === '=')) {
        e.preventDefault();
        setScale((s) => Math.min(3, s * 1.1));
      } else if ((e.ctrlKey || e.metaKey) && (key === '-' || key === '_')) {
        e.preventDefault();
        setScale((s) => Math.max(0.3, s / 1.1));
      } else if ((e.ctrlKey || e.metaKey) && key === '0') {
        e.preventDefault();
        const c = containerRef.current;
        if (c) {
          const sw = c.clientWidth;
          const sh = c.clientHeight;
          const fit = Math.min(sw / PAGE.width, sh / PAGE.height) * 0.95;
          setScale(() => Math.max(0.3, Math.min(3, fit)));
          setPan({ x: 0, y: 0 });
        } else {
          setScale(1);
          setPan({ x: 0, y: 0 });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Simple computed initials for avatar fallback
  const initials = useMemo(() => {
    const name: string = basics?.name || "";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join("");
  }, [basics?.name]);

  const renderSection = (id: string) => {
    // Handle custom sections
    if (id.startsWith('custom.')) {
      const cid = id.split('custom.')[1];
      const section = data?.sections?.custom?.[cid];
      if (!section) return null;
      return (
        <section key={id} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>{section.name || 'Custom'}</h2>
          {section.description && <p className="text-xs opacity-80">{section.description}</p>}
          {Array.isArray(section.items) && section.items.length > 0 && (
            <ul className="mt-1 space-y-1">
              {section.items.slice(0, 8).map((it: any, i: number) => (
                <li key={it?.id || i} className="text-xs opacity-90">{it?.name || it?.title || it?.position || it?.description || 'Item'}</li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    switch (id) {
      case 'summary':
        if (!summary?.content) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Summary</h2>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: summary.content }} />
          </section>
        );
      case 'experience':
        if (!Array.isArray(experience) || experience.length === 0) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Experience</h2>
            <div className="space-y-3">
              {experience.slice(0, 6).map((exp: any) => (
                <div key={exp.id} className="rounded border border-black/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{exp.position || 'Role'}</p>
                    <p className="text-xs opacity-60">{exp.startDate} {exp.endDate ? `– ${exp.endDate}` : '– Present'}</p>
                  </div>
                  <p className="text-xs opacity-80">{exp.company || 'Company'}</p>
                  {exp.summary && (
                    <div className="mt-1 text-xs opacity-90" dangerouslySetInnerHTML={{ __html: exp.summary }} />
                  )}
                  {Array.isArray(exp.highlights) && exp.highlights.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs opacity-90">
                      {exp.highlights.slice(0, 5).map((h: string, i: number) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      case 'skills': {
        const list = skills;
        if (!Array.isArray(list) || list.length === 0) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Skills</h2>
            <ul className="flex flex-wrap gap-1">
              {list.slice(0, 18).map((s: any) => (
                <li key={s.id} className="rounded bg-black/5 px-2 py-1 text-xs" style={{ borderColor: `${theme.primary}40` }}>
                  {s.name || s.description || 'Skill'}
                </li>
              ))}
            </ul>
          </section>
        );
      }
      case 'education': {
        const list = data?.sections?.education?.items ?? [];
        if (!Array.isArray(list) || list.length === 0) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Education</h2>
            <div className="space-y-2">
              {list.slice(0, 5).map((ed: any) => (
                <div key={ed.id}>
                  <p className="text-sm font-semibold">{ed.studyType ? `${ed.studyType} • ${ed.area || ''}` : ed.area || 'Education'}</p>
                  <p className="text-xs opacity-80">{ed.institution}</p>
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'projects': {
        const list = data?.sections?.projects?.items ?? [];
        if (!Array.isArray(list) || list.length === 0) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Projects</h2>
            <ul className="space-y-1">
              {list.slice(0, 6).map((p: any) => (
                <li key={p.id} className="text-xs"><span className="font-semibold">{p.name}</span>{p.description ? ` – ${p.description}` : ''}</li>
              ))}
            </ul>
          </section>
        );
      }
      case 'languages': {
        const list = data?.sections?.languages?.items ?? [];
        if (!Array.isArray(list) || list.length === 0) return null;
        return (
          <section key={id} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Languages</h2>
            <ul className="flex flex-wrap gap-1">
              {list.slice(0, 8).map((l: any) => (
                <li key={l.id} className="rounded bg-black/5 px-2 py-1 text-xs">{l.name}{l.level ? ` • ${l.level}` : ''}</li>
              ))}
            </ul>
          </section>
        );
      }
      default:
        return null;
    }
  };

  const pagesLayout: string[][][] = useMemo(() => {
    if (Array.isArray(layout) && layout.length > 0) return layout;
    return [[['summary', 'experience'], ['skills']]]; // fallback: one page, 2 columns
  }, [layout]);

  return (
    <div id="artboard-root" ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-black" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})` }}
        onMouseDown={onMouseDown}
      >
        {/* A4 pages */}
        <div id="artboard-pages">
          {pagesLayout.map((cols, pageIndex) => {
            const mainSections = cols?.[0] || [];
            const sidebarSections = cols?.[1] || [];
            return (
              <div
                key={pageIndex}
                className={`artboard-page relative mb-8 shadow-2xl ${pageOptions.breakLine ? 'ring-1 ring-dashed ring-black/20' : ''}`}
                style={{ width: PAGE.width, height: PAGE.height, background: theme.background, color: theme.text }}
              >
                {/* Header (repeat on each page for simplicity) */}
                <div className="px-10 pt-10">
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-full text-sm font-semibold" style={{ background: theme.primary, color: "white" }}>
                      {initials || ""}
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold" style={{ color: theme.primary }}>{basics?.name || "Your Name"}</h1>
                      <p className="text-sm opacity-80">{basics?.headline || basics?.label || "Job Title"}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs opacity-80">
                    <p className="truncate">
                      {[basics?.email, basics?.phone, basics?.location?.city, basics?.location?.country]
                        .filter(Boolean)
                        .join(" • ") || "email@example.com • (123) 456-7890"}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-10 my-5 h-px" style={{ background: `${theme.primary}33` }} />

                {/* Body using layout */}
                <div className="grid grid-cols-3 gap-6 px-10">
                  <div className="col-span-2">
                    {mainSections.map((sid) => renderSection(sid))}
                  </div>
                  <div>
                    {sidebarSections.map((sid) => renderSection(sid))}
                  </div>
                </div>

                {/* Footer */}
                {pageOptions.pageNumbers && (
                  <div className="absolute bottom-0 left-0 right-0 mb-4 text-center text-[10px] opacity-60">
                    <span>{pageIndex + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {debug && (
        <div className="pointer-events-none fixed bottom-3 left-3 rounded bg-black/70 p-2 text-[11px] text-white shadow-lg">
          <div>Debug On</div>
          <div>ID: {useResumeStore.getState()?.resume?.id}</div>
          <div>Template: {data?.metadata?.template}</div>
          <div>Theme: {theme.primary}, {theme.background}, {theme.text}</div>
          <div>Scale: {scale.toFixed(2)} Pan: {pan.x},{pan.y}</div>
          <div>Layout pages: {Array.isArray(pagesLayout) ? pagesLayout.length : 0}</div>
        </div>
      )}
    </div>
  );
};
