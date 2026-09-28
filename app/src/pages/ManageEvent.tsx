import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  HandCoins,
  ListChecks,
  QrCode as QrIcon,
  Scan,
  ShareNetwork,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, Card, Chip, Notice, Skeleton, Stat } from "../components/ui";
import { QrCode } from "../components/QrCode";
import { Scanner } from "../components/Scanner";
import { useAccount } from "../components/account";
import { useToast } from "../components/toast";
import { openConnectModal } from "../components/WalletMenu";
import { PhaseChip } from "./Home";
import NotFound from "./NotFound";
import {
  checkIn,
  eventPhase,
  fetchEventTickets,
  formatDate,
  formatEur,
  friendlyError,
  isCheckedIn,
  parseTicketQr,
  settle,
  shortKey,
  type EventAccount,
  type TicketWithKey,
} from "../lib/pfand";
import { parseKey, relative, useEvent, useNow } from "../lib/useEventData";

type Tab = "scan" | "guests" | "share";
type ScanResult = { ok: boolean; title: string; body: string; at: number };

export default function ManageEvent() {
  const { eventKey: raw } = useParams();
  const eventKey = parseKey(raw);
  const { event, reload } = useEvent(eventKey, 5000);
  const { publicKey } = useWallet();
  const { program, refresh } = useAccount();
  const toast = useToast();
  const now = useNow(1000);
  const [tickets, setTickets] = useState<TicketWithKey[] | null>(null);
  const [tab, setTab] = useState<Tab>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!eventKey) return;
    const t = await fetchEventTickets(program, eventKey).catch(() => null);
    if (t) setTickets(t.sort((a, b) => a.account.registeredAt.toNumber() - b.account.registeredAt.toNumber()));
  }, [program, eventKey]);

  useEffect(() => {
    loadTickets();
    const id = setInterval(loadTickets, 5000);
    return () => clearInterval(id);
  }, [loadTickets]);

  const eventUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}#/e/${raw}`,
    [raw],
  );

  if (!eventKey || event === null) return <NotFound />;
  if (event === undefined)
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-8 h-28" />
        <Skeleton className="mt-6 h-96" />
      </div>
    );

  const isOrganizer = !!publicKey?.equals(event.organizer);
  const phase = eventPhase(event, now);
  const noShows = event.registered - event.checkedIn;
  const forfeit = noShows * event.deposit.toNumber();
  const held = event.settled ? 0 : forfeit;
  const rate = event.registered ? Math.round((event.checkedIn / event.registered) * 100) : 0;

  const doCheckIn = async (attendee: PublicKey, source: "scan" | "list") => {
    const name = shortKey(attendee);
    try {
      const sig = await checkIn(program, eventKey, event, attendee);
      if (source === "scan")
        setScanResult({ ok: true, title: "Checked in", body: `${name} got ${formatEur(event.deposit)} back.`, at: Date.now() });
      else toast.push({ kind: "success", title: `${name} checked in`, body: `${formatEur(event.deposit)} refunded.`, sig });
      reload();
      loadTickets();
      refresh();
    } catch (e) {
      const msg = friendlyError(e);
      if (source === "scan") setScanResult({ ok: false, title: "Not checked in", body: msg, at: Date.now() });
      else toast.push({ kind: "error", title: "Check-in failed", body: msg });
    }
  };

  const onScan = async (text: string) => {
    if (processing) return;
    const parsed = parseTicketQr(text);
    if (!parsed) {
      setScanResult({ ok: false, title: "Not a Pfand ticket", body: "This QR code isn't a ticket.", at: Date.now() });
      return;
    }
    if (!parsed.event.equals(eventKey)) {
      setScanResult({ ok: false, title: "Wrong event", body: "This ticket is for a different event.", at: Date.now() });
      return;
    }
    const known = tickets?.find((t) => t.account.attendee.equals(parsed.attendee));
    if (known && isCheckedIn(known.account)) {
      const at = new Date(known.account.checkedInAt.toNumber() * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setScanResult({ ok: false, title: "Already checked in", body: `This guest came in at ${at} and was refunded then.`, at: Date.now() });
      return;
    }
    if (tickets && !known) {
      setScanResult({ ok: false, title: "Not registered", body: "This wallet has no ticket for this event.", at: Date.now() });
      return;
    }
    setProcessing(true);
    await doCheckIn(parsed.attendee, "scan");
    setProcessing(false);
  };

  const doSettle = async () => {
    setSettling(true);
    try {
      const sig = await settle(program, eventKey, event);
      toast.push({
        kind: "success",
        title: "Event settled",
        body: `${formatEur(forfeit)} from ${noShows} ${noShows === 1 ? "no-show" : "no-shows"} sent to the beneficiary.`,
        sig,
      });
      reload();
      refresh();
    } catch (e) {
      toast.push({ kind: "error", title: "Could not settle", body: friendlyError(e) });
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <Link to={`/e/${raw}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> Public event page
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{event.title}</h1>
        <PhaseChip e={event} />
      </div>
      <p className="mt-1 text-ink-2">
        {formatDate(event.startsAt)} · {now < event.endsAt.toNumber() ? "ends" : "ended"} {relative(event.endsAt.toNumber(), now)}
      </p>

      {!isOrganizer && (
        <div className="mt-6 max-w-xl">
          <Notice tone="warn" icon={<WarningCircle size={18} />}>
            {publicKey ? (
              "You're viewing this as a guest. Only the organizer's wallet can check people in or settle."
            ) : (
              <>
                Connect the organizer's wallet to check guests in.{" "}
                <button className="font-medium underline" onClick={openConnectModal}>
                  Connect
                </button>
              </>
            )}
          </Notice>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl border border-line bg-surface p-6 md:grid-cols-4">
        <Stat label="Registered" value={`${event.registered}`} hint={`of ${event.capacity} spots`} />
        <Stat label="Checked in" value={`${event.checkedIn}`} hint={event.registered ? `${rate}% show-up` : "No guests yet"} />
        <Stat label="Deposits held" value={formatEur(held)} hint="Refunded at the door" />
        <Stat
          label={event.settled ? "Went to beneficiary" : "Would go to beneficiary"}
          value={formatEur(forfeit)}
          hint={shortKey(event.beneficiary)}
        />
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_340px]">
        <div>
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit" role="tablist">
            <TabBtn active={tab === "scan"} onClick={() => setTab("scan")} icon={<Scan size={16} />}>
              Scan
            </TabBtn>
            <TabBtn active={tab === "guests"} onClick={() => setTab("guests")} icon={<ListChecks size={16} />}>
              Guests {tickets ? `(${tickets.length})` : ""}
            </TabBtn>
            <TabBtn active={tab === "share"} onClick={() => setTab("share")} icon={<ShareNetwork size={16} />}>
              Share
            </TabBtn>
          </div>

          <div className="mt-6">
            {tab === "scan" && (
              <div className="grid gap-6 sm:grid-cols-[minmax(0,360px)_1fr]">
                {isOrganizer && !event.settled ? (
                  <Scanner onResult={onScan} paused={processing} />
                ) : (
                  <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
                    {event.settled ? "This event is settled. Check-in is closed." : "Scanning needs the organizer's wallet."}
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  {processing && (
                    <Card className="p-5">
                      <p className="animate-pulse font-medium">Refunding deposit…</p>
                    </Card>
                  )}
                  {!processing && scanResult && !event.settled && (
                    <div
                      key={scanResult.at}
                      className={`pop rounded-2xl p-5 ${scanResult.ok ? "bg-accent text-accent-ink" : "bg-warn-soft text-warn"}`}
                    >
                      {scanResult.ok ? <CheckCircle size={36} weight="fill" /> : <WarningCircle size={36} weight="fill" />}
                      <p className="mt-2 text-xl font-semibold tracking-tight">{scanResult.title}</p>
                      <p className="mt-1 text-sm opacity-90">{scanResult.body}</p>
                    </div>
                  )}
                  {!processing && !scanResult && (
                    <p className="text-sm leading-relaxed text-ink-2">
                      Point the camera at a guest's ticket. Each scan checks them in and sends their deposit back
                      instantly. Scanning the same ticket twice does nothing.
                    </p>
                  )}
                </div>
              </div>
            )}

            {tab === "guests" && (
              <GuestList
                tickets={tickets}
                event={event}
                canCheckIn={isOrganizer && !event.settled}
                busyRow={busyRow}
                onCheckIn={async (a) => {
                  setBusyRow(a.toBase58());
                  await doCheckIn(a, "list");
                  setBusyRow(null);
                }}
              />
            )}

            {tab === "share" && (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <QrCode value={eventUrl} size={200} label="Event sign-up link" />
                <div className="flex min-w-0 flex-col gap-3">
                  <p className="leading-relaxed text-ink-2">
                    Put this code on the poster or the slide. Guests scan it, register and get their ticket.
                  </p>
                  <p className="break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">{eventUrl}</p>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(eventUrl);
                        toast.push({ kind: "success", title: "Link copied" });
                      }}
                    >
                      <Copy size={14} /> Copy link
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <HandCoins size={20} className="text-accent" />
              <h2 className="font-semibold tracking-tight">Settle no-shows</h2>
            </div>
            {event.settled ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Done. Unclaimed deposits went to {shortKey(event.beneficiary)}. {event.checkedIn} of {event.registered} guests
                came.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">
                  After the event ends, the {noShows} {noShows === 1 ? "deposit" : "deposits"} still held ({formatEur(held)}) go to{" "}
                  {shortKey(event.beneficiary)}. Until then, late arrivals can still check in.
                </p>
                <Button
                  className="mt-4 w-full"
                  disabled={!isOrganizer || phase !== "ended"}
                  loading={settling}
                  onClick={doSettle}
                >
                  {phase === "ended" ? `Settle ${formatEur(held)}` : `Available ${relative(event.endsAt.toNumber(), now)}`}
                </Button>
              </>
            )}
          </Card>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
            <QrIcon size={14} /> Event account {shortKey(eventKey)}
          </p>
        </aside>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
        active ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function GuestList({
  tickets,
  event,
  canCheckIn,
  busyRow,
  onCheckIn,
}: {
  tickets: TicketWithKey[] | null;
  event: EventAccount;
  canCheckIn: boolean;
  busyRow: string | null;
  onCheckIn: (attendee: PublicKey) => void;
}) {
  if (tickets === null)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  if (tickets.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="font-medium">No guests yet</p>
        <p className="mt-1 text-sm text-ink-3">Share the event link. Registrations show up here within seconds.</p>
      </div>
    );
  return (
    <ul className="flex flex-col gap-2">
      {tickets.map((t) => {
        const k = t.account.attendee.toBase58();
        const done = isCheckedIn(t.account);
        return (
          <li key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm">{shortKey(k)}</p>
              <p className="text-xs text-ink-3">
                {done
                  ? `Checked in ${new Date(t.account.checkedInAt.toNumber() * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : `Registered ${formatDate(t.account.registeredAt)}`}
              </p>
            </div>
            {done ? (
              <Chip tone="accent">
                <CheckCircle size={12} weight="fill" /> Refunded
              </Chip>
            ) : event.settled ? (
              <Chip>No-show</Chip>
            ) : canCheckIn ? (
              <Button size="sm" variant="secondary" loading={busyRow === k} onClick={() => onCheckIn(t.account.attendee)}>
                Check in
              </Button>
            ) : (
              <Chip tone="warn">{formatEur(event.deposit)} held</Chip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
