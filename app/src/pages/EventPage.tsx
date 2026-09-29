import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicKey } from "@solana/web3.js";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { CalendarBlank, CheckCircle, Clock, Coins, Drop, Gear, HandHeart, LockSimple, Users } from "@phosphor-icons/react";
import { Button, Card, Chip, Field, Notice, Skeleton, inputClass } from "../components/ui";
import { TicketCard } from "../components/TicketCard";
import { useAccount } from "../components/account";
import { useToast } from "../components/toast";
import { openConnectModal } from "../components/WalletMenu";
import { PhaseChip } from "./Home";
import NotFound from "./NotFound";
import {
  cancelRegistration,
  eventPhase,
  faucet,
  formatDate,
  formatEur,
  friendlyError,
  isCheckedIn,
  register,
  shortKey,
  ticketPda,
  ticketQrPayload,
  type EventAccount,
  type TicketAccount,
} from "../lib/pfand";
import { parseKey, relative, useEvent, useNow, usePoll } from "../lib/useEventData";
import { contactFits, encryptContact, isEmail, recallMe, recallTicketName, rememberMe, type Contact } from "../lib/contact";

export default function EventPage() {
  const { eventKey: raw } = useParams();
  const eventKey = useMemo(() => parseKey(raw), [raw]);
  const { event, reload } = useEvent(eventKey, 6000);
  const { publicKey } = useWallet();
  const { program, refresh } = useAccount();
  const [ticket, setTicket] = useState<TicketAccount | null | undefined>(undefined);
  const now = useNow(1000);

  const loadTicket = useCallback(async () => {
    if (!eventKey || !publicKey) return setTicket(null);
    const t = await program.account.ticket.fetchNullable(ticketPda(eventKey, publicKey)).catch(() => null);
    setTicket(t);
  }, [program, eventKey, publicKey]);

  usePoll(loadTicket, 6000);

  // When the door scans us, update the balance pill right away.
  const checkedIn = !!ticket && isCheckedIn(ticket);
  useEffect(() => {
    if (checkedIn) refresh();
  }, [checkedIn, refresh]);

  if (!eventKey || event === null) return <NotFound />;
  if (event === undefined)
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-6 h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const spotsLeft = event.capacity - event.registered;
  const isOrganizer = publicKey?.equals(event.organizer);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_380px] md:py-14">
      <div className="rise">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseChip e={event} />
          {isOrganizer && (
            <Link to={`/e/${eventKey.toBase58()}/manage`}>
              <Chip tone="accent">
                <Gear size={12} weight="bold" /> Organizer view
              </Chip>
            </Link>
          )}
        </div>
        <h1 className="mt-4 max-w-[22ch] text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{event.title}</h1>

        <dl className="mt-8 grid max-w-xl gap-5 sm:grid-cols-2">
          <Info icon={<CalendarBlank size={20} />} label="When" value={formatDate(event.startsAt)} />
          <Info
            icon={<Coins size={20} />}
            label="Deposit"
            value={`${formatEur(event.deposit)}, refunded at check-in`}
          />
          <Info
            icon={<Users size={20} />}
            label="Spots"
            value={spotsLeft > 0 ? `${spotsLeft} of ${event.capacity} left` : "Full"}
          />
          <Info
            icon={<Clock size={20} />}
            label="Free cancellation"
            value={
              now <= event.cancelUntil.toNumber()
                ? `Until ${formatDate(event.cancelUntil)}`
                : "Closed"
            }
          />
        </dl>

        <div className="mt-10 max-w-xl">
          <Notice icon={<HandHeart size={18} />}>
            If you don't show up, your deposit goes to{" "}
            {event.beneficiary.equals(event.organizer) ? "the organizing club" : shortKey(event.beneficiary)}. Show up
            and you pay nothing. Cancel in time and you pay nothing.
          </Notice>
        </div>
      </div>

      <div className="rise-2">
        <ActionPanel
          eventKey={eventKey.toBase58()}
          event={event}
          ticket={ticket}
          now={now}
          onChange={() => {
            reload();
            loadTicket();
          }}
        />
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-accent">{icon}</span>
      <div>
        <dt className="text-sm text-ink-3">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

