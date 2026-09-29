import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import QRCodeLib from "qrcode";
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  DownloadSimple,
  HandCoins,
  ListChecks,
  LockSimpleOpen,
  QrCode as QrIcon,
  Scan,
  WarningCircle,
  X,
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
import { parseKey, relative, useEvent, useNow, usePoll } from "../lib/useEventData";
import {
  decryptContact,
  deriveGuestKeypair,
  guestKeyMessage,
  recallGuestSecret,
  rememberGuestSecret,
  type Contact,
} from "../lib/contact";

type Tab = "scan" | "guests";
type ScanResult = { ok: boolean; title: string; body: string; at: number };

const timeOf = (secs: number) =>
  new Date(secs * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Decrypts guests' names and emails with a key only the organizer's wallet can derive. */
function useGuestNames(eventKey: PublicKey | null, event: EventAccount | null | undefined, tickets: TicketWithKey[] | null) {
  const { signMessage } = useWallet();
  const [secret, setSecret] = useState<Uint8Array | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (eventKey) setSecret(recallGuestSecret(eventKey));
  }, [eventKey]);

  const unlock = useCallback(async () => {
    if (!eventKey || !event || !signMessage) throw new Error("This wallet can't sign messages.");
    setUnlocking(true);
    try {
      const kp = deriveGuestKeypair(await signMessage(guestKeyMessage(eventKey)));
      const expected = Uint8Array.from(event.guestKey);
      if (!kp.publicKey.every((b, i) => b === expected[i])) throw new Error("Only the wallet that created this event can read guest names.");
      rememberGuestSecret(eventKey, kp.secretKey);
      setSecret(kp.secretKey);
    } finally {
      setUnlocking(false);
    }
  }, [eventKey, event, signMessage]);

  const names = useMemo(() => {
    const m = new Map<string, Contact>();
    if (!secret || !tickets) return m;
    for (const t of tickets) {
      const c = decryptContact(Uint8Array.from(t.account.contact), secret);
      if (c) m.set(t.account.attendee.toBase58(), c);
    }
    return m;
  }, [secret, tickets]);

  return { unlocked: !!secret, unlocking, unlock, names };
}

