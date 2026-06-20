// Single source of truth for the genre/vibe options shown in the UI and used
// when seeding. Keeping it here avoids an extra round-trip just to list chips.

export type Mode = "MUSIC" | "MOVIE" | "BOOK";

export const TAXONOMY = {
  MUSIC: {
    genres: [
      "Pop", "Indie", "Hip-Hop", "R&B", "Rock", "Metal", "Punk", "Electronic",
      "Lo-fi", "Jazz", "Blues", "Soul", "Funk", "Reggae", "Country", "Folk",
      "Latin", "K-Pop", "Classical",
    ],
    vibes: ["Chill", "Energetic", "Sad", "Focus", "Party", "Romantic"],
  },
  MOVIE: {
    types: ["movie", "series"] as const,
    genres: [
      "Action", "Adventure", "Comedy", "Thriller", "Drama", "Sci-Fi", "Fantasy",
      "Horror", "Mystery", "Crime", "Romance", "Animation", "Anime", "Family",
      "Documentary", "History", "War", "Western",
    ],
    vibes: ["Feel-good", "Edge-of-seat", "Cozy", "Mind-bending", "Tear-jerker"],
  },
  BOOK: {
    genres: [
      "Fiction", "Mystery", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Horror",
      "Historical", "Adventure", "Young Adult", "Classics", "Poetry",
      "Graphic Novel", "Non-fiction", "Biography", "Self-help",
    ],
    vibes: ["Cozy", "Page-turner", "Thought-provoking", "Heartwarming", "Dark"],
  },
} as const;

/**
 * MUSIC sub-genres (multi-select). `seed` is the Spotify search `genre:` tag the
 * label resolves to; an unknown label falls back to its lowercased form. Grouped by
 * parent genre purely for display. Sub-genres are additive on top of the broad genre
 * chips — they narrow the music spin without replacing the genre/vibe filters.
 */
