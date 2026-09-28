import type { ReactNode } from "react";
import { QrCode } from "./QrCode";

/** The attendee's ticket: event name, time, deposit and the QR the door scans. */
export function TicketCard({
  title,
  when,
  deposit,
  qrValue,
  footer,
}: {
  title: string;
  when: string;
  deposit: string;
  qrValue: string;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-28px_rgb(20_60_40/0.45)]">
      <div className="bg-accent px-5 pb-5 pt-4 text-accent-ink">
        <p className="text-xs font-medium opacity-80">Ticket</p>
        <p className="mt-1 text-lg font-semibold leading-snug tracking-tight">{title}</p>
        <p className="mt-0.5 text-sm opacity-85">{when}</p>
      </div>
      <div className="relative flex justify-center px-5 pb-4 pt-5">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bg" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bg" />
        <QrCode value={qrValue} size={220} label={`Ticket for ${title}`} />
      </div>
      <div className="flex items-center justify-between border-t border-dashed border-line px-5 py-3.5 text-sm">
        <span className="text-ink-3">Deposit held</span>
        <span className="tabular font-semibold">{deposit}</span>
      </div>
      {footer && <div className="border-t border-line px-5 py-3.5">{footer}</div>}
    </div>
  );
}
