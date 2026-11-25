# List

A Material 3 list: `List.Root`, `List.Item`, `List.Divider`, and collapsible groups
(`List.Group`, `List.GroupHeader`, `List.GroupContent`). Rows are `Item`s (see `item.md`).

From e-store's `components/list/` (2026-11-23), with the changes listed under "Where it differs
from e-store".

**M3:** https://m3.material.io/components/lists/specs and /guidelines (read in Chrome 2026-11-23)
**APG:** https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ ,
https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

## Which list

| Need                                               | Use                                          | Renders                                                                              |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Rows to read                                       | `List.Root`                                  | `<ul>` + `<li>`                                                                      |
| Choose one row                                     | `List.Root interactive` + `value` on rows    | `role="listbox"` + `role="option"`, `aria-selected`, ONE Tab stop                    |
| Places to go                                       | `List.Root` + `href` on rows                 | `<ul>` + `<li>` + `<a>`, each link a Tab stop, the current one `aria-current="page"` |
| Rows that do something and hold their own controls | `List.Root rovingFocus` + `onClick$` on rows | `<ul>` (not a listbox), ONE Tab stop handing focus to its rows                       |
| Link rows with their own actions (Star, Edit, ⋮)   | `List.Root rovingFocus` + `href` + `actions` | `<li>` holding the `<a>` and, BESIDE it, the actions (see "Row actions")             |
| A few clickable rows in a plain list               | `List.Root` + `onClick$` on rows             | each such row is its own Tab stop (Enter / Space click it)                           |
| Sections that open and close                       | `List.Group`                                 | disclosure button + nested `<ul>`                                                    |

## API

### List.Root

| Prop                             | Type                             | Default      | Description                                                                                                                                                                  |
| -------------------------------- | -------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `look`                           | `"standard" \| "segmented"`      | `"standard"` | `segmented` (M3 Expressive): each row on surface-container, 4dp gaps, 4dp inner and 16dp outer corners, 16dp all round when selected.                                        |
| `shape`                          | `"default" \| "rounded"`         | `"default"`  | `rounded`: pill rows with an 8dp side margin (`--layout-item-mx`).                                                                                                           |
| `indicator`                      | `"primary" \| "secondary"`       | `"primary"`  | Selected colors: primary-container (an option) or secondary-container (M3 navigation indicator).                                                                             |
| `padding`                        | `"default" \| "tight" \| "none"` | `"default"`  | 8dp above and below the rows (M3); `tight` 4dp; `none`.                                                                                                                      |
| `inset`                          | `"default" \| "drawer"`          | `"default"`  | `drawer`: rows 12dp from the edges, 10dp between the leading control and the label.                                                                                          |
| `density`                        | `"default" \| "compact"`         | `"default"`  | Passed to every row's `Item`.                                                                                                                                                |
| `interactive`                    | `boolean`                        | `false`      | A selection list (listbox). Needs `aria-label` / `aria-labelledby`.                                                                                                          |
| `rovingFocus`                    | `boolean`                        | `false`      | A plain list of actionable rows that is one Tab stop. Ignored with `interactive`.                                                                                            |
| `value` / `bind:value`           | `string` / `Signal<string>`      | `""`         | The chosen row's `value`.                                                                                                                                                    |
| `onValueChange$`                 | `QRL<(value: string) => void>`   | -            | Once per choice.                                                                                                                                                             |
| `openGroups` / `bind:openGroups` | `string[]` / `Signal<string[]>`  | `[]`         | The open groups' `value`s. When given, it decides which groups start open. Bind a signal when the array is computed in render (a new array on each render is adopted again). |
| `multipleGroups`                 | `boolean`                        | `true`       | Several groups open at once; `false`: one (accordion).                                                                                                                       |
| `onFocusIn$` / `onFocusOut$`     | QRL                              | -            | Run after the list's own focus handling.                                                                                                                                     |

Every other `<ul>` attribute is spread onto the `<ul>`. A non-interactive list keeps a given `role`
and `tabIndex`.

### List.Item

Every `Item` prop (`headline`, `supportingText`, `overline`, `startIcon`, `start`, `endIcon`,
`end`, `trailingSupportingText`, `lines`, `align`, `headlineLines`, `supportingLines`, ...), plus:

