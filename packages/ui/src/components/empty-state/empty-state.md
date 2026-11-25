# EmptyState

Placeholder for an empty content area: an empty list, no search results, nothing selected in a
list-detail layout (M3 list-detail: "a two-pane layout shows placeholder content in the detail
pane", m3.material.io/foundations/layout/canonical-layouts/list-detail, read 2026-11-24). An icon,
a headline, a description and optional actions.

FROM E-STORE (`packages/ui/src/components/empty-state/`), ported 2026-11-24 for the site's Contacts
and Messages lists. PROOFED 2026-11-24 against: M3 has no empty-state component, so the parts are
plain type-scale roles (title / headline, body-medium, on-surface-variant) and the `xl` 48dp icon;
`role="status"` per MDN (status role, polite live region).

## Props

| Prop           | Type                       | Default | Description                                                                |
| -------------- | -------------------------- | ------- | -------------------------------------------------------------------------- |
| `icon`         | `IconName`                 | --      | Icon above the headline, `xl` (48dp), on-surface-variant                   |
| `headline`     | `string`                   | --      | The heading, as `headingLevel`                                             |
| `description`  | `string`                   | --      | One paragraph under it, body-medium on-surface-variant, at most `max-w-md` |
| `size`         | `'sm' \| 'md' \| 'lg'`     | `'md'`  | Vertical padding (32 / 64 / 96) and headline type (title-medium / title-large / headline-small) |
| `headingLevel` | `'h1'` ... `'h6'`          | `'h2'`  | The headline's element; the type stays with `size`                         |
| `live`         | `boolean`                  | `true`  | `role="status"`. `false` for a state that IS the page                      |

Slot: actions (buttons), in a row under the text; the row is hidden while empty.

`emptyStateVariants` (tv slots `root`, `iconWrapper`, `headline`, `description`, `actions`;
variant `size`). Data attribute: `data-qds-empty-state` on the root.

## Where it differs from e-store

- `icon` is an `IconName` (e-store: any string for its icon font).
- No `iconTone` (our `Icon` has no `tone` prop yet).
- The actions row is `empty:hidden`: e-store's always added its 24px top margin.

## Usage

```tsx
<EmptyState size="sm" icon="delete" headline="No contacts in Trash" />

<EmptyState icon="search" headline="No results" description="Try other words.">
  <Button look="tonal" label="Clear search" />
</EmptyState>
```

## ARIA

The root is a polite live region (`role="status"`) unless `live={false}`: a state that appears
after a search or a filter is announced. The headline is a real heading.