export const SUBGENRES: { label: string; seed: string; group: string }[] = [
  // Rock
  { label: "Punk Rock", seed: "punk", group: "Rock" },
  { label: "Psychedelic Rock", seed: "psych-rock", group: "Rock" },
  { label: "Hard Rock", seed: "hard-rock", group: "Rock" },
  { label: "Indie Rock", seed: "indie", group: "Rock" },
  { label: "Grunge", seed: "grunge", group: "Rock" },
  { label: "Alt Rock", seed: "alt-rock", group: "Rock" },
  { label: "Blues Rock", seed: "blues-rock", group: "Rock" },
  { label: "Soft Rock", seed: "soft-rock", group: "Rock" },
  { label: "Pop Rock", seed: "pop-rock", group: "Rock" },
  { label: "Classic Rock", seed: "classic rock", group: "Rock" },
  { label: "Progressive Rock", seed: "progressive rock", group: "Rock" },
  { label: "Garage Rock", seed: "garage rock", group: "Rock" },
  { label: "Folk Rock", seed: "folk rock", group: "Rock" },
  { label: "Post-Rock", seed: "post-rock", group: "Rock" },
  { label: "Surf Rock", seed: "surf rock", group: "Rock" },
  // Metal
  { label: "Heavy Metal", seed: "metal", group: "Metal" },
  { label: "Death Metal", seed: "death-metal", group: "Metal" },
  { label: "Metalcore", seed: "metalcore", group: "Metal" },
  { label: "Black Metal", seed: "black metal", group: "Metal" },
  { label: "Thrash Metal", seed: "thrash metal", group: "Metal" },
  { label: "Doom Metal", seed: "doom metal", group: "Metal" },
  { label: "Power Metal", seed: "power metal", group: "Metal" },
  { label: "Nu Metal", seed: "nu metal", group: "Metal" },
  // Pop
  { label: "Synth-pop", seed: "synth-pop", group: "Pop" },
  { label: "Indie Pop", seed: "indie-pop", group: "Pop" },
  { label: "Power Pop", seed: "power-pop", group: "Pop" },
  { label: "Dance Pop", seed: "dance pop", group: "Pop" },
  { label: "Electropop", seed: "electropop", group: "Pop" },
  { label: "Dream Pop", seed: "dream pop", group: "Pop" },
  { label: "Art Pop", seed: "art pop", group: "Pop" },
  { label: "Hyperpop", seed: "hyperpop", group: "Pop" },
  // Indie
  { label: "Indie Folk", seed: "indie folk", group: "Indie" },
  { label: "Bedroom Pop", seed: "bedroom pop", group: "Indie" },
  { label: "Shoegaze", seed: "shoegaze", group: "Indie" },
  { label: "Indietronica", seed: "indietronica", group: "Indie" },
  { label: "Jangle Pop", seed: "jangle pop", group: "Indie" },
  // Hip-Hop
  { label: "Trap", seed: "trap", group: "Hip-Hop" },
  { label: "Boom Bap", seed: "boom bap", group: "Hip-Hop" },
  { label: "Drill", seed: "drill", group: "Hip-Hop" },
  { label: "Gangsta Rap", seed: "gangster rap", group: "Hip-Hop" },
  { label: "Conscious Hip-Hop", seed: "conscious hip hop", group: "Hip-Hop" },
  { label: "Cloud Rap", seed: "cloud rap", group: "Hip-Hop" },
  // R&B
  { label: "Neo-Soul", seed: "neo soul", group: "R&B" },
  { label: "Contemporary R&B", seed: "contemporary r&b", group: "R&B" },
  { label: "Alternative R&B", seed: "alternative r&b", group: "R&B" },
  { label: "New Jack Swing", seed: "new jack swing", group: "R&B" },
  { label: "Quiet Storm", seed: "quiet storm", group: "R&B" },
  // Punk
  { label: "Pop Punk", seed: "pop punk", group: "Punk" },
  { label: "Hardcore Punk", seed: "hardcore punk", group: "Punk" },
  { label: "Post-Punk", seed: "post-punk", group: "Punk" },
  { label: "Emo", seed: "emo", group: "Punk" },
  { label: "Ska Punk", seed: "ska punk", group: "Punk" },
  // Electronic
  { label: "House", seed: "house", group: "Electronic" },
  { label: "Deep House", seed: "deep-house", group: "Electronic" },
  { label: "Techno", seed: "techno", group: "Electronic" },
  { label: "Trance", seed: "trance", group: "Electronic" },
  { label: "Dubstep", seed: "dubstep", group: "Electronic" },
  { label: "Drum & Bass", seed: "drum-and-bass", group: "Electronic" },
  { label: "EDM", seed: "edm", group: "Electronic" },
  { label: "Synthwave", seed: "synthwave", group: "Electronic" },
  { label: "Ambient", seed: "ambient", group: "Electronic" },
  { label: "Hardstyle", seed: "hardstyle", group: "Electronic" },
  { label: "UK Garage", seed: "uk garage", group: "Electronic" },
  { label: "Future Bass", seed: "future bass", group: "Electronic" },
  // Lo-fi
  { label: "Lo-fi Hip-Hop", seed: "lo-fi hip hop", group: "Lo-fi" },
  { label: "Chillhop", seed: "chillhop", group: "Lo-fi" },
  { label: "Jazzhop", seed: "jazzhop", group: "Lo-fi" },
  // Jazz
  { label: "Bossa Nova", seed: "bossanova", group: "Jazz" },
  { label: "Smooth Jazz", seed: "smooth jazz", group: "Jazz" },
  { label: "Bebop", seed: "bebop", group: "Jazz" },
  { label: "Swing", seed: "swing", group: "Jazz" },
  { label: "Jazz Fusion", seed: "jazz fusion", group: "Jazz" },
  { label: "Big Band", seed: "big band", group: "Jazz" },
  // Blues
  { label: "Delta Blues", seed: "delta blues", group: "Blues" },
  { label: "Chicago Blues", seed: "chicago blues", group: "Blues" },
  { label: "Electric Blues", seed: "electric blues", group: "Blues" },
  { label: "Soul Blues", seed: "soul blues", group: "Blues" },
  // Soul
  { label: "Gospel", seed: "gospel", group: "Soul" },
  { label: "Motown", seed: "motown", group: "Soul" },
  { label: "Northern Soul", seed: "northern soul", group: "Soul" },
  { label: "Southern Soul", seed: "southern soul", group: "Soul" },
  // Funk
  { label: "P-Funk", seed: "p-funk", group: "Funk" },
  { label: "Funk Rock", seed: "funk rock", group: "Funk" },
  { label: "Boogie", seed: "boogie", group: "Funk" },
  // Reggae
  { label: "Dancehall", seed: "dancehall", group: "Reggae" },
  { label: "Dub", seed: "dub", group: "Reggae" },
  { label: "Ska", seed: "ska", group: "Reggae" },
  { label: "Rocksteady", seed: "rocksteady", group: "Reggae" },
  { label: "Roots Reggae", seed: "roots reggae", group: "Reggae" },
  // Country
  { label: "Americana", seed: "americana", group: "Country" },
  { label: "Outlaw Country", seed: "outlaw country", group: "Country" },
  { label: "Country Pop", seed: "country pop", group: "Country" },
  { label: "Honky Tonk", seed: "honky-tonk", group: "Country" },
  { label: "Alt-Country", seed: "alt-country", group: "Country" },
  // Folk
  { label: "Bluegrass", seed: "bluegrass", group: "Folk" },
  { label: "Singer-Songwriter", seed: "singer-songwriter", group: "Folk" },
  { label: "Celtic", seed: "celtic", group: "Folk" },
  { label: "Folk Punk", seed: "folk punk", group: "Folk" },
  // Latin
  { label: "Reggaeton", seed: "reggaeton", group: "Latin" },
  { label: "Salsa", seed: "salsa", group: "Latin" },
  { label: "Bachata", seed: "bachata", group: "Latin" },
  { label: "Cumbia", seed: "cumbia", group: "Latin" },
  { label: "Latin Pop", seed: "latin pop", group: "Latin" },
  { label: "Merengue", seed: "merengue", group: "Latin" },
  { label: "Latin Trap", seed: "latin trap", group: "Latin" },
  // K-Pop
  { label: "K-Indie", seed: "korean indie", group: "K-Pop" },
  { label: "K-Ballad", seed: "korean ballad", group: "K-Pop" },
  { label: "K-Rap", seed: "korean hip hop", group: "K-Pop" },
  { label: "K-R&B", seed: "korean r&b", group: "K-Pop" },
  // Classical
  { label: "Baroque", seed: "baroque", group: "Classical" },
  { label: "Opera", seed: "opera", group: "Classical" },
  { label: "Orchestral", seed: "orchestral", group: "Classical" },
  { label: "Contemporary Classical", seed: "contemporary classical", group: "Classical" },
  { label: "Minimalism", seed: "minimalism", group: "Classical" },
  { label: "Choral", seed: "choral", group: "Classical" },
];

