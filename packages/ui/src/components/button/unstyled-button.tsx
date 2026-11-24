import type { ClassList, JSXOutput, PropsOf } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { safeHref } from "../../utils/safe-href";

/**
 * The element under `Button` and `IconButton`, from e-store's `button/unstyled-button.tsx`.
 *
 * - `type="link"` with an `href`: the router's `<Link>` (a client-side navigation, no page load).
 * - `type="link"` with `reload` or `target="_blank"`: a plain `<a>` (a full page load or a new tab;
 *   `_blank` gets `rel="noopener noreferrer"`).
 * - otherwise: a `<button>`, `type="button"` unless `submit` / `reset` is given.
 *
 * Every `href` goes through `safeHref` first: a `javascript:` / `data:` target from data renders no
 * `href` at all.
 *
 * An INLINE component (not `component$`), as e-store's: it is part of its caller's render, so its
 * props are not serialised a second time per button.
 *
 * Differs from e-store: the `<Link>` is written as JSX. e-store passes it through `routerLink`,
 * which calls Qwik's internal `_jsxSorted` to save about 100 bytes of page state per link; an
 * internal API can change in any release candidate, and this site has few links. NOT PROOFED as a
 * size trade-off; revisit if a page has many link buttons.
 */
export type LinkButtonProps = Omit<PropsOf<"a">, "type" | "class"> & {
  class?: ClassList;
  type: "link";
  href: string;
  target?: "_blank";
  /** A full page load instead of the router's client-side navigation (a plain `<a>`). */
  reload?: boolean;
};

export type NormalButtonProps = Omit<PropsOf<"button">, "type" | "class"> & {
  class?: ClassList;
  type?: "button" | "submit" | "reset";
};

export type UnstyledButtonProps = (LinkButtonProps | NormalButtonProps) & {
  children?: JSXOutput;
};

export const UnstyledButton = (props: UnstyledButtonProps) => {
  // Copied before destructuring: an inline component's props object is the caller's.
  const all = { ...props };
  if (all.type === "link") {
    // `type` is dropped: "link" is not an attribute of `<a>`.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { reload, type: _type, href: givenHref, children, ...rest } = all;
    const href = safeHref(givenHref);
    if (rest.target === "_blank" || reload) {
      const rel = rest.target === "_blank" ? "noopener noreferrer" : undefined;
      return (
        <a {...rest} href={href} rel={rel}>
          {children}
        </a>
      );
    }
    return (
      <Link {...rest} href={href}>
        {children}
      </Link>
    );
  }
  const { type, children, ...rest } = all;
  return (
    <button {...rest} type={type ?? "button"}>
      {children}
    </button>
  );
};
