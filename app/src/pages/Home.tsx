import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight, CalendarPlus, HandCoins, QrCode as QrIcon, UsersThree } from "@phosphor-icons/react";
import { PublicKey } from "@solana/web3.js";
import { Button, Chip, Skeleton } from "../components/ui";
import { TicketCard } from "../components/TicketCard";
import { useAccount } from "../components/account";
import {
  eventPhase,
  fetchAttendeeTickets,
  fetchOrganizerEvents,
  formatDate,
  formatEur,
  isCheckedIn,
  type EventAccount,
  type EventWithKey,
  type TicketWithKey,
} from "../lib/pfand";

const steps = [
  {
    icon: <HandCoins size={22} />,
    title: "Sign up with a €5 deposit",
    body: "Guests lock a small stablecoin deposit in the event's vault. Can't make it? Cancel before the deadline and it comes straight back.",
  },
  {
    icon: <QrIcon size={22} />,
    title: "Scan at the door, money back",
    body: "The organizer scans the guest's QR ticket. The deposit returns to the guest in the same second. No forms, no bank transfer.",
  },
  {
    icon: <UsersThree size={22} />,
    title: "No-shows fund the club",
    body: "After the event, unclaimed deposits go to the wallet chosen upfront: the club treasury or a charity. The rules live on-chain.",
  },
];

export default function Home() {
  const { publicKey } = useWallet();
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <div className="rise">
          <h1 className="max-w-[16ch] text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
            Free events. People actually show up.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">
            Guests lock a €5 deposit when they sign up and get it back the moment they check in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/new">
              <Button size="lg">
                <CalendarPlus size={18} weight="bold" /> Create an event
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </a>
          </div>
        </div>
        <div className="rise-2 flex justify-center md:justify-end">
          <div className="rotate-[2deg]">
            <TicketCard
              title="Goethe AI Talk: Agents in Practice"
              when="Sample ticket · 18:30 · Campus Westend"
              deposit="€5.00"
              qrValue="pfand1:preview"
            />
          </div>
        </div>
      </section>

      {publicKey && <Dashboard owner={publicKey} />}

      <section id="how" className="border-t border-line/70 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="max-w-[18ch] text-3xl font-semibold tracking-tight md:text-4xl">
              Germany already solved this for bottles.
            </h2>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-ink-2">
              Free sign-ups cost nothing, so many of them never turn up. Rooms, catering and sponsor promises get planned
              for people who stay home. A small deposit changes the habit, and nobody who shows up pays a cent.
            </p>
          </div>
          <ol className="flex flex-col gap-8">
            {steps.map((s) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  {s.icon}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 max-w-[52ch] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <Why title="Why a blockchain?" body="A card payment for €5 costs fees, takes days to refund and can be charged back. On Solana the refund is instant and costs a fraction of a cent." />
          <Why title="Who holds the money?" body="Nobody. Deposits sit in a vault owned by the event's program account. Not even the organizer can take them early." />
          <Why title="What do guests need?" body="A wallet with a few euros of stablecoin. For this demo, a browser wallet and free test euros are one click away." />
        </div>
      </section>
    </>
  );
}

function Why({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t-2 border-accent pt-4">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function Dashboard({ owner }: { owner: PublicKey }) {
  const { program } = useAccount();
  const [events, setEvents] = useState<EventWithKey[] | null>(null);
  const [tickets, setTickets] = useState<(TicketWithKey & { event?: EventAccount | null })[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ev, tk] = await Promise.all([
        fetchOrganizerEvents(program, owner).catch(() => []),
        fetchAttendeeTickets(program, owner).catch(() => []),
      ]);
      const evAccounts = await program.account.event
        .fetchMultiple(tk.map((t) => t.account.event))
        .catch(() => tk.map(() => null));
      if (!alive) return;
      setEvents(ev);
      setTickets(tk.map((t, i) => ({ ...t, event: evAccounts[i] as EventAccount | null })));
    })();
    return () => {
      alive = false;
    };
  }, [program, owner]);

  const loading = events === null || tickets === null;
  if (!loading && events!.length === 0 && tickets!.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your tickets</h2>
          <div className="mt-4 flex flex-col gap-2">
            {loading && <Skeleton className="h-16" />}
            {!loading && tickets!.length === 0 && <p className="text-sm text-ink-3">No tickets yet.</p>}
            {tickets?.map((t) => (
              <Row
                key={t.publicKey.toBase58()}
                to={`/e/${t.account.event.toBase58()}`}
                title={t.event?.title ?? "Event"}
                sub={t.event ? formatDate(t.event.startsAt) : ""}
                chip={
                  isCheckedIn(t.account) ? (
                    <Chip tone="accent">Refunded</Chip>
                  ) : t.event?.settled ? (
                    <Chip>Missed</Chip>
                  ) : (
                    <Chip tone="warn">{t.event ? formatEur(t.event.deposit) : ""} held</Chip>
                  )
                }
              />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Events you organize</h2>
          <div className="mt-4 flex flex-col gap-2">
            {loading && <Skeleton className="h-16" />}
            {!loading && events!.length === 0 && (
              <p className="text-sm text-ink-3">
                None yet. <Link to="/new" className="text-accent hover:underline">Create one</Link>.
              </p>
            )}
            {events?.map((e) => (
              <Row
                key={e.publicKey.toBase58()}
                to={`/e/${e.publicKey.toBase58()}/manage`}
                title={e.account.title}
                sub={`${formatDate(e.account.startsAt)} · ${e.account.checkedIn}/${e.account.registered} checked in`}
                chip={<PhaseChip e={e.account} />}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PhaseChip({ e }: { e: EventAccount }) {
  const p = eventPhase(e);
  if (p === "settled") return <Chip>Settled</Chip>;
  if (p === "ended") return <Chip tone="warn">Ready to settle</Chip>;
  if (p === "live") return <Chip tone="accent">Live now</Chip>;
  return <Chip>Upcoming</Chip>;
}

function Row({ to, title, sub, chip }: { to: string; title: string; sub: string; chip: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-accent"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-ink-3">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {chip}
        <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