/**
 * Country-specific MUSIC sub-genres (multi-select), keyed by ISO 3166-1 code. Shown when
 * that country is selected — independent of the broad genre chips. For the mapped local-
 * language countries the chosen `seed` becomes the Spotify search anchor keyword (so India
 * + "Bhangra" searches bhangra in the IN market, not the default "bollywood"); see the
 * Spotify provider's localPool.
 */
export const COUNTRY_SUBGENRES: Record<string, { label: string; seed: string }[]> = {
  IN: [
    { label: "Bollywood", seed: "bollywood" },
    { label: "Classical", seed: "indian classical" }, // Hindustani / Carnatic
    { label: "Indie", seed: "indian indie" },
    { label: "Bhangra", seed: "bhangra" },
    { label: "Punjabi", seed: "punjabi" },
    { label: "Sufi", seed: "sufi" },
    { label: "Ghazal", seed: "ghazal" },
    { label: "Carnatic", seed: "carnatic" },
  ],
  KR: [
    { label: "K-Pop", seed: "k-pop" },
    { label: "K-Indie", seed: "korean indie" },
    { label: "K-Ballad", seed: "korean ballad" },
    { label: "Trot", seed: "trot" },
  ],
  JP: [
    { label: "J-Pop", seed: "j-pop" },
    { label: "J-Rock", seed: "j-rock" },
    { label: "City Pop", seed: "city pop" },
    { label: "Anime", seed: "anime" },
  ],
  FR: [
    { label: "Chanson", seed: "chanson française" },
    { label: "French Pop", seed: "french pop" },
    { label: "French Rap", seed: "rap français" },
    { label: "French Touch", seed: "french touch" },
    { label: "Yé-yé", seed: "yé-yé" },
    { label: "Variété", seed: "variété française" },
  ],
  DE: [
    { label: "Schlager", seed: "schlager" },
    { label: "Krautrock", seed: "krautrock" },
    { label: "German Rap", seed: "deutschrap" },
    { label: "Neue Deutsche Welle", seed: "neue deutsche welle" },
    { label: "German Techno", seed: "german techno" },
  ],
  ES: [
    { label: "Flamenco", seed: "flamenco" },
    { label: "Spanish Pop", seed: "pop español" },
    { label: "Spanish Rock", seed: "rock español" },
    { label: "Reggaeton", seed: "reggaeton" },
    { label: "Rumba", seed: "rumba" },
    { label: "Copla", seed: "copla" },
  ],
  IT: [
    { label: "Italian Pop", seed: "italian pop" },
    { label: "Italian Rap", seed: "rap italiano" },
    { label: "Cantautori", seed: "cantautorato" },
    { label: "Italo Disco", seed: "italo disco" },
    { label: "Opera", seed: "opera" },
  ],
  RU: [
    { label: "Russian Pop", seed: "russian pop" },
    { label: "Russian Rock", seed: "russian rock" },
    { label: "Russian Rap", seed: "russian hip hop" },
    { label: "Estrada", seed: "estrada" },
    { label: "Chanson", seed: "russian chanson" },
  ],
  CN: [
    { label: "Mandopop", seed: "mandopop" },
    { label: "Cantopop", seed: "cantopop" },
    { label: "Chinese Rock", seed: "chinese rock" },
    { label: "Chinese Indie", seed: "chinese indie" },
    { label: "Guofeng", seed: "guofeng" },
  ],
  SE: [
    { label: "Swedish Pop", seed: "swedish pop" },
    { label: "Swedish House", seed: "swedish house" },
    { label: "Swedish Metal", seed: "swedish metal" },
    { label: "Swedish Indie", seed: "swedish indie" },
    { label: "Dansband", seed: "dansband" },
  ],
};

