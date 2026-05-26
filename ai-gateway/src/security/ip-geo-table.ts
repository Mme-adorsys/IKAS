/**
 * Static IP → Geolocation lookup for the demo.
 *
 * Real geo lookup needs MaxMind/IPinfo which require API keys and break the offline-demo
 * experience. This table covers ~30 IPs spanning all continents — enough for a believable
 * map. The graph-seeder draws from here when creating LoginEvent → IpAddress → Geolocation
 * chains, and the demo-simulator picks IPs from this table when emitting live events.
 */

export type IpClassification = 'normal' | 'tor' | 'datacenter' | 'known-bad';

export interface GeoLocation {
  country: string;          // ISO-3166 alpha-2
  countryName: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
}

export interface IpRecord {
  address: string;
  classification: IpClassification;
  asn?: string;             // free-form, just display copy
  geo: GeoLocation;
}

export const IP_GEO_TABLE: IpRecord[] = [
  // Europe — corporate-friendly origins
  { address: '85.214.10.4',   classification: 'normal',     asn: 'Strato AG',           geo: { country: 'DE', countryName: 'Germany',       region: 'Berlin',         city: 'Berlin',       lat: 52.5200, lon: 13.4050 } },
  { address: '88.99.7.12',    classification: 'normal',     asn: 'Hetzner Online',      geo: { country: 'DE', countryName: 'Germany',       region: 'Bavaria',        city: 'Munich',       lat: 48.1351, lon: 11.5820 } },
  { address: '193.99.144.85', classification: 'normal',     asn: 'Heise Medien',        geo: { country: 'DE', countryName: 'Germany',       region: 'Lower Saxony',   city: 'Hannover',     lat: 52.3759, lon:  9.7320 } },
  { address: '212.83.41.7',   classification: 'normal',     asn: 'Online S.a.s.',       geo: { country: 'FR', countryName: 'France',        region: 'Île-de-France',  city: 'Paris',        lat: 48.8566, lon:  2.3522 } },
  { address: '151.101.0.84',  classification: 'normal',     asn: 'Fastly',              geo: { country: 'NL', countryName: 'Netherlands',   region: 'North Holland',  city: 'Amsterdam',    lat: 52.3676, lon:  4.9041 } },
  { address: '194.95.245.140',classification: 'normal',     asn: 'DFN Verein',          geo: { country: 'DE', countryName: 'Germany',       region: 'Hesse',          city: 'Frankfurt',    lat: 50.1109, lon:  8.6821 } },
  { address: '185.107.56.10', classification: 'normal',     asn: 'Vodafone Italia',     geo: { country: 'IT', countryName: 'Italy',         region: 'Lazio',          city: 'Rome',         lat: 41.9028, lon: 12.4964 } },
  { address: '178.62.20.5',   classification: 'normal',     asn: 'DigitalOcean',        geo: { country: 'GB', countryName: 'United Kingdom',region: 'England',        city: 'London',       lat: 51.5074, lon: -0.1278 } },

  // North America
  { address: '52.84.150.39',  classification: 'normal',     asn: 'Amazon CloudFront',   geo: { country: 'US', countryName: 'United States', region: 'Virginia',       city: 'Ashburn',      lat: 39.0438, lon: -77.4874 } },
  { address: '173.245.48.51', classification: 'normal',     asn: 'Cloudflare',          geo: { country: 'US', countryName: 'United States', region: 'California',     city: 'San Francisco',lat: 37.7749, lon:-122.4194 } },
  { address: '142.250.74.46', classification: 'normal',     asn: 'Google',              geo: { country: 'US', countryName: 'United States', region: 'New York',       city: 'New York',     lat: 40.7128, lon: -74.0060 } },
  { address: '99.79.20.18',   classification: 'normal',     asn: 'Amazon AWS',          geo: { country: 'CA', countryName: 'Canada',        region: 'Ontario',        city: 'Toronto',      lat: 43.6532, lon: -79.3832 } },

  // Asia
  { address: '203.0.113.42',  classification: 'normal',     asn: 'NTT Communications',  geo: { country: 'JP', countryName: 'Japan',         region: 'Tokyo',          city: 'Tokyo',        lat: 35.6762, lon: 139.6503 } },
  { address: '52.62.111.10',  classification: 'normal',     asn: 'Amazon AWS',          geo: { country: 'AU', countryName: 'Australia',     region: 'New South Wales',city: 'Sydney',       lat:-33.8688, lon: 151.2093 } },
  { address: '203.45.10.20',  classification: 'normal',     asn: 'Telstra',             geo: { country: 'IN', countryName: 'India',         region: 'Maharashtra',    city: 'Mumbai',       lat: 19.0760, lon:  72.8777 } },

  // South America / Africa
  { address: '189.6.45.10',   classification: 'normal',     asn: 'Vivo',                geo: { country: 'BR', countryName: 'Brazil',        region: 'São Paulo',      city: 'São Paulo',    lat:-23.5505, lon: -46.6333 } },
  { address: '105.235.6.10',  classification: 'normal',     asn: 'MTN',                 geo: { country: 'ZA', countryName: 'South Africa',  region: 'Gauteng',        city: 'Johannesburg', lat:-26.2041, lon:  28.0473 } },

  // Suspicious — datacenter / VPN exit nodes
  { address: '45.155.205.233',classification: 'datacenter', asn: 'M247 Ltd',            geo: { country: 'RO', countryName: 'Romania',       region: 'București',      city: 'Bucharest',    lat: 44.4268, lon: 26.1025 } },
  { address: '92.118.39.61',  classification: 'datacenter', asn: 'Quadranet',           geo: { country: 'US', countryName: 'United States', region: 'Nevada',         city: 'Las Vegas',    lat: 36.1699, lon:-115.1398 } },
  { address: '193.32.162.157',classification: 'datacenter', asn: 'IP Volume Inc',       geo: { country: 'SC', countryName: 'Seychelles',    region: 'Victoria',       city: 'Victoria',     lat: -4.6191, lon:  55.4513 } },

  // Suspicious — Tor exit nodes
  { address: '185.220.101.7', classification: 'tor',        asn: 'Tor exit relay',      geo: { country: 'NL', countryName: 'Netherlands',   region: 'North Holland',  city: 'Amsterdam',    lat: 52.3676, lon:  4.9041 } },
  { address: '185.220.102.4', classification: 'tor',        asn: 'Tor exit relay',      geo: { country: 'DE', countryName: 'Germany',       region: 'Berlin',         city: 'Berlin',       lat: 52.5200, lon: 13.4050 } },
  { address: '199.249.230.83',classification: 'tor',        asn: 'Tor exit relay',      geo: { country: 'US', countryName: 'United States', region: 'New Jersey',     city: 'Newark',       lat: 40.7357, lon: -74.1724 } },

  // Suspicious — known bad / scanner ranges
  { address: '141.98.10.142', classification: 'known-bad',  asn: 'Cyber Origin S.R.L.', geo: { country: 'LT', countryName: 'Lithuania',     region: 'Vilnius',        city: 'Vilnius',      lat: 54.6872, lon: 25.2797 } },
  { address: '194.165.16.77', classification: 'known-bad',  asn: 'Stark Industries',    geo: { country: 'RU', countryName: 'Russia',        region: 'Moscow',         city: 'Moscow',       lat: 55.7558, lon: 37.6173 } },
  { address: '103.45.246.10', classification: 'known-bad',  asn: 'CNNIC scan range',    geo: { country: 'CN', countryName: 'China',         region: 'Beijing',        city: 'Beijing',      lat: 39.9042, lon: 116.4074 } },
  { address: '5.45.207.18',   classification: 'known-bad',  asn: 'Selectel',            geo: { country: 'RU', countryName: 'Russia',        region: 'St. Petersburg', city: 'Saint Petersburg', lat: 59.9311, lon: 30.3609 } },
  { address: '102.130.115.94',classification: 'known-bad',  asn: 'Xneelo',              geo: { country: 'NG', countryName: 'Nigeria',       region: 'Lagos',          city: 'Lagos',        lat:  6.5244, lon:  3.3792 } },

  // The "impossible travel" companion: same user logs from Berlin then São Paulo within 40min
  // → handled by selecting 85.214.10.4 then 189.6.45.10 in the seeder.
];

export function pickRandomIp(filter?: { classification?: IpClassification }): IpRecord {
  const pool = filter?.classification ? IP_GEO_TABLE.filter(ip => ip.classification === filter.classification) : IP_GEO_TABLE;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function findIp(address: string): IpRecord | undefined {
  return IP_GEO_TABLE.find(ip => ip.address === address);
}
