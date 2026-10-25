import countryNames from "./mautic-country-names.json"

// Mautic 7's country choices use names, including legacy labels such as
// "Czech Republic". Account addresses remain ISO codes in Medusa and Odoo.
const names: Readonly<Record<string, string>> = countryNames
export function mauticCountry(code: unknown): string | undefined {
  return typeof code === "string" ? names[code.toUpperCase()] : undefined
}
