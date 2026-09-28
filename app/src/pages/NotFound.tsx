import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Nothing here</h1>
      <p className="text-ink-2">This link doesn't point to an event. Check it with the organizer.</p>
      <Link to="/">
        <Button variant="secondary">Back to start</Button>
      </Link>
    </div>
  );
}
