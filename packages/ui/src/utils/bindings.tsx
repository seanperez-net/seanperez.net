import { useComputed$, useConstant } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";
import { useBoundSignal } from "./use-bound-signal";

/** From e-store's `utils/bindings.tsx`. Props that take both a plain value and a `bind:` signal. */
export type BindableProps<T> = {
  [K in keyof T]?: T[K];
} & {
  [K in keyof T as `bind:${string & K}`]?: Signal<T[K]>;
};

/**
 * Signals returned by useBindings, with a `Sig` suffix.
 *
 * @example
 * If T is { value: string, disabled: boolean }
 * then SignalResults<T> is { valueSig: Signal<string>, disabledSig: Signal<boolean> }
 */
export type SignalResults<T> = {
  [K in keyof T as `${string & K}Sig`]: Signal<T[K]>;
};

/**
 * One signal per property, whichever way the consumer passed it: a plain value or `bind:`.
 *
 * @param props Component props
 * @param initialValues The properties and their defaults
 * @returns Object with a signal for each property (with Sig suffix)
 *
 * @example
 * const { disabledSig, valueSig } = useBindings(props, {
 *   disabled: false,
 *   value: ""
 * });
 *
 * @example
 * <Component value="jim" /> // value={signal.value}, value={store.property}
 * <Component bind:value={mySignal} />
 */
export function useBindings<T extends object>(
  props: BindableProps<T>,
  initialValues: T,
): SignalResults<T> {
  const result = {} as SignalResults<T>;

  for (const key in initialValues) {
    type PropType = T[typeof key];
    type PropSignal = Signal<PropType>;
    type BindSignal = PropSignal | undefined;

    // eslint-disable-next-line qwik/use-method-usage
    const propSig = useComputed$<PropType | undefined>(
      () => props[key] as PropType | undefined,
    );
    const bindKey = `bind:${key}`;
    const resultKey = `${key}Sig` as keyof SignalResults<T>;

    const bindSignal = props[bindKey as keyof typeof props] as BindSignal;
    const initialValue =
      bindSignal?.value ?? propSig.value ?? initialValues[key];

    // eslint-disable-next-line qwik/use-method-usage
    const signal = useBoundSignal(bindSignal, initialValue, propSig);
    result[resultKey] = signal as SignalResults<T>[typeof resultKey];

    // The render-time sync. A parent that RE-RENDERS with a new plain value does re-render this
    // component with it, but e-store found `propSig` did not always see the change (Qwik
    // 2.0.0-rc.4: never when the parent forwards its own prop of the same name, and in the
    // production build not after a user's pick either). So adopt a value prop that differs from
    // the last one seen, here, where it is always current.
    const current = props[key] as PropType | undefined;
    // eslint-disable-next-line qwik/use-method-usage
    const lastSeen = useConstant(() => ({ value: current }));
    if (
      !bindSignal &&
      current !== undefined &&
      !Object.is(current, lastSeen.value)
    ) {
      lastSeen.value = current;
      signal.value = current as PropType;
    }
  }

  return result;
}

/**
 * Removes keys and their `bind:` versions (`value` and `bind:value`) from the given props, so a
 * component does not forward them to a DOM element.
 *
 * @param props The original component props.
 * @param initialValues The same object passed to useBindings.
 * @returns New props without those keys.
 *
 * @example
 * const initialValues = { value: undefined as string | undefined };
 * const { valueSig } = useBindings(props, initialValues);
 * const rest = destructureBindings(props, initialValues);
 * // <div {...rest}/> will not get `value` or `bind:value`
 */
export function destructureBindings<
  T extends object,
  Props extends BindableProps<T>,
>(
  props: Props,
  initialValues: T,
): Omit<
  Props,
  keyof T | keyof { [K in keyof T as `bind:${string & K}`]: unknown }
> {
  const keysToOmit = new Set<string>();

  for (const key in initialValues) {
    keysToOmit.add(key as string);
    keysToOmit.add(`bind:${key as string}`);
  }

  const result = {} as Record<string, unknown>;
  for (const key in props) {
    if (!keysToOmit.has(key)) {
      result[key] = props[key];
    }
  }

  return result as Omit<
    Props,
    keyof T | keyof { [K in keyof T as `bind:${string & K}`]: unknown }
  >;
}