export default function ManageEvent() {
  const { eventKey: raw } = useParams();
  const eventKey = useMemo(() => parseKey(raw), [raw]);
  const [search, setSearch] = useSearchParams();
  const justCreated = search.get("created") === "1";
  const { event, reload } = useEvent(eventKey, 8000);
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
  const guests = useGuestNames(eventKey, event, tickets);

  const loadTickets = useCallback(async () => {
    if (!eventKey) return;
    const t = await fetchEventTickets(program, eventKey).catch(() => null);
    if (t) setTickets(t.sort((a, b) => a.account.registeredAt.toNumber() - b.account.registeredAt.toNumber()));
  }, [program, eventKey]);

  usePoll(loadTickets, 10000);

  const eventUrl = useMemo(() => `${window.location.origin}${window.location.pathname}#/e/${raw}`, [raw]);

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
  const nameOf = (attendee: PublicKey) => guests.names.get(attendee.toBase58())?.name ?? shortKey(attendee);

  const doCheckIn = async (attendee: PublicKey, source: "scan" | "list") => {
    const name = nameOf(attendee);
    try {
      const sig = await checkIn(program, eventKey, event, attendee);
      if (source === "scan")
        setScanResult({ ok: true, title: `${name} is in`, body: `${formatEur(event.deposit)} refunded.`, at: Date.now() });
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
    // The same ticket lingering in front of the camera right after check-in: keep the green result.
    if (known && isCheckedIn(known.account) && Date.now() / 1000 - known.account.checkedInAt.toNumber() < 60) return;
    if (known && isCheckedIn(known.account)) {
      setScanResult({
        ok: false,
        title: "Already checked in",
        body: `${nameOf(parsed.attendee)} came in at ${timeOf(known.account.checkedInAt.toNumber())} and was refunded then.`,
        at: Date.now(),
      });
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

  const unlockNames = async () => {
    try {
      await guests.unlock();
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't unlock names", body: friendlyError(e) });
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

      {justCreated && !event.settled && (
        <ShareBanner
          url={eventUrl}
          title={event.title}
          onClose={() => {
            search.delete("created");
            setSearch(search, { replace: true });
          }}
        />
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
        <div className="min-w-0">
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit" role="tablist">
            <TabBtn active={tab === "scan"} onClick={() => setTab("scan")} icon={<Scan size={16} />}>
              Scan
            </TabBtn>
            <TabBtn active={tab === "guests"} onClick={() => setTab("guests")} icon={<ListChecks size={16} />}>
              Guests {tickets ? `(${tickets.length})` : ""}
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
                  {isOrganizer && !guests.unlocked && (tickets?.length ?? 0) > 0 && (
                    <button onClick={unlockNames} className="self-start text-sm font-medium text-accent hover:underline">
                      Show guest names when scanning
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === "guests" && (
              <GuestList
                tickets={tickets}
                event={event}
                names={guests.names}
                unlocked={guests.unlocked}
                unlocking={guests.unlocking}
                onUnlock={isOrganizer ? unlockNames : undefined}
                canCheckIn={isOrganizer && !event.settled}
                busyRow={busyRow}
                onCheckIn={async (a) => {
                  setBusyRow(a.toBase58());
                  await doCheckIn(a, "list");
                  setBusyRow(null);
                }}
              />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          {!justCreated && !event.settled && <ShareCard url={eventUrl} title={event.title} />}
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
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <QrIcon size={14} /> Event account {shortKey(eventKey)}
          </p>
        </aside>
      </div>
    </div>
  );
}

// ---------- sharing ----------

function useShareActions(url: string, title: string) {
  const toast = useToast();
  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => toast.push({ kind: "success", title: "Link copied", body: "Paste it into your group chat or event post." }),
      () => toast.push({ kind: "error", title: "Couldn't copy", body: url }),
    );
  };
  const download = async () => {
    const dataUrl = await QRCodeLib.toDataURL(url, { width: 1200, margin: 2, color: { dark: "#141816", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `pfand-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "event"}-qr.png`;
    a.click();
  };
  return { copy, download };
}

function ShareBanner({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const { copy, download } = useShareActions(url, title);
  return (
    <section className="pop relative mt-8 grid gap-8 rounded-2xl bg-accent p-6 text-accent-ink sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
      <button onClick={onClose} className="absolute right-4 top-4 opacity-80 hover:opacity-100" aria-label="Close">
        <X size={20} />
      </button>
      <div className="justify-self-center md:justify-self-start">
        <QrCode value={url} size={200} label="Sign-up link for this event" />
      </div>
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Your event is live. Share it.</h2>
        <p className="mt-2 max-w-[52ch] leading-relaxed opacity-90">
          Send this link to your group chats or print the QR code on the poster. Guests sign up with their name, email and
          the deposit.
        </p>
        <p className="mt-4 break-all rounded-xl bg-[#06140e]/20 px-3 py-2 font-mono text-sm">{url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            <Copy size={14} /> Copy link
          </Button>
          <Button variant="secondary" size="sm" onClick={download}>
            <DownloadSimple size={14} /> Download QR
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm">
              <ArrowSquareOut size={14} /> Open sign-up page
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function ShareCard({ url, title }: { url: string; title: string }) {
  const { copy, download } = useShareActions(url, title);
  return (
    <Card className="p-5">
      <h2 className="font-semibold tracking-tight">Sign-up link</h2>
      <div className="mt-4 flex items-center gap-4">
        <QrCode value={url} size={112} label="Sign-up link for this event" />
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={copy}>
            <Copy size={14} /> Copy link
          </Button>
          <Button size="sm" variant="secondary" onClick={download}>
            <DownloadSimple size={14} /> QR code
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------- guest list ----------

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

function exportCsv(event: EventAccount, tickets: TicketWithKey[], names: Map<string, Contact>) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [["Name", "Email", "Status", "Registered", "Checked in", "Wallet"]];
  for (const t of tickets) {
    const c = names.get(t.account.attendee.toBase58());
    const done = isCheckedIn(t.account);
    rows.push([
      c?.name ?? "",
      c?.email ?? "",
      done ? "Checked in" : event.settled ? "No-show" : "Registered",
      new Date(t.account.registeredAt.toNumber() * 1000).toISOString(),
      done ? new Date(t.account.checkedInAt.toNumber() * 1000).toISOString() : "",
      t.account.attendee.toBase58(),
    ]);
  }
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `guests-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  a.click();
}

function GuestList({
  tickets,
  event,
  names,
  unlocked,
  unlocking,
  onUnlock,
  canCheckIn,
  busyRow,
  onCheckIn,
}: {
  tickets: TicketWithKey[] | null;
  event: EventAccount;
  names: Map<string, Contact>;
  unlocked: boolean;
  unlocking: boolean;
  onUnlock?: () => void;
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
        <p className="mt-1 text-sm text-ink-3">Share the sign-up link. Registrations show up here within seconds.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {onUnlock && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          {unlocked ? (
            <>
              <p className="text-sm text-ink-2">Names and emails are decrypted in this browser only.</p>
              <Button size="sm" variant="secondary" onClick={() => exportCsv(event, tickets, names)}>
                <DownloadSimple size={14} /> Export CSV
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2">Names and emails are encrypted. Only your wallet can unlock them.</p>
              <Button size="sm" onClick={onUnlock} loading={unlocking}>
                <LockSimpleOpen size={14} /> Show names
              </Button>
            </>
          )}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {tickets.map((t) => {
          const k = t.account.attendee.toBase58();
          const c = names.get(k);
          const done = isCheckedIn(t.account);
          return (
            <li key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="min-w-0">
                {c ? (
                  <>
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-ink-3">{c.email}</p>
                  </>
                ) : (
                  <p className="truncate font-mono text-sm">{shortKey(k)}</p>
                )}
                <p className="text-xs text-ink-3">
                  {done ? `Checked in ${timeOf(t.account.checkedInAt.toNumber())}` : `Registered ${formatDate(t.account.registeredAt)}`}
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
    </div>
  );
}
