/**
 * signal-utils.ts
 *
 * Helpers para integrar Observables con Angular Signals (Angular 18+).
 *
 * IMPORTAR así en un componente standalone:
 *   import { querySignal, asyncSignal, paginatedSignal } from '@shared/utils/signal-utils';
 *
 * PRECONDICIÓN: el componente debe estar dentro de un `EnvironmentInjector` (cualquier
 * componente Angular normal lo cumple). Todas las funciones usan `toSignal()` de
 * `@angular/core/rxjs-interop` internamente.
 */

import {
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import {
  Observable,
  Subject,
  BehaviorSubject,
  switchMap,
  startWith,
  catchError,
  of,
  distinctUntilChanged,
  debounceTime,
} from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface PaginatedState<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  page: number;
}

// ── querySignal ───────────────────────────────────────────────────────────────

/**
 * Convierte un Observable a Signal con estado de carga y error.
 *
 * @example
 * ```typescript
 * const providers = querySignal(
 *   () => this.providerService.getNearby(lat, lng),
 *   [] // valor inicial
 * );
 * // En el template:
 * // @if (providers().loading) { <ion-spinner /> }
 * // @for (p of providers().data ?? []; track p.id) { ... }
 * ```
 */
export function querySignal<T>(
  factory: () => Observable<T>,
  initialValue: T | null = null
): Signal<AsyncState<T>> {
  const trigger$ = new BehaviorSubject<void>(undefined);
  const destroyRef = inject(DestroyRef);

  const result$ = trigger$.pipe(
    switchMap(() =>
      factory().pipe(
        startWith(null),
        catchError((err) =>
          of({ __error: err instanceof Error ? err.message : String(err) })
        )
      )
    )
  );

  const raw = toSignal(result$, { initialValue: null });

  const state = computed((): AsyncState<T> => {
    const val = raw();
    if (val === null) return { data: initialValue, loading: true, error: null };
    if (val && typeof val === 'object' && '__error' in (val as object)) {
      return {
        data: initialValue,
        loading: false,
        error: (val as { __error: string }).__error,
      };
    }
    return { data: val as T, loading: false, error: null };
  });

  /** Refresca manualmente los datos */
  (state as Signal<AsyncState<T>> & { refresh: () => void }).refresh = () =>
    trigger$.next();

  return state;
}

// ── asyncSignal ───────────────────────────────────────────────────────────────

/**
 * Wrapper minimalista: Observable → Signal con initialValue.
 * Equivalente a `toSignal(obs, { initialValue })` con tipo explícito.
 *
 * @example
 * ```typescript
 * readonly categories = asyncSignal(this.categoryService.getAll(), []);
 * ```
 */
export function asyncSignal<T>(
  obs$: Observable<T>,
  initialValue: T
): Signal<T> {
  return toSignal(obs$, { initialValue });
}

// ── searchSignal ──────────────────────────────────────────────────────────────

/**
 * Crea un Signal reactivo ligado a una búsqueda con debounce.
 * Útil para inputs de búsqueda que disparan llamadas al backend.
 *
 * @example
 * ```typescript
 * const { results, query, setQuery } = searchSignal(
 *   (q) => this.providerService.search(q),
 *   300 // debounce ms
 * );
 * // En el template: (ionInput)="setQuery($event.detail.value)"
 * // @for (r of results().data ?? []; track r.id) { ... }
 * ```
 */
export function searchSignal<T>(
  searchFn: (query: string) => Observable<T[]>,
  debounceMs = 300
): {
  results: Signal<AsyncState<T[]>>;
  query: Signal<string>;
  setQuery: (q: string) => void;
} {
  const query$ = new BehaviorSubject<string>('');
  const querySignalVal = toSignal(query$.pipe(distinctUntilChanged()), {
    initialValue: '',
  });

  const results$ = query$.pipe(
    debounceTime(debounceMs),
    distinctUntilChanged(),
    switchMap((q) =>
      searchFn(q).pipe(
        startWith(null),
        catchError((err) =>
          of({ __error: err instanceof Error ? err.message : String(err) })
        )
      )
    )
  );

  const raw = toSignal(results$, { initialValue: null });

  const results = computed((): AsyncState<T[]> => {
    const val = raw();
    if (val === null) return { data: null, loading: true, error: null };
    if (val && typeof val === 'object' && '__error' in (val as object)) {
      return {
        data: null,
        loading: false,
        error: (val as { __error: string }).__error,
      };
    }
    return { data: val as T[], loading: false, error: null };
  });

  return {
    results,
    query: querySignalVal,
    setQuery: (q: string) => query$.next(q ?? ''),
  };
}

// ── fromEvent$ → Signal ───────────────────────────────────────────────────────

/**
 * Convierte cualquier Subject/Observable de eventos en un Signal del último evento.
 * Útil para consumir streams de WebSocket como signals.
 *
 * @example
 * ```typescript
 * // En el servicio WS:
 * readonly lastMessage = eventSignal(this.wsService.messages$, null);
 * // En el template:
 * // {{ lastMessage()?.content }}
 * ```
 */
export function eventSignal<T>(
  source$: Observable<T>,
  initialValue: T
): Signal<T> {
  return toSignal(source$, { initialValue });
}

// ── Helpers de estado local ───────────────────────────────────────────────────

/**
 * Crea un signal de estado mutable con helpers tipados.
 * Reemplaza el patrón `isLoading = false; error = null` con un signal único.
 *
 * @example
 * ```typescript
 * const state = createAsyncState<Provider[]>([]);
 * state.setLoading();
 * try {
 *   const data = await firstValueFrom(this.providerService.get());
 *   state.setData(data);
 * } catch (e) {
 *   state.setError(String(e));
 * }
 * // Template: @if (state.sig().loading) { ... }
 * ```
 */
export function createAsyncState<T>(initialData: T): {
  sig: WritableSignal<AsyncState<T>>;
  setLoading: () => void;
  setData: (data: T) => void;
  setError: (error: string) => void;
  reset: () => void;
} {
  const sig = signal<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  return {
    sig,
    setLoading: () => sig.update((s) => ({ ...s, loading: true, error: null })),
    setData: (data: T) => sig.set({ data, loading: false, error: null }),
    setError: (error: string) =>
      sig.update((s) => ({ ...s, loading: false, error })),
    reset: () => sig.set({ data: initialData, loading: false, error: null }),
  };
}
