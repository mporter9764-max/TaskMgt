type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function toast(msg: string): void {
  listeners.forEach((l) => l(msg));
}

export function onToast(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Report a Supabase error (if any) to the user. Returns true when there was an error. */
export function reportError(err: { message: string } | null | undefined, what: string): boolean {
  if (!err) return false;
  toast(`Couldn't ${what}: ${err.message}`);
  return true;
}
