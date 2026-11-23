import { cn as tvCn } from "tailwind-variants/lite";

type ClassArgs = Parameters<typeof tvCn>;

/**
 * Joins class names, skipping the falsy ones: `cn("p-4", isWide && "w-full", props.class)`.
 * It does NOT resolve conflicts between Tailwind classes (no merge engine): pick between
 * classes with `tv()` variants.
 */
export const cn = (...classes: ClassArgs): string => tvCn(...classes)() ?? "";