/** Spotify search `genre:` seed for a sub-genre label; checks global then country lists. */
export const subgenreSeed = (label: string): string => {
  const global = SUBGENRES.find((s) => s.label === label)?.seed;
  if (global) return global;
  for (const list of Object.values(COUNTRY_SUBGENRES)) {
    const hit = list.find((s) => s.label === label)?.seed;
    if (hit) return hit;
  }
  return label.toLowerCase();
};

/** Seed for a label that's a country-specific sub-genre of `code`, else undefined. */
export const countrySubgenreSeed = (code: string, label: string): string | undefined =>
  COUNTRY_SUBGENRES[code]?.find((s) => s.label === label)?.seed;

/**
 * The sub-genres to show for the current selection: those whose parent genre is selected,
 * plus any country-specific ones for the selected country (country ones first). MUSIC only;
 * empty when there's nothing relevant to show (so the section can hide).
 */
export function availableSubgenres(
  mode: Mode,
  genres: string[],
  country?: string | null,
): { label: string; seed: string }[] {
  if (mode !== "MUSIC") return [];
  const byCountry = country ? (COUNTRY_SUBGENRES[country] ?? []) : [];
  const byGenre = SUBGENRES.filter((s) => genres.includes(s.group));
  const seen = new Set<string>();
  return [...byCountry, ...byGenre].filter((s) => (seen.has(s.label) ? false : seen.add(s.label)));
}

/** Decade filter (start year → that decade), newest first. Applies to every mode. */
export const DECADES: { label: string; value: number }[] = [
  { label: "2020s", value: 2020 },
  { label: "2010s", value: 2010 },
  { label: "2000s", value: 2000 },
  { label: "90s", value: 1990 },
  { label: "80s", value: 1980 },
  { label: "70s", value: 1970 },
  { label: "60s", value: 1960 },
  { label: "50s", value: 1950 },
  { label: "40s", value: 1940 },
];

