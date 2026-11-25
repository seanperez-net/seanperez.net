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
}>(({ id, title, full, variant = "outlined" }) => (
  <Card.Root variant={variant}>
    <Card.Header>
      <Card.Title id={id}>{title}</Card.Title>
    </Card.Header>
    <Card.Content variant={full ? "full" : "default"}>
      <Slot />
    </Card.Content>
  </Card.Root>
));
