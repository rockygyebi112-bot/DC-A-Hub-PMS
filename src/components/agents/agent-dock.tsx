"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ClipboardList,
  Copy,
  Download,
  FilePen,
  Loader2,
  ScanSearch,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AGENTS, AGENT_LIST, type AgentDef, type AgentId } from "@/lib/agents/registry";

const ICONS: Record<AgentDef["icon"], LucideIcon> = {
  "scan-search": ScanSearch,
  "file-pen": FilePen,
  "clipboard-list": ClipboardList,
};

/**
 * Floating, app-wide launcher (bottom-right) that opens a panel for running the
 * DC&A Hub task-agents. Mounted in the internal layouts (workspace + admin)
 * only — never the client portal. Each agent is a document generator, so the
 * panel is a picker → input → rendered draft flow rather than a chat.
 */
export function AgentDock() {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<AgentId | null>(null);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  // Render via a portal to <body> so the fixed launcher/panel is positioned
  // against the viewport, not against any transformed/scrolling ancestor in
  // the app shell (which would otherwise push it below the fold).
  useEffect(() => setMounted(true), []);

  const agent = agentId ? AGENTS[agentId] : null;
  const torRequired = agent?.inputMode === "tor";
  const canRun = !!agent && !running && (!torRequired || input.trim().length > 0);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function selectAgent(id: AgentId) {
    setAgentId(id);
    setInput("");
    setOutput(null);
    setModel(null);
  }

  function backToPicker() {
    setAgentId(null);
    setInput("");
    setOutput(null);
    setModel(null);
  }

  async function run() {
    if (!agent) return;
    setRunning(true);
    setOutput(null);
    setModel(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      let data: { text?: string; model?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        toast.error(`The server returned an unexpected response (HTTP ${res.status}).`);
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "The agent run failed.");
        return;
      }
      setOutput(data.text ?? "");
      setModel(data.model ?? null);
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  async function copy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!output || !agent) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agent.id}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open DC&A AI agents"
          className="fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-primary/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6"
        >
          <Image src="/logo.png" alt="DC&A Hub" width={34} height={34} className="object-contain" />
        </button>
      )}

      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="DC&A AI agents"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl",
            "md:inset-auto md:bottom-6 md:right-4 md:h-[640px] md:max-h-[85vh] md:w-[420px] md:rounded-2xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {agent ? (
                <button
                  type="button"
                  onClick={backToPicker}
                  aria-label="Back to agents"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
              ) : (
                <span className="flex size-7 items-center justify-center rounded-md bg-white ring-1 ring-border">
                  <Image src="/logo.png" alt="DC&A Hub" width={18} height={18} className="object-contain" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-bold leading-tight">
                  {agent ? agent.name : "Business Development"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {agent ? "First draft for expert review" : "DC&A Hub AI agents"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {!agent ? (
              <div className="space-y-2">
                {AGENT_LIST.map((a) => {
                  const Icon = ICONS[a.icon];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectAgent(a.id)}
                      className="flex w-full items-start gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-heading text-sm font-semibold">{a.name}</span>
                        <span className="block text-xs text-muted-foreground">{a.tagline}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="dock-input" className="text-xs font-medium text-muted-foreground">
                    {agent.inputLabel}
                  </label>
                  <Textarea
                    id="dock-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={agent.inputPlaceholder}
                    rows={agent.inputMode === "tor" ? 6 : 3}
                    disabled={running}
                  />
                </div>

                <Button onClick={run} disabled={!canRun} className="w-full">
                  {running ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Working…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> {agent.runLabel}
                    </>
                  )}
                </Button>
                {running && (
                  <p className="text-center text-xs text-muted-foreground">
                    This can take a minute or two — reasoning over DC&A Hub&apos;s references.
                  </p>
                )}

                {output !== null && (
                  <div className="rounded-xl border bg-background">
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {model ? `Draft · ${model}` : "Draft"}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button variant="outline" size="xs" onClick={copy}>
                          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button variant="outline" size="xs" onClick={download}>
                          <Download className="size-3" /> .md
                        </Button>
                      </div>
                    </div>
                    <pre
                      ref={outputRef}
                      className="max-h-[40vh] overflow-auto whitespace-pre-wrap px-3 py-3 font-sans text-xs leading-relaxed text-foreground"
                    >
                      {output || "(The agent returned an empty response.)"}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
