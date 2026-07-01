// Primary brand colors for common carriers, keyed by ICAO code. Used by the allegiance /
// loyalty views so each airline reads in (roughly) its own brand color instead of a rank palette.
// Carriers not listed fall back to a distinct palette passed by the caller. Colors are chosen to
// be brand-recognizable AND mutually distinguishable for a typical US-centric flyer (the top two
// US majors — American red, Southwest blue — read clearly apart).
export const AIRLINE_BRAND: Record<string, string> = {
  // US majors
  AAL: '#D1002E', // American — red
  SWA: '#2E4B9B', // Southwest — bold blue
  UAL: '#0A7BC2', // United — blue (cyan-leaning, to separate from Southwest)
  DAL: '#0B2265', // Delta — navy
  ASA: '#00426A', // Alaska
  JBU: '#00308C', // JetBlue
  NKS: '#F4C400', // Spirit — yellow
  FFT: '#0E7C3A', // Frontier — green
  HAL: '#4B286D', // Hawaiian — purple
  SCX: '#C8102E', // Sun Country
  // Regionals (usually roll into a major with mergeDefunct, but color if seen)
  ASQ: '#8892a6', // ExpressJet / Atlantic Southeast — grey
  SKW: '#7d8697', // SkyWest — grey
  // International
  ACA: '#D22630', // Air Canada — red
  BAW: '#21468B', // British Airways — navy
  VIR: '#E10A0A', // Virgin Atlantic — red
  DLH: '#0A1D3F', // Lufthansa — navy
  AFR: '#002157', // Air France — navy blue
  KLM: '#00A1DE', // KLM — light blue
  UAE: '#D71921', // Emirates — red
  QTR: '#5C0632', // Qatar — burgundy
  ETD: '#BD8B13', // Etihad — gold
  SIA: '#F99F1C', // Singapore — gold
  QFA: '#E40000', // Qantas — red
  ANA: '#13448F', // All Nippon — blue
  JAL: '#B4001E', // Japan Airlines — red
  AMX: '#0B2265', // Aeromexico — navy
  VOI: '#A5228E', // Volaris — magenta
  CPA: '#006564', // Cathay Pacific — teal-green
  IBE: '#D40F14', // Iberia — red
  AZA: '#00854A', // ITA / Alitalia — green
}

/** Brand color for an ICAO code, or the provided fallback (a distinct palette slot). */
export function airlineColor(code: string | null | undefined, fallback: string): string {
  return (code && AIRLINE_BRAND[code]) || fallback
}