| Prop              | Type                   | Default                      | Description                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string`               | -                            | The row's value in a selection list.                                                                                                                                                                                                                                                      |
| `selected`        | `boolean`              | -                            | Marks the row selected outright (else the list's `value` decides).                                                                                                                                                                                                                        |
| `disabled`        | `boolean`              | `false`                      | `data-disabled` (and `aria-disabled` on an option), M3 per-part colours (label 30%, icons and the rest 38%; `item.md`), no pointer events, skipped by the arrows; an `href` row loses its link.                                                                                           |
| `onClick$`        | `QRL<() => void>`      | -                            | Makes the row interactive.                                                                                                                                                                                                                                                                |
| `href`            | `string`               | -                            | The row is a link (`UnstyledButton type="link"`: the router's `<Link>`, through `safeHref`). In a selection list (an option) no `<a>` is rendered: choosing the option navigates (`useNavigate`, or a page load with `reload`), so Cmd/Ctrl-click does not open a new tab there.          |
| `reload`          | `boolean`              | -                            | With `href`: a plain `<a>` (a full page load).                                                                                                                                                                                                                                            |
| `prefetchBundles` | `PrefetchStrategy`     | router default (`"visible"`) | With `href`: the router `Link`'s prop (through `UnstyledButton`). `"intent"` for a link to a heavy page (a map). NEW 2026-11-24, not in e-store                                                                                                                                           |
| `rel`             | `string`               | -                            | With `href`: the link's `rel` (`me`, `external`); use `reload` for a link off the site. New 2026-11-24, not in e-store. `UnstyledButton` keeps a given `rel` (and adds `noopener noreferrer` for `_blank`).                                                                               |
| `externalLabel`   | `string`               | `"external link"`            | With `href` and a `rel` containing `external`: the row ends with the `open_in_new` icon (its trailing icon, `role="img"` named by this text, mirrored in RTL). An explicit `end` / `endIcon` replaces it. NEW 2026-11-24, not in e-store; the reasons are in `button.md` "External links" |
| `actions`         | `JSXOutput`            | -                            | The row's own controls, rendered BESIDE the row's link (a sibling of the `<a>` in the `<li>`, never inside it). Shown on hover / focus-within where the pointer can hover, always on touch. NEW 2026-11-25, not in e-store; see "Row actions"                                             |
| `linkData`        | `{ [data-*]: string }` | -                            | With `href`: `data-*` on the `<a>`.                                                                                                                                                                                                                                                       |
| `aria-label`      | `string`               | -                            | The row's name, on its interactive element (the `<a>`, else the `<li>`).                                                                                                                                                                                                                  |
| `role`            | `string`               | -                            | Overrides the computed role.                                                                                                                                                                                                                                                              |
| `itemClass`       | `ClassList`            | -                            | Classes on the inner `Item`.                                                                                                                                                                                                                                                              |
| children          | -                      | -                            | Rendered in the `Item`'s text column (e.g. one `Checkbox` whose label is the whole row).                                                                                                                                                                                                  |

Every other `<li>` attribute is spread onto the `<li>` (`id`, `data-*`, `style`, `draggable`,
`aria-current`); `onDragStart$` is passed by name.

### List.Divider

`inset?: boolean` (16dp start, 24dp end), `class`. Renders `<li aria-hidden="true"><hr></li>`.

### List.Group, List.GroupHeader, List.GroupContent

- `List.Group`: `value` (generated when absent), `open` / `bind:open`. A group starts open unless
  the root was given `openGroups` (then the root's list decides) or `open={false}`.
- `List.GroupHeader`: every `Item` prop, `label` (the headline), `chevronIcon` (`IconName`,
  default `expand_more`, rotated 180deg while open; `null` hides it), `aria-disabled` (a label row
  with nothing to disclose: no button role, no Tab stop).
- `List.GroupContent`: a nested `<ul>`, `hidden` while closed; in an `interactive` list it is the
  listbox, named by its header, with its own single Tab stop.

## Row actions (`List.Item actions`, NEW 2026-11-25)

Owner's decision 2026-11-25 (Contacts rows get Google's Star, Edit and More): rows stay LINKS, and
the row's own controls sit BESIDE the link. HTML forbids interactive content inside an `<a>`, so a
button in the row's `end` of a link row would be nested in the link; `actions` renders them as the
`<a>`'s sibling instead.

```tsx
<List.Root rovingFocus aria-labelledby="t">
  <List.Item
    href="/contacts/ada/"
    headline="Ada Lovelace"
    aria-label="Open Ada Lovelace"
    actions={
      <>
        <IconButton
          toggle
          icon="star"
          iconSelected="star_filled"
          label="Star Ada"
        />
        <IconButton
          type="link"
          href="/contacts/ada/?edit"
          icon="edit"
          label="Edit Ada"
        />
        <Menu.Root>
          {/* Menu.Trigger aria-label="More actions for Ada" ... */}
        </Menu.Root>
      </>
    }
  />
