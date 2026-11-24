import type { JSXOutput } from "@qwik.dev/core";
// The same runtime module as `@qwik.dev/core` (`package.json` exports `./internal` with the core
// bundles and `core-internal.d.ts`): what the optimizer's compiled JSX already calls.
import { _isJSXNode, _isStore, _jsxSorted } from "@qwik.dev/core/internal";
import type { JSXNodeInternal } from "@qwik.dev/core/internal";

/**
 * A fresh copy of a JSX value passed as a PROP (`end`, `start`, `trailing`, ...), for rendering.
 * From e-store's `utils/jsx-prop.ts`.
 *
 * **Why (Qwik core, still so in 2.0.0-rc.5: `core.mjs` `applyQwikComponentBody`,
 * `executeComponent` and the props proxy's `deleteProperty`).** Rendering a `component$` JSX
 * node mutates that node: both run `delete props.children` on `jsx.props`, and the props proxy's
 * delete trap sets `jsx.children = null`. When the node was passed down as a prop, the same
 * object is also a value in the parent's props, so it is serialized (and later re-read) WITHOUT
 * its children. The first time the receiving component re-renders on the client (a context or
 * signal change, not a change of the prop itself), it diffs that childless node and empties the
 * component: e-store saw `List.Item end={<Switch.Root>...</Switch.Root>}` resume as an empty
 * switch.
 *
 * Rendering a copy leaves the caller's node untouched: Qwik deletes the copy's children, and the
 * original keeps them for serialization and for every later render. Copies are deep (children
 * and JSX-valued props, at any depth) because a component nested inside an element is mutated
 * too. Non-JSX values (signals, stores, QRLs, strings) are passed through as they are.
 *
 * **Stores are checked first.** In dev core's `isJSXNode` falls back to duck typing (own `key`,
 * `props` and `type`), and a store proxy answers `hasOwnProperty` true for ANY key, so
 * `_isJSXNode(store)` is true there. Copying a store as a JSX node replaced it with an empty
 * node.
 *
 * Use it wherever a component renders a JSX prop it received: `{freshJsx(end)}`. Not in a hot
 * loop over a large list (it copies the whole subtree on every render). A JSX value built in the
 * component's own render is not affected and needs no copy.
 */
export function freshJsx<T extends JSXOutput | undefined | null>(value: T): T {
  return copy(value) as T;
}

/** A real JSX node: never a store, which dev-mode `_isJSXNode` mistakes for one (see above). */
function isJsxNode(value: unknown): boolean {
  // `_isStore` is `STORE_TARGET in value`, which throws on a primitive.
  return (
    typeof value === "object" &&
    value !== null &&
    !_isStore(value) &&
    _isJSXNode(value)
  );
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(copy);
  }
  if (!isJsxNode(value)) {
    return value;
  }
  const node = value as JSXNodeInternal<unknown>;
  const clone = _jsxSorted(
    node.type,
    copyProps(node.varProps),
    copyProps(node.constProps),
    copy(node.children) as JSXNodeInternal["children"],
    node.flags,
    node.key,
    node.dev,
  );
  clone.toSort = node.toSort;
  return clone;
}

function copyProps(
  props: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!props) {
    return props;
  }
  let out: Record<string, unknown> | null = null;
  for (const key in props) {
    const v = props[key];
    if (Array.isArray(v) || isJsxNode(v)) {
      out ??= { ...props };
      out[key] = copy(v);
    }
  }
  // No JSX inside: share the object (unchanged values, and an EMPTY_OBJ stays EMPTY_OBJ).
  return out ?? props;
}
