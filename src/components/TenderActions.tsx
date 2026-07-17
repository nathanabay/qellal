"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon, PrinterIcon, ShareIcon } from "@/components/ui/icons";

// One-tap Copy / Share / Save-as-PDF for a tender — directly fixes 2merkato's
// most-cited gap (no copy-text, no export). Web Share API where available, with
// a clipboard fallback everywhere else. "Save as PDF" is the browser print
// dialog scoped by the print stylesheet in globals.css.
export function TenderActions({
  title,
  facts,
  sourceUrl,
}: {
  title: string;
  facts: Array<{ label: string; value: string }>;
  sourceUrl: string | null;
}) {
  const [copied, setCopied] = useState<"details" | "link" | null>(null);

  const plainText = () => {
    const lines = [title, "", ...facts.map((f) => `${f.label}: ${f.value}`)];
    if (sourceUrl) lines.push(`Original notice: ${sourceUrl}`);
    lines.push(`View on Qellal: ${window.location.href}`);
    return lines.join("\n");
  };

  const flash = (which: "details" | "link") => {
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(plainText());
      flash("details");
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const share = async () => {
    const href = window.location.href;
    const shareFn = (
      navigator as { share?: (data: ShareData) => Promise<void> }
    ).share;
    if (shareFn) {
      try {
        await shareFn.call(navigator, {
          title,
          text: `${title}\n\n${href}`,
          url: href,
        });
      } catch {
        /* user cancelled the share sheet */
      }
      return;
    }
    // Fallback for desktop browsers without the Share API: copy the link.
    try {
      await navigator.clipboard.writeText(href);
      flash("link");
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const btn =
    "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="no-print mt-5 flex flex-wrap gap-2">
      <button type="button" onClick={copyDetails} className={btn}>
        {copied === "details" ? <CheckIcon className="h-4 w-4 text-primary" /> : <LinkIcon />}
        {copied === "details" ? "Copied" : "Copy details"}
      </button>
      <button type="button" onClick={share} className={btn}>
        {copied === "link" ? <CheckIcon className="h-4 w-4 text-primary" /> : <ShareIcon />}
        {copied === "link" ? "Link copied" : "Share"}
      </button>
      <button type="button" onClick={() => window.print()} className={btn}>
        <PrinterIcon />
        Save as PDF
      </button>
    </div>
  );
}