function ActionPanel({
  eventKey,
  event,
  ticket,
  now,
  onChange,
}: {
  eventKey: string;
  event: EventAccount;
  ticket: TicketAccount | null | undefined;
  now: number;
  onChange: () => void;
}) {
  const { publicKey } = useWallet();
  const { program, eur, sol, refresh } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const phase = eventPhase(event, now);
  const key = parseKey(eventKey)!;

  const run = async (name: string, fn: () => Promise<string>, success: { title: string; body?: string }) => {
    setBusy(name);
    try {
      const sig = await fn();
      toast.push({ kind: "success", ...success, sig });
      onChange();
      refresh();
    } catch (e) {
      toast.push({ kind: "error", title: "That didn't work", body: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  if (!publicKey)
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">Save your spot</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Connect a wallet to register. No app? Pick the demo wallet, it works right in your browser.
        </p>
        <Button className="mt-5 w-full" size="lg" onClick={openConnectModal}>
          Connect to register
        </Button>
      </Card>
    );

  if (ticket === undefined) return <Skeleton className="h-80" />;

  // Checked in: the happy ending.
  if (ticket && isCheckedIn(ticket))
    return (
      <Card className="pop p-6">
        <CheckCircle size={44} weight="fill" className="text-accent" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">You're in.</h2>
        <p className="mt-2 leading-relaxed text-ink-2">
          {formatEur(event.deposit)} is back in your wallet. Checked in at{" "}
          {new Date(ticket.checkedInAt.toNumber() * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      </Card>
    );

  // Registered, waiting for the door.
  if (ticket) {
    if (event.settled)
      return (
        <Card className="p-6">
          <h2 className="text-xl font-semibold tracking-tight">You missed this one</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Your {formatEur(event.deposit)} deposit went to the event's beneficiary after it ended.
          </p>
        </Card>
      );
    const canCancel = now <= event.cancelUntil.toNumber();
    return (
      <div className="flex flex-col items-center gap-4 md:items-stretch">
        <TicketCard
          title={event.title}
          holder={recallTicketName(key) ?? undefined}
          when={formatDate(event.startsAt)}
          deposit={formatEur(event.deposit)}
          qrValue={ticketQrPayload(key, publicKey)}
          footer={
            <p className="text-sm leading-relaxed text-ink-2">
              Show this code at the door. Your deposit comes back the moment it's scanned.
            </p>
          }
        />
        {canCancel ? (
          <Button
            variant="danger"
            className="w-full max-w-[340px]"
            loading={busy === "cancel"}
            onClick={() =>
              run("cancel", () => cancelRegistration(program, key, event, publicKey), {
                title: "Registration cancelled",
                body: `${formatEur(event.deposit)} refunded.`,
              })
            }
          >
            Can't make it? Cancel ({relative(event.cancelUntil.toNumber(), now).replace(/^in /, "")} left)
          </Button>
        ) : (
          <p className="max-w-[340px] text-center text-xs text-ink-3">
            Free cancellation closed {formatDate(event.cancelUntil)}.
          </p>
        )}
      </div>
    );
  }

  // Not registered.
  if (phase === "live" || phase === "ended" || phase === "settled")
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">Registration closed</h2>
        <p className="mt-2 text-sm text-ink-2">Sign-ups close when the event starts.</p>
      </Card>
    );

  const full = event.registered >= event.capacity;
  const needsSol = sol !== null && sol < 0.004;

  return (
    <RegisterForm
      event={event}
      eventKey={key}
      full={full}
      needsSol={needsSol}
      busy={busy === "register"}
      onSubmit={async (contact) => {
        setBusy("register");
        try {
          // Devnet convenience: mint test euros automatically if the wallet has too few.
          if (eur !== null && eur < event.deposit.toNumber()) await faucet(program, publicKey);
          const sig = await register(program, key, event, publicKey, encryptContact(contact, Uint8Array.from(event.guestKey)));
          rememberMe(contact, key);
          toast.push({
            kind: "success",
            title: "You're registered",
            body: `${formatEur(event.deposit)} is held until you check in.`,
            sig,
          });
          onChange();
          refresh();
        } catch (e) {
          toast.push({ kind: "error", title: "That didn't work", body: friendlyError(e) });
        } finally {
          setBusy(null);
        }
      }}
    />
  );
}

function RegisterForm({
  event,
  eventKey,
  full,
  needsSol,
  busy,
  onSubmit,
}: {
  event: EventAccount;
  eventKey: PublicKey;
  full: boolean;
  needsSol: boolean;
  busy: boolean;
  onSubmit: (c: Contact) => void;
}) {
  const saved = useMemo(() => recallMe(), []);
  const [name, setName] = useState(saved?.name ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (name.trim().length < 2) errs.name = "Enter your name.";
    if (!isEmail(email)) errs.email = "Enter a valid email address.";
    if (!errs.name && !errs.email && !contactFits({ name, email })) errs.email = "Name and email are too long.";
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit({ name, email });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold tracking-tight">Save your spot</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        A <span className="font-medium text-ink">{formatEur(event.deposit)}</span> deposit is locked when you register.
        You get it back at check-in, or if you cancel in time.
      </p>
      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4" aria-describedby={`privacy-${eventKey.toBase58()}`}>
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={100}
          />
        </Field>
        <p id={`privacy-${eventKey.toBase58()}`} className="flex items-start gap-2 text-xs leading-relaxed text-ink-3">
          <LockSimple size={14} className="mt-0.5 shrink-0" />
          Encrypted before it's saved. Only the organizer can read your name and email.
        </p>
        {needsSol && (
          <Notice tone="warn" icon={<Drop size={18} />}>
            Your wallet needs a little test SOL for network fees. Open the wallet menu (top right) and choose "Get test SOL".
          </Notice>
        )}
        <Button type="submit" className="mt-1 w-full" size="lg" disabled={full || needsSol} loading={busy}>
          {full ? "Event is full" : `Register with ${formatEur(event.deposit)} deposit`}
        </Button>
      </form>
    </Card>
  );
}