/**
 * Country filter. `code` is an ISO 3166-1 alpha-2 country code used as TMDB's
 * origin-country (movies/series) and Spotify's market (music); the optional `lang`
 * is the MARC language code used to bias Open Library results (books). Applies to
 * all modes, best-effort per the catalogue's capabilities. Countries without an
 * explicit `lang` default to English (see `countryLang`); a code the live
 * providers don't recognise degrades gracefully to the unfiltered pool.
 */
export const COUNTRIES: { label: string; code: string; lang?: string }[] = [
  { label: "Afghanistan", code: "AF" },
  { label: "Albania", code: "AL" },
  { label: "Algeria", code: "DZ" },
  { label: "Andorra", code: "AD" },
  { label: "Angola", code: "AO" },
  { label: "Antigua and Barbuda", code: "AG" },
  { label: "Argentina", code: "AR", lang: "spa" },
  { label: "Armenia", code: "AM" },
  { label: "Australia", code: "AU", lang: "eng" },
  { label: "Austria", code: "AT", lang: "ger" },
  { label: "Azerbaijan", code: "AZ" },
  { label: "Bahamas", code: "BS" },
  { label: "Bahrain", code: "BH" },
  { label: "Bangladesh", code: "BD" },
  { label: "Barbados", code: "BB" },
  { label: "Belarus", code: "BY" },
  { label: "Belgium", code: "BE" },
  { label: "Belize", code: "BZ" },
  { label: "Benin", code: "BJ" },
  { label: "Bhutan", code: "BT" },
  { label: "Bolivia", code: "BO", lang: "spa" },
  { label: "Bosnia and Herzegovina", code: "BA" },
  { label: "Botswana", code: "BW" },
  { label: "Brazil", code: "BR", lang: "por" },
  { label: "Brunei", code: "BN" },
  { label: "Bulgaria", code: "BG" },
  { label: "Burkina Faso", code: "BF" },
  { label: "Burundi", code: "BI" },
  { label: "Cambodia", code: "KH" },
  { label: "Cameroon", code: "CM" },
  { label: "Canada", code: "CA", lang: "eng" },
  { label: "Cape Verde", code: "CV" },
  { label: "Central African Republic", code: "CF" },
  { label: "Chad", code: "TD" },
  { label: "Chile", code: "CL", lang: "spa" },
  { label: "China", code: "CN", lang: "chi" },
  { label: "Colombia", code: "CO", lang: "spa" },
  { label: "Comoros", code: "KM" },
  { label: "Congo (Brazzaville)", code: "CG" },
  { label: "Congo (Kinshasa)", code: "CD" },
  { label: "Costa Rica", code: "CR", lang: "spa" },
  { label: "Côte d'Ivoire", code: "CI" },
  { label: "Croatia", code: "HR" },
  { label: "Cuba", code: "CU", lang: "spa" },
  { label: "Cyprus", code: "CY" },
  { label: "Czechia", code: "CZ" },
  { label: "Denmark", code: "DK", lang: "dan" },
  { label: "Djibouti", code: "DJ" },
  { label: "Dominica", code: "DM" },
  { label: "Dominican Republic", code: "DO", lang: "spa" },
  { label: "Ecuador", code: "EC", lang: "spa" },
  { label: "Egypt", code: "EG", lang: "ara" },
  { label: "El Salvador", code: "SV", lang: "spa" },
  { label: "Equatorial Guinea", code: "GQ" },
  { label: "Eritrea", code: "ER" },
  { label: "Estonia", code: "EE" },
  { label: "Eswatini", code: "SZ" },
  { label: "Ethiopia", code: "ET" },
  { label: "Fiji", code: "FJ" },
  { label: "Finland", code: "FI", lang: "fin" },
  { label: "France", code: "FR", lang: "fre" },
  { label: "Gabon", code: "GA" },
  { label: "Gambia", code: "GM" },
  { label: "Georgia", code: "GE" },
  { label: "Germany", code: "DE", lang: "ger" },
  { label: "Ghana", code: "GH" },
  { label: "Greece", code: "GR", lang: "gre" },
  { label: "Grenada", code: "GD" },
  { label: "Guatemala", code: "GT", lang: "spa" },
  { label: "Guinea", code: "GN" },
  { label: "Guinea-Bissau", code: "GW" },
  { label: "Guyana", code: "GY" },
  { label: "Haiti", code: "HT" },
  { label: "Honduras", code: "HN", lang: "spa" },
  { label: "Hong Kong", code: "HK", lang: "chi" },
  { label: "Hungary", code: "HU", lang: "hun" },
  { label: "Iceland", code: "IS", lang: "ice" },
  { label: "India", code: "IN", lang: "eng" },
  { label: "Indonesia", code: "ID", lang: "ind" },
  { label: "Iran", code: "IR", lang: "per" },
  { label: "Iraq", code: "IQ", lang: "ara" },
  { label: "Ireland", code: "IE", lang: "eng" },
  { label: "Israel", code: "IL", lang: "heb" },
  { label: "Italy", code: "IT", lang: "ita" },
  { label: "Jamaica", code: "JM" },
  { label: "Japan", code: "JP", lang: "jpn" },
  { label: "Jordan", code: "JO", lang: "ara" },
  { label: "Kazakhstan", code: "KZ" },
  { label: "Kenya", code: "KE" },
  { label: "Kiribati", code: "KI" },
  { label: "Kuwait", code: "KW", lang: "ara" },
  { label: "Kyrgyzstan", code: "KG" },
  { label: "Laos", code: "LA" },
  { label: "Latvia", code: "LV" },
  { label: "Lebanon", code: "LB", lang: "ara" },
  { label: "Lesotho", code: "LS" },
  { label: "Liberia", code: "LR" },
  { label: "Libya", code: "LY", lang: "ara" },
  { label: "Liechtenstein", code: "LI" },
  { label: "Lithuania", code: "LT" },
  { label: "Luxembourg", code: "LU" },
  { label: "Madagascar", code: "MG" },
  { label: "Malawi", code: "MW" },
  { label: "Malaysia", code: "MY" },
  { label: "Maldives", code: "MV" },
  { label: "Mali", code: "ML" },
  { label: "Malta", code: "MT" },
  { label: "Marshall Islands", code: "MH" },
  { label: "Mauritania", code: "MR" },
  { label: "Mauritius", code: "MU" },
  { label: "Mexico", code: "MX", lang: "spa" },
  { label: "Micronesia", code: "FM" },
  { label: "Moldova", code: "MD" },
  { label: "Monaco", code: "MC" },
  { label: "Mongolia", code: "MN" },
  { label: "Montenegro", code: "ME" },
  { label: "Morocco", code: "MA", lang: "ara" },
  { label: "Mozambique", code: "MZ", lang: "por" },
  { label: "Myanmar", code: "MM" },
  { label: "Namibia", code: "NA" },
  { label: "Nauru", code: "NR" },
  { label: "Nepal", code: "NP" },
  { label: "Netherlands", code: "NL", lang: "dut" },
  { label: "New Zealand", code: "NZ", lang: "eng" },
  { label: "Nicaragua", code: "NI", lang: "spa" },
  { label: "Niger", code: "NE" },
  { label: "Nigeria", code: "NG", lang: "eng" },
  { label: "North Korea", code: "KP", lang: "kor" },
  { label: "North Macedonia", code: "MK" },
  { label: "Norway", code: "NO", lang: "nor" },
  { label: "Oman", code: "OM", lang: "ara" },
  { label: "Pakistan", code: "PK" },
  { label: "Palau", code: "PW" },
  { label: "Palestine", code: "PS", lang: "ara" },
  { label: "Panama", code: "PA", lang: "spa" },
  { label: "Papua New Guinea", code: "PG" },
  { label: "Paraguay", code: "PY", lang: "spa" },
  { label: "Peru", code: "PE", lang: "spa" },
  { label: "Philippines", code: "PH" },
  { label: "Poland", code: "PL", lang: "pol" },
  { label: "Portugal", code: "PT", lang: "por" },
  { label: "Qatar", code: "QA", lang: "ara" },
  { label: "Romania", code: "RO", lang: "rum" },
  { label: "Russia", code: "RU", lang: "rus" },
  { label: "Rwanda", code: "RW" },
  { label: "Saint Kitts and Nevis", code: "KN" },
  { label: "Saint Lucia", code: "LC" },
  { label: "Saint Vincent and the Grenadines", code: "VC" },
  { label: "Samoa", code: "WS" },
  { label: "San Marino", code: "SM" },
  { label: "São Tomé and Príncipe", code: "ST" },
  { label: "Saudi Arabia", code: "SA", lang: "ara" },
  { label: "Senegal", code: "SN" },
  { label: "Serbia", code: "RS" },
  { label: "Seychelles", code: "SC" },
  { label: "Sierra Leone", code: "SL" },
  { label: "Singapore", code: "SG" },
  { label: "Slovakia", code: "SK" },
  { label: "Slovenia", code: "SI" },
  { label: "Solomon Islands", code: "SB" },
  { label: "Somalia", code: "SO" },
  { label: "South Africa", code: "ZA", lang: "eng" },
  { label: "South Korea", code: "KR", lang: "kor" },
  { label: "South Sudan", code: "SS" },
  { label: "Spain", code: "ES", lang: "spa" },
  { label: "Sri Lanka", code: "LK" },
  { label: "Sudan", code: "SD", lang: "ara" },
  { label: "Suriname", code: "SR" },
  { label: "Sweden", code: "SE", lang: "swe" },
  { label: "Switzerland", code: "CH", lang: "ger" },
  { label: "Syria", code: "SY", lang: "ara" },
  { label: "Taiwan", code: "TW", lang: "chi" },
  { label: "Tajikistan", code: "TJ" },
  { label: "Tanzania", code: "TZ" },
  { label: "Thailand", code: "TH", lang: "tha" },
  { label: "Timor-Leste", code: "TL" },
  { label: "Togo", code: "TG" },
  { label: "Tonga", code: "TO" },
  { label: "Trinidad and Tobago", code: "TT" },
  { label: "Tunisia", code: "TN", lang: "ara" },
  { label: "Turkey", code: "TR", lang: "tur" },
  { label: "Turkmenistan", code: "TM" },
  { label: "Tuvalu", code: "TV" },
  { label: "Uganda", code: "UG" },
  { label: "Ukraine", code: "UA", lang: "ukr" },
  { label: "United Arab Emirates", code: "AE", lang: "ara" },
  { label: "United Kingdom", code: "GB", lang: "eng" },
  { label: "United States", code: "US", lang: "eng" },
  { label: "Uruguay", code: "UY", lang: "spa" },
  { label: "Uzbekistan", code: "UZ" },
  { label: "Vanuatu", code: "VU" },
  { label: "Vatican City", code: "VA" },
  { label: "Venezuela", code: "VE", lang: "spa" },
  { label: "Vietnam", code: "VN", lang: "vie" },
  { label: "Yemen", code: "YE", lang: "ara" },
  { label: "Zambia", code: "ZM" },
  { label: "Zimbabwe", code: "ZW" },
];

/** MARC language code for a country (books); defaults to English. */
export const countryLang = (code?: string | null): string => COUNTRIES.find((c) => c.code === code)?.lang ?? "eng";

/**
 * Minimum-rating filter, per mode and on each mode's native scale: movies/series
 * use TMDB's 0–10 vote average, books use Open Library's 0–5 average. Music has
 * no rating, so it offers none.
 */
export const RATINGS: Record<Mode, { label: string; value: number }[]> = {
  MUSIC: [],
  MOVIE: [
    { label: "6+", value: 6 },
    { label: "7+", value: 7 },
    { label: "8+", value: 8 },
  ],
  BOOK: [
    { label: "3+", value: 3 },
    { label: "4+", value: 4 },
    { label: "4.5+", value: 4.5 },
  ],
};

export const MODE_META: Record<Mode, { label: string; greeting: string }> = {
  MUSIC: { label: "Music", greeting: "What to listen to?" },
  MOVIE: { label: "Movies & TV", greeting: "What to watch?" },
  BOOK: { label: "Books", greeting: "What to read?" },
};
