// Acceso a Claude desde la página publicada (capacidad `sample`). Fuera del
// visor de claude.ai no existe y el juego usa respuestas de guion.

type SampleFn = (input: string | { role: 'user' | 'assistant'; content: string }[], options?: Record<string, unknown>) => Promise<{ text: string }>;

let samplePromise: Promise<SampleFn | null> | null = null;
let disabled = false;

export function getSample(): Promise<SampleFn | null> {
  if (disabled) return Promise.resolve(null);
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  samplePromise ??= claude.use('sample').then((s) => (s as SampleFn) ?? null).catch(() => null);
  return samplePromise;
}

// si el jugador no da permiso o la cuenta no puede, dejamos de intentarlo
export function disableAi() {
  disabled = true;
}
