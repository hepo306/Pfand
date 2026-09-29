import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Lightning } from "@phosphor-icons/react";
import { Button, Card, Field, Notice, inputClass } from "../components/ui";
import { useAccount } from "../components/account";
import { useToast } from "../components/toast";
import { openConnectModal } from "../components/WalletMenu";
import { createEvent, eventPda, friendlyError, randomEventId } from "../lib/pfand";
import { deriveGuestKeypair, guestKeyMessage, rememberGuestSecret } from "../lib/contact";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

const CANCEL_OPTIONS = [
  { label: "Up to 1 hour before", minutes: 60 },
  { label: "Up to 3 hours before", minutes: 180 },
  { label: "Up to 24 hours before", minutes: 1440 },
];

export default function CreateEvent() {
  const { publicKey, signMessage } = useWallet();
  const { program, sol } = useAccount();
  const toast = useToast();
  const navigate = useNavigate();

  const defaultStart = useMemo(() => {
    const d = inMinutes(60 * 24 * 3);
    d.setHours(18, 30, 0, 0);
    return d;
  }, []);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(toLocalInput(defaultStart));
  const [durationMin, setDurationMin] = useState(120);
  const [cancelMin, setCancelMin] = useState(180);
  const [deposit, setDeposit] = useState("5");
  const [capacity, setCapacity] = useState("80");
  const [beneficiary, setBeneficiary] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applyDemoPreset = () => {
    setTitle((t) => t || "Pfand live demo");
    setStart(toLocalInput(inMinutes(10)));
    setDurationMin(5);
    setCancelMin(5);
    setDemoMode(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!publicKey) return openConnectModal();

    const errs: Record<string, string> = {};
    const startsAt = new Date(start);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const cancelUntil = new Date(startsAt.getTime() - cancelMin * 60_000);
    const dep = Number(deposit.replace(",", "."));
    const cap = Number(capacity);
    let benef: PublicKey = publicKey;

    if (!title.trim()) errs.title = "Give the event a name.";
    else if (new TextEncoder().encode(title.trim()).length > 64) errs.title = "Keep it under 64 characters.";
    if (isNaN(startsAt.getTime())) errs.start = "Pick a start time.";
    else if (cancelUntil.getTime() <= Date.now()) errs.start = "The cancellation deadline would already be in the past. Pick a later start.";
    if (!(dep > 0) || dep > 100) errs.deposit = "Between €0.50 and €100.";
    if (!Number.isInteger(cap) || cap < 1 || cap > 100000) errs.capacity = "A whole number, at least 1.";
    if (beneficiary.trim()) {
      try {
        benef = new PublicKey(beneficiary.trim());
      } catch {
        errs.beneficiary = "That isn't a valid Solana address.";
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (!signMessage) {
      toast.push({ kind: "error", title: "This wallet can't sign messages", body: "Use Phantom, Solflare or the demo wallet." });
      return;
    }
    setBusy(true);
    try {
      // 1. Derive the key guests encrypt their name and email to.
      const eventId = randomEventId();
      const eventKey = eventPda(publicKey, eventId);
      const guestKeys = deriveGuestKeypair(await signMessage(guestKeyMessage(eventKey)));
      rememberGuestSecret(eventKey, guestKeys.secretKey);
      // 2. Create the event on-chain.
      const { sig, event } = await createEvent(
        program,
        publicKey,
        {
          title: title.trim(),
          depositEur: dep,
          capacity: cap,
          startsAt,
          endsAt,
          cancelUntil,
          beneficiary: benef,
        },
        eventId,
        guestKeys.publicKey,
      );
      toast.push({ kind: "success", title: "Event created", body: "Now share the sign-up link.", sig });
      navigate(`/e/${event.toBase58()}/manage?created=1`);
    } catch (err) {
      toast.push({ kind: "error", title: "Could not create the event", body: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_320px] md:py-14">
      <div className="rise">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">New event</h1>
        <p className="mt-2 max-w-[56ch] text-ink-2">
          Set the deposit and the rules once. After that, the program handles every refund.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-6" noValidate>
          <Field label="Event name" error={errors.title}>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Founders Bootcamp: Pitch Night"
              maxLength={64}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Starts" error={errors.start}>
              <input
                type="datetime-local"
                className={inputClass}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setDemoMode(false);
                }}
              />
            </Field>
            <Field label="Duration">
              <select className={inputClass} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
                {demoMode && <option value={5}>5 minutes (demo)</option>}
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={300}>5 hours</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Deposit per guest (€)" error={errors.deposit} hint="Refunded in full at check-in.">
              <input
                inputMode="decimal"
                className={`${inputClass} tabular`}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
              />
            </Field>
            <Field label="Spots" error={errors.capacity}>
              <input
                inputMode="numeric"
                className={`${inputClass} tabular`}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Free cancellation" hint="Guests who cancel in time get their deposit back and free the spot.">
            <select className={inputClass} value={cancelMin} onChange={(e) => setCancelMin(Number(e.target.value))}>
              {demoMode && <option value={5}>Up to 5 minutes before (demo)</option>}
              {CANCEL_OPTIONS.map((o) => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="No-show deposits go to"
            error={errors.beneficiary}
            hint="Leave empty to use your own wallet (the club treasury). Or paste a charity's Solana address."
          >
            <input
              className={`${inputClass} font-mono text-sm`}
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder={publicKey?.toBase58() ?? "Your wallet"}
            />
          </Field>

          {publicKey && sol !== null && sol < 0.006 && (
            <Notice tone="warn">
              Your wallet needs a little test SOL to pay the network fee. Open the wallet menu and choose "Get test SOL".
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" size="lg" loading={busy}>
              {publicKey ? "Create event" : "Connect to create"}
            </Button>
            <Button type="button" variant="ghost" onClick={applyDemoPreset}>
              <Lightning size={16} /> Fill a 15-minute demo
            </Button>
          </div>
        </form>
      </div>

      <aside className="rise-2 md:pt-24">
        <Card className="p-5">
          <h2 className="font-semibold tracking-tight">What happens next</h2>
          <ol className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-ink-2">
            <li>
              <span className="font-medium text-ink">A vault is created</span> for this event. Only the program can move
              money out of it.
            </li>
            <li>
              <span className="font-medium text-ink">You share the link</span>, or print its QR code on the poster.
              Guests sign up with name and email, encrypted so only you can read them.
            </li>
            <li>
              <span className="font-medium text-ink">At the door</span> you scan tickets on your phone. Each scan refunds
              one guest.
            </li>
            <li>
              <span className="font-medium text-ink">After the end time</span> you settle: what's left goes to the address
              you chose.
            </li>
          </ol>
        </Card>
      </aside>
    </div>
  );
}
