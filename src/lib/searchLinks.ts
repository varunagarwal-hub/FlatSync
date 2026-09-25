// Links to property sites' own search pages. The app only builds URLs that
// open in the user's browser; it never fetches or scrapes these sites.

// OpenStreetMap city names -> the names these sites use in their URLs.
const CITY_ALIASES: Record<string, string> = {
  bengaluru: "bangalore",
  "bangalore urban": "bangalore",
  "bengaluru urban": "bangalore",
  gurugram: "gurgaon",
  "new delhi": "delhi",
  "greater mumbai": "mumbai",
  "mumbai suburban": "mumbai",
  "greater hyderabad": "hyderabad",
  "pimpri-chinchwad": "pune",
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function citySlug(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return slug(CITY_ALIASES[key] ?? key) || null;
}

/** NoBroker rental listings for a locality, e.g. /flats-for-rent-in-koramangala_bangalore */
export function noBrokerUrl(locality: string, city: string | null): string {
  const c = citySlug(city);
  const path = c ? `flats-for-rent-in-${slug(locality)}_${c}` : `flats-for-rent-in-${slug(locality)}`;
  return `https://www.nobroker.in/${path}`;
}

/** 99acres rental listings for a locality, e.g. /rent-property-in-koramangala-bangalore-ffid */
export function acres99Url(locality: string, city: string | null): string {
  const c = citySlug(city);
  const place = c ? `${slug(locality)}-${c}` : slug(locality);
  return `https://www.99acres.com/rent-property-in-${place}-ffid`;
}
