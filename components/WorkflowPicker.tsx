import React from "react";

type Mode = "magic" | "manual";

type Props = {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  hasFile: boolean;
};

const Icon = {
  Sparkles: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l1.2 4.2L17.5 8l-4.3 1.8L12 14l-1.2-4.2L6.5 8l4.3-1.8L12 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19 12l.7 2.3L22 15l-2.3.7L19 18l-.7-2.3L16 15l2.3-.7L19 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 13l.8 2.6L8.5 16l-2.7.8L5 19.5l-.8-2.7L1.5 16l2.7-.8L5 13Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  Wand: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none">
      <path d="M4 20l10-10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 17l-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 10l7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13.5 3.5l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18.5 8.5l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  Shield: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 12.2l2.3 2.3L15.8 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Sliders: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none">
      <path d="M4 6h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 6h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 6v0" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M4 12h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 12v0" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M4 18h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20 18h0" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const Badge: React.FC<{ children: React.ReactNode; tone?: "green" | "indigo" | "gray" }> = ({ children, tone = "gray" }) => {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "indigo"
        ? "bg-indigo-50 text-indigo-700 border-indigo-100"
        : "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${cls}`}>
      {children}
    </span>
  );
};

export const WorkflowPicker: React.FC<Props> = ({ mode, onModeChange, hasFile }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Choose workflow</div>
          <div className="text-xs text-gray-500 mt-1">
            {hasFile ? "Pick the easiest option — we'll handle the rest." : "Upload a PDF first to continue."}
          </div>
        </div>
        <Badge tone="gray">
          <Icon.Shield className="h-4 w-4" />
          Safe & temporary
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        {/* MAGIC FIX (black box) */}
        <button
          type="button"
          onClick={() => onModeChange("magic")}
          className={[
            "w-full text-left rounded-2xl border p-4 transition group",
            mode === "magic"
              ? "border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white"
              : "border-gray-200 bg-white hover:border-gray-300",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Icon.Sparkles className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-gray-900">AI Magic Fix</div>
                  <Badge tone="green">Recommended</Badge>
                  <Badge tone="green">No setup</Badge>
                  <Badge tone="green">One click</Badge>
                </div>

                <div className="text-xs text-gray-600 mt-1">
                  We automatically prepare your PDF for professional printing — you don't need to know technical settings.
                </div>

                {/* User-friendly outcomes (no options!) */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon.Wand className="h-4 w-4 text-emerald-700" />
                      <p className="text-xs font-semibold text-gray-900">Auto-fix common print issues</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Colors, resolution, margins, embedded resources.
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon.Shield className="h-4 w-4 text-emerald-700" />
                      <p className="text-xs font-semibold text-gray-900">Print-ready output</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Optimized PDF for prepress workflows.
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-gray-500">
                  Typical time: <span className="font-semibold text-gray-700">10–60s</span> · Best for most users.
                </div>
              </div>
            </div>

            {/* Selected indicator */}
            <div className="mt-0.5">
              {mode === "magic" ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Icon.Check className="h-5 w-5" />
                </span>
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 group-hover:bg-gray-200">
                  •
                </span>
              )}
            </div>
          </div>
        </button>

        {/* MANUAL (advanced) */}
        <button
          type="button"
          onClick={() => onModeChange("manual")}
          className={[
            "w-full text-left rounded-2xl border p-4 transition group",
            mode === "manual"
              ? "border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white"
              : "border-gray-200 bg-white hover:border-gray-300",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Icon.Sliders className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-gray-900">Manual</div>
                  <Badge tone="indigo">Advanced</Badge>
                </div>

                <div className="text-xs text-gray-600 mt-1">
                  For experts who want to review issues and decide fixes step-by-step.
                </div>

                <div className="mt-3 text-[11px] text-gray-500">
                  Best if you need special requirements (spot colors, strict ICC mapping, imposition rules).
                </div>
              </div>
            </div>

            <div className="mt-0.5">
              {mode === "manual" ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Icon.Check className="h-5 w-5" />
                </span>
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 group-hover:bg-gray-200">
                  •
                </span>
              )}
            </div>
          </div>
        </button>
      </div>

      <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
        Your PDF is processed temporarily and cleaned up automatically. We don't add watermarks.
      </div>
    </div>
  );
};