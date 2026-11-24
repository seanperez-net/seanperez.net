/**
 * Space-separated ID lists (`aria-describedby`, `aria-labelledby`). From e-store's
 * `utils/aria-ids.ts`.
 */

/**
 * Appends an ID to a space-separated string of IDs, avoiding duplicates.
 * @param ids - The current space-separated string of IDs (or undefined/null)
 * @param idToAdd - The ID to append
 * @returns The updated space-separated string of IDs
 * @example
 * signal.value = appendId(signal.value, "rs7y2l0-error")
 * // "rs7y2l0-description" -> "rs7y2l0-description rs7y2l0-error"
 */
export function appendId(
  ids: string | undefined | null,
  idToAdd: string,
): string {
  if (!ids) {
    return idToAdd;
  }

  const idsArray = ids.split(/\s+/).filter(Boolean);

  if (idsArray.includes(idToAdd)) {
    return ids;
  }

  return [...idsArray, idToAdd].join(" ");
}

/**
 * Removes an ID from a space-separated string of IDs.
 * @param ids - The current space-separated string of IDs (or undefined/null)
 * @param idToRemove - The ID to remove
 * @returns The updated space-separated string of IDs, or undefined if the result is empty
 * @example
 * signal.value = removeId(signal.value, "rs7y2l0-error")
 * // "rs7y2l0-description rs7y2l0-error" -> "rs7y2l0-description"
 */
export function removeId(
  ids: string | undefined | null,
  idToRemove: string,
): string | undefined {
  if (!ids) {
    return undefined;
  }

  const idsArray = ids.split(/\s+/).filter(Boolean);
  const filteredIds = idsArray.filter((id) => id !== idToRemove);

  return filteredIds.length > 0 ? filteredIds.join(" ") : undefined;
}