</List.Root>
```

- Layout: the `<li>` becomes a two-column grid (`listItemVariants actions`); the row (link or
  Item) is column 1, the actions (`[data-list-item-actions]`, `listItemActionsVariants`) column 2.
- Where the pointer can hover (`@media (hover: hover)`): the row spans both columns and the actions
  lie over its end. They are hidden by OPACITY (never `visibility` / `display`), so they stay in
  the tab order and the accessibility tree, and show on the row's `:hover` or `:focus-within`.
  Over the row they paint the row's surface: `--list-actions-bg` (default `surface`; segmented
  rows set `surface-container`; a selected row's container is inherited) under the row's own state
  layer (`background-image: inherit`). A host whose list sits on another surface sets
  `--list-actions-bg`.
- Touch (`@media (hover: none)`): always shown, in their own column; the row's text ends before
  them.
- The strip sits 3px in from the row's end (`--outline-width-focus-ring`), so the row's inward
  focus ring shows beside it (in Chrome the strip's fill covered the ring before). Pressing a
  control does not paint the row's pressed layer (`active:not-has-[...]`).
- Over the row the strip covers its trailing text and `end` while shown (as Gmail's hover
  actions); put nothing there that must stay readable on hover.
- Clicks on the actions stop at their wrapper (`stoppropagation:click`): the row's selection or
  `onClick$` does not run. Enter / Space on a control are the control's (`navigateListItems`).
- Tab: only the row that holds focus keeps its controls in the tab order (`focusInList` marks the
  other rows' controls `data-list-actions-off` + `tabindex=-1`), so Tab leaves a long list after
  one row's controls. Before any row had focus, every control is a Tab stop. Second agent,
  2026-11-25 (a 200-row Contacts list was 600 Tab stops).
- Keys: in a `rovingFocus` list the arrows move between ROWS (from a control too). A control's
  Enter / Space are its own, a link's too (Space on "Edit" does not open the row). A menu button inside the row keeps its keys: ArrowDown /
  ArrowUp open its menu (Menu), and Home / End no longer take focus to the first / last row
  (`utils/roving-focus.ts`, from e-store commit 2b8a5bb9c, 2026-11-24, where the same check sits
  in its `navigateListItems`). A menu button that IS an item (a toolbar's) still moves.
- Open (owner): on touch three 48dp controls leave a 360px pane about 115px for the name; the
  second agent suggests only More on touch (Star and Edit inside it). `hover: none` leaves
  touchscreen laptops on the hover rules (`any-hover: none` / `pointer: coarse` are options).
  Focus-within keeps the strip shown on the row last clicked with a mouse until focus moves.
- M3: lists guidelines "List selection modes", multi-action: "Place supplementary actions ... in
  the trailing position" (read 2026-11-25 for `m3-hierarchy.md` B3). Hover-only reveal is not M3:
  HOUSE, from Google Contacts (owner).

## Keyboard

| Key                         | Action                                                                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                         | Into a listbox: its selected option, else its first enabled one. Into a `rovingFocus` list: its first enabled row. Out: the next control (the list leaves the tab order while a row has focus). In a navigation list each link is a Tab stop |
| ArrowDown / ArrowUp         | Next / previous enabled row, wrapping. Only in a listbox or a `rovingFocus` list; in a plain list they scroll the page                                                                                                                       |
| Home / End                  | First / last enabled row (same lists)                                                                                                                                                                                                        |
| Enter / Space               | Click the focused row (an `href` row follows its own link). Keys on a focused link in a plain list are the browser's. A control inside the row keeps its own keys                                                                            |
| Alt / Ctrl / Cmd + key      | Left to the app and the browser                                                                                                                                                                                                              |
| Group header: Enter / Space | Open / close; arrows, Home and End move between headers                                                                                                                                                                                      |

The row arrows, Home and End are the shared `utils/roving-focus.ts` (`rovingKeys` on the `<ul>`,
with `data-roving="vertical"` only where the list manages focus). In a `rovingFocus` list with
groups the arrows also reach the rows of open groups (before 2026-11-23 they stopped at the
group's nested `<ul>`, so those rows had no keyboard route). Group headers keep their own
`headerKeys` in `list.tsx`: they are a second set of items (every header in the list) inside the
same `<ul>` as the rows, which one container's item selector cannot express.
Also 2026-11-23: `rovingFocus` with `interactive` is now really ignored (the root used the raw
prop and became an extra Tab stop and arrow group over the groups' listboxes), and arrows from a
switch or checkbox inside a row move between rows (they used to stop there).

A control inside a row (a switch, an icon button) is a Tab stop of its own; put
`stoppropagation:click` on it (`endProps={{ "stoppropagation:click": true }}`) when the row has its
own `onClick$`.

## ARIA

- Selection list: `role="listbox"` on the `<ul>`, `role="option"` + `aria-selected` on each row
  (APG listbox). An interactive list WITH groups cannot be one listbox (a listbox owns only
  options and groups; a header is a button), so each `GroupContent` is a listbox named by its
  header and the root is a plain list.
- Navigation list: the current row's LINK has `aria-current="page"`.
- Every selected row has `data-selected` (the colors); `aria-selected` only on an `option`.
- Disabled: `data-disabled` on every disabled row; `aria-disabled="true"` only on an `option`
  (ARIA 1.2 deprecated it as a global attribute: `listitem` and generic do not support it).
- No link inside an `option` (an option's children are presentational, WAI-ARIA 1.2).
- Group header: `<div role="button" tabindex="0" aria-expanded aria-controls>`, not a `<button>`
  (a control in its `end` would be a button inside a button). An enabled header holding its own
  control is still nested interactive content: avoid it.
- Focused rows show M3's inward focus ring (`focus-ring-inward`); a row whose child control has
  keyboard focus shows the 12% focus layer.

## Usage

```tsx
<List.Root interactive aria-label="Settings" bind:value={chosen}>
  <List.Item value="wifi" headline="Wi-Fi" supportingText="Connected" startIcon="widgets" />
  <List.Divider inset />
  <List.Item value="sound" headline="Sound" startIcon="volume_up" />
