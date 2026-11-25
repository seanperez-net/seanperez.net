/**
 * A contact photo from a file the visitor picks (2026-11-24, the avatar's "+" badge, Google
 * Contacts' "Set contact photo"). LOCAL ONLY: the image is scaled down in the browser and kept in
 * the visitor's book (`local-book.ts` `photo`); nothing is uploaded. Browser only.
 *
 * Scaled to a 256px square (cropped to the centre, as an avatar shows it), JPEG at 0.85: about
 * 15-40 KB as a data URL, under `MAX_PHOTO`. `createImageBitmap` decodes (and drops EXIF; the
 * browser applies the orientation, `imageOrientation: "from-image"` is the default).
 */
import { MAX_PHOTO } from "./local-book";

/** The largest picked file we try to decode, in bytes (larger files are refused). */
export const MAX_PHOTO_FILE = 20 * 1024 * 1024;
const SIDE = 256;

export class PhotoError extends Error {}

export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new PhotoError("Choose an image file");
  if (file.size > MAX_PHOTO_FILE)
    throw new PhotoError("This image is too large (20 MB at most)");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError("This image could not be read");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("This browser cannot resize images");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIDE,
    SIDE,
  );
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > MAX_PHOTO) throw new PhotoError("This image is too large");
  return url;
}
