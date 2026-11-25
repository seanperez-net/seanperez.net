import { Slot, component$ } from "@qwik.dev/core";
import { Card } from "@seanperez/ui";

/**
 * One résumé section: an outlined card (M3: "content and actions about one subject") whose
 * `Card.Title` (h3, under the pane's h2 "Résumé") names it, and whose body is the slot. Lists go
 * edge to edge (`Card.Content variant="full"`); text gets the 16dp padding.
 */
export type ResumeSectionVariant = "outlined" | "filled";

export const ResumeSection = component$<{
  id: string;
  title: string;
  full?: boolean;
  /**
   * The M3 card type (`Card.Root variant`). `outlined` (default) for `/profile/`; the Contacts
   * profile uses `filled` (2026-11-24), the "subtle separation" card (m3.material.io/components/
   * cards/guidelines, read 2026-11-24), as Google Contacts' detail cards.
   */
  variant?: ResumeSectionVariant;
  /**
   * `medium`: the card title in title-medium (`Card.Title size`), as Google Contacts' person-page
   * cards (16/20 weight 500, measured 2026-11-25). Default `large` (M3's card headline).
   */
  titleSize?: "large" | "medium";
}>(({ id, title, full, variant = "outlined", titleSize }) => (
  <Card.Root variant={variant}>
    <Card.Header>
      <Card.Title id={id} size={titleSize}>
        {title}
      </Card.Title>
    </Card.Header>
    <Card.Content variant={full ? "full" : "default"}>
      <Slot />
    </Card.Content>
  </Card.Root>
));
