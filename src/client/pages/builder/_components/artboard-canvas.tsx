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
        case "RESET_VIEW":
          setScale(1);
          setPan({ x: 0, y: 0 });
          break;
        case "CENTER_VIEW":
          setPan({ x: 0, y: 0 });
          break;
        case "TOGGLE_PAN_MODE":
          setPanMode(!!detail.panMode);
          break;
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

  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-black" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})` }}
        onMouseDown={onMouseDown}
      >
        {/* A4 page */}
        <div
          className="relative shadow-2xl"
          style={{ width: 794, height: 1123, background: theme.background, color: theme.text }}
        >
          {/* Header */}
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

          {/* Body */}
          <div className="grid grid-cols-3 gap-6 px-10">
            <div className="col-span-2">
              {/* Summary */}
              {summary?.content && (
                <section className="mb-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Summary</h2>
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: summary.content }} />
                </section>
              )}

              {/* Experience */}
              {Array.isArray(experience) && experience.length > 0 && (
                <section className="mb-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Experience</h2>
                  <div className="space-y-3">
                    {experience.slice(0, 6).map((exp: any) => (
                      <div key={exp.id} className="rounded border border-black/5 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{exp.position || "Role"}</p>
                          <p className="text-xs opacity-60">{exp.startDate} {exp.endDate ? `– ${exp.endDate}` : "– Present"}</p>
                        </div>
                        <p className="text-xs opacity-80">{exp.company || "Company"}</p>
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
              )}
            </div>

            {/* Sidebar */}
            <div>
              {Array.isArray(skills) && skills.length > 0 && (
                <section className="mb-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Skills</h2>
                  <ul className="flex flex-wrap gap-1">
                    {skills.slice(0, 18).map((s: any) => (
                      <li key={s.id} className="rounded bg-black/5 px-2 py-1 text-xs" style={{ borderColor: `${theme.primary}40` }}>
                        {s.name || s.description || "Skill"}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 mb-4 text-center text-[10px] opacity-60">
            <span>1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
