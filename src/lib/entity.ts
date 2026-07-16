// Entity names are free text and often contain "/" (e.g. "F/E/D/Bureau",
// "CorpsAfrica/Ethiopia"). A single encoded path segment (%2F) 404s in Next, so
// the profile route is a catch-all [...entity]: encode each slash-delimited part
// as its own segment, and reassemble on the way back.

export function entityHref(name: string): string {
  return "/entities/" + name.split("/").map(encodeURIComponent).join("/");
}

export function entityFromParam(segments: string[]): string {
  return segments.map((s) => decodeURIComponent(s)).join("/");
}