</List.Root>

<List.Root aria-label="Account" indicator="secondary" shape="rounded">
  <List.Item headline="Profile" href="/profile/" startIcon="person" selected />
  <List.Item headline="Sign out" href="/sign-out/" reload startIcon="logout" />
</List.Root>

<List.Root bind:openGroups={open}>
  <List.Group value="settings">
    <List.GroupHeader label="Settings" />
    <List.GroupContent>
      <List.Item headline="Wi-Fi" />
    </List.GroupContent>
  </List.Group>
</List.Root>
```

## Proof (2026-11-23)

| Item                                                                                                       | Status                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8dp list padding                                                                                           | PROOFED: e-store's and M3's baseline list (no material-web token; the M3 specs diagrams show 8dp above the first row)                               |
| Divider: outline-variant, 1dp, inset 16dp start / 24dp end                                                 | PROOFED: m3.material.io lists specs baseline table ("Divider inset left padding 16dp, right padding 24dp"); material-web `divider-leading-space` 16 |
| Selected: primary-container / on-primary-container                                                         | PROOFED: M3 lists specs color roles (Primary container, On primary container)                                                                       |
| `secondary` indicator                                                                                      | NOT PROOFED for lists: M3's navigation drawer / rail active indicator is secondary-container; M3 lists name only primary-container                  |
| State layers 8 / 12 / 12%, on-surface                                                                      | PROOFED: material-web list tokens                                                                                                                   |
| Segmented: surface-container rows, 4dp inner / 16dp outer, 16dp when selected                              | PROOFED: M3 lists specs "Shape morphing" (4dp inner, 16dp outer, selected 16dp)                                                                     |
| Segmented 4dp gap and 8dp side padding                                                                     | NOT PROOFED: the M3 page's token table did not load in Chrome; e-store's values                                                                     |
| Listbox: one Tab stop, arrows, Home / End, `aria-selected` on options                                      | PROOFED: APG listbox pattern                                                                                                                        |
| Groups: disclosure (`aria-expanded`, `aria-controls`)                                                      | PROOFED: APG disclosure pattern; M3 lists "Expand and collapse"                                                                                     |
| `aria-current="page"` on the link                                                                          | PROOFED: WAI-ARIA 1.2 `aria-current` ("page: represents the current page within a set of pages")                                                    |
| Qwik: `sync$` handlers inline every literal; handlers passed by name; signals read in `useComputed$` / JSX | PROOFED: `.claude/skills/qwik-v2` (rc.5), installed `core-internal.d.ts` `_qrlSync`                                                                 |
| `rovingFocus` with controls in rows (each control a Tab stop)                                              | e-store's design; APG has no single pattern for it (grid would be the strict one)                                                                   |

## Where it differs from e-store

- `actions` (2026-11-25) is NEW: e-store's rows with controls are `onClick$` rows with the
  control in `end` (a control nested in an interactive row); ours keep the row a link and put the
  controls beside it. The `[aria-haspopup="menu"]` key rule is e-store's (2b8a5bb9c), moved into
  the shared `rovingKeys`, where our list's arrows live.

- `look`, `shape` and `indicator` are signals in context: e-store passed plain values, captured
  once, so a host that changed them (our knobs) restyled the `<ul>` but not its rows.
- `onValueChange$` runs once per choice: e-store also called it from a `useTask$` tracking the
  value, so a click called it twice, and it ran on the server for the starting value.
- No refocus after a choice: e-store refocused the row in `requestAnimationFrame`, saying focus
  was lost on re-render; in Chrome on rc.5 focus stays on the row (checked 2026-11-23).
- The focus handlers are always attached and check the list's own role / `data-roving-focus`,
  instead of handlers swapped by a signal read in render.
- Group ids come from `useId()` (e-store built them from `value`: two lists with a group of the
  same value had duplicate ids).
- Group start state: e-store applied the root's (empty) list before a group's `open` registered,
  so groups started CLOSED although `open` defaults to true, while its own doc example shows
  `openGroups={['settings']}` with an unlisted group closed. Now: the root's `openGroups` decides
  when given, else a group starts open.
- The current row of a navigation list is `aria-current="page"` on its `<a>`; e-store wrote
  `aria-current="true"` on the `<li>`.
- State layers are a background image over the row's fill (e-store's `bg-on-surface/8` replaced
  a segmented row's surface-container on hover, and faked the selected hover with `/90`).
- The selected container is painted once, by the `<li>` (`Item selectedFill={false}`).
- `href` rows render through our `UnstyledButton`; in an option no `<a>` (the option navigates).
- Keyboard (second agent's review): an `onClick$` row in a plain list is its own Tab stop
  (e-store gave it `tabindex=-1`: unreachable); arrows / Home / End act only in a listbox or a
  `rovingFocus` list (e-store cancelled them on the links of a plain navigation list); every row
  of a `rovingFocus` list is focusable (a row without `onClick$` had no `tabindex`, so the arrows
  dead-ended).
- `aria-disabled` only on options; `data-disabled` styles every disabled row and header.
- `List.Divider` is `aria-hidden` without `role="separator"` (e-store had both).
- A caller's `onKeyDown$` (row) and `onFocusIn$` / `onFocusOut$` (group content) are composed
  after the list's own, not overwritten.
- `transition-[background-color,color,border-radius]` (e-store's `colors` is not a property).
- `GroupHeader chevronIcon` is an `IconName` or `null` (e-store: JSX).
- No Layout-context density; `--layout-item-mx` / `--layout-item-gap` are read with fallbacks
  (8dp / 16dp) since our layout has no item tokens.
- The ripple surface is rendered (as e-store) but `RippleProvider` is not mounted in the
  playground or the site, so there is no press ripple yet; the pressed state layer shows.

## Open (owner to decide)

- A `GroupHeader` with an `end` control is still a control nested in `role="button"` (a
  button's children are presentational): the second agent suggests a native `<button>` for the
  label and chevron with `end` beside it. That changes e-store's element tree (RULE 0): not done.
- The second agent also suggests one pattern for actionable rows (a stretched `<button>` / `<a>`
  in Item's `container`, controls above it), which would retire `rovingFocus`. Not done (a
  different design from e-store's).
- Segmented look with groups: each header is the first child of its group, so it gets the
  16dp top corners; rounding is per nested list, not per section.
- The pressed state layer (12%) and the ripple would stack if `RippleProvider` were mounted.
- `multipleGroups={false}` with two groups that both start open: the second closes the first
  (after it has streamed; backpatched). Give one of them `open={false}`.

## Related code

`components/layout/layout.tsx` draws the navigation drawer's rows itself (`drawerRow`: 56dp,
full round, label-large, secondary-container when current). They look like
`List.Root shape="rounded" indicator="secondary"` rows but are not built from them; not changed.

## Web standards

`<ul>`, `<li>`, `<hr>`, `hidden`, `aria-selected`, `aria-current`, `aria-disabled`,
`aria-expanded`, `focusin` / `focusout` (they bubble; `focus` does not).
