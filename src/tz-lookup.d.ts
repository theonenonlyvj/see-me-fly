declare module 'tz-lookup' {
  /** Returns the IANA timezone name for a lat/lon, e.g. 'America/Chicago'. */
  export default function tzlookup(lat: number, lon: number): string
}
