import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(rootDir, "data/song-docs");
const outDir = path.join(rootDir, "data");

const profiles = JSON.parse(fs.readFileSync(path.join(outDir, "song-profiles.json"), "utf8"));

const pdfBasenames = new Set(
  fs.readdirSync(docsDir).filter((file) => file.endsWith(".pdf")).map((file) => file.slice(0, -4))
);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const sceneTitleKey = (sceneTitle) => clean(sceneTitle)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[_-]+/g, " ")
  .replace(/[^a-z0-9 ]+/g, "")
  .trim();

const songPathFromTitle = (sceneTitle) => clean(sceneTitle)
  .normalize("NFKC")
  .replace(/[\\/:*?"<>|]/g, "")
  .replace(/\.$/, "")
  .replace(/ /g, "_")
  .slice(0, 120);

const stripTrailingMeta = (text) => {
  let value = clean(text);
  value = value.replace(/\s+around\s*$/i, "").trim();
  value = value.replace(/\s+\d+(?:\.\d+)?\s*bpm\s*$/i, "").trim();
  value = value.replace(/\s+(?:[A-G](?:#|b|♭|♯)?(?:m|maj|min)?(?:,\s*[A-G](?:#|b|♭|♯)?(?:m|maj|min)?)*|CG|F#m|C#m|B♭m|A♭|Eb|E♭m|D♭|Em|Fm|Gm|Am|Dm|Cm|Bm)\s*$/i, "").trim();
  return value;
};

const ARTIST_SUFFIXES = [
  "England Dan and John Ford Coley",
  "England Dan & John Ford Coley",
  "Michael Bublé",
  "Michael Buble",
  "The Righteous Brothers",
  "Tommy James and The Shondells",
  "KC and the Sunshine Band",
  "KC & The Sunshine Band",
  "Hall & Oates",
  "Hall and Oates",
  "Earth Wind & Fire",
  "Earth Wind and Fire",
  "Huey Lewis & The News",
  "Huey Lewis and The News",
  "The Doobie Brothers",
  "The Rolling Stones",
  "The Blues Brothers",
  "Wilson Pickett",
  "Rick Springfield",
  "Marvin Gaye & Tammi Terrell",
  "Marvin Gaye",
  "The Temptations",
  "The Spinners",
  "The Monkees",
  "The Beatles",
  "The Turtles",
  "The Commodores",
  "The Jacksons",
  "Backstreet Boys",
  "Black Eyed Peas",
  "Britney Spears",
  "Bruno Mars",
  "Amy Winehouse",
  "Ariana Grande",
  "Bob Seger",
  "Ed Sheeran",
  "Elvis Presley",
  "Eric Clapton",
  "Fleetwood Mac",
  "George Michael",
  "Gerry Rafferty",
  "Gloria Gaynor",
  "Jimmy Buffett",
  "Joe Cocker",
  "Kenny Loggins",
  "Lionel Richie",
  "Neil Diamond",
  "Robbie Dupree",
  "Robin Thicke",
  "Rupert Holmes",
  "Sir Mix-A-Lot",
  "Stevie Wonder",
  "Sugarloaf",
  "Taio Cruz",
  "Tammi Terrell",
  "Tom Jones",
  "Tom Petty",
  "Van Morrison",
  "Vanessa Carlton",
  "Walk The Moon",
  "Walk the Moon",
  "Whitney Houston",
  "Al Green",
  "Bee Gees",
  "Blackstreet",
  "Blink-182",
  "Beyoncé",
  "Beyonce",
  "Chicago",
  "DNCE",
  "Elvin Bishop",
  "Ginuwine",
  "Journey",
  "Maroon 5",
  "Orleans",
  "Player",
  "Queen",
  "Seals & Crofts",
  "Seals and Crofts",
  "Steely Dan",
  "Toto",
  "Wheatus",
  "My Chemical Romance",
  "Bowling for Soup",
  "Blues Image",
  "Christopher Cross",
  "CeeLo Green",
  "Daft Punk",
  "Justin Timberlake",
  "Jay Ferguson",
  "Jackson Browne",
  "Pharrell Williams",
  "Taylor Swift",
  "The Chainsmokers",
  "M Jackson",
  "Michael Jackson"
].sort((left, right) => right.length - left.length);

const TITLE_FIXES = {
  "1985- B": { title: "1985", artist: "Bowling for Soup" },
  "A Thousand Miles-B": { title: "A Thousand Miles", artist: "Vanessa Carlton" },
  "All The Small Things C": { title: "All The Small Things", artist: "Blink-182" },
  "All Night Long Lionel Richie A♭around": { title: "All Night Long", artist: "Lionel Richie" },
  "Bang Bang C": { title: "Bang Bang", artist: "Ariana Grande" },
  "Baker Street D": { title: "Baker Street", artist: "Gerry Rafferty" },
  "Blame It On The Boogie C#": { title: "Blame It On The Boogie", artist: "The Jacksons" },
  "Blurred Lines G": { title: "Blurred Lines", artist: "Robin Thicke" },
  "Boogie Shoes B": { title: "Boogie Shoes", artist: "KC and the Sunshine Band" },
  "Celebration Kool And The Gang A♭": { title: "Celebration", artist: "Kool and the Gang" },
  "China Grove E": { title: "China Grove", artist: "The Doobie Brothers" },
  "Closer Fm C#": { title: "Closer", artist: "The Chainsmokers" },
  "Don't Stop Believin E": { title: "Don't Stop Believin'", artist: "Journey" },
  "Dynamite E": { title: "Dynamite", artist: "Taio Cruz" },
  "Easy G": { title: "Easy", artist: "The Commodores" },
  "Escape The Pina Colada Song C": { title: "Escape (The Piña Colada Song)", artist: "Rupert Holmes" },
  "Get lucky Bm": { title: "Get Lucky", artist: "Daft Punk" },
  "Happy F": { title: "Happy", artist: "Pharrell Williams" },
  "Happy Together F#m": { title: "Happy Together", artist: "The Turtles" },
  "I Heard It Through The Grapevine Eb": { title: "I Heard It Through the Grapevine", artist: "Marvin Gaye" },
  "I Will Survive Am": { title: "I Will Survive", artist: "Gloria Gaynor" },
  "Locked out of heaven Dm": { title: "Locked Out of Heaven", artist: "Bruno Mars" },
  "Mercy Mercy Me E": { title: "Mercy Mercy Me", artist: "Marvin Gaye" },
  "Moondance Am": { title: "Moondance", artist: "Van Morrison" },
  "Pony C#m": { title: "Pony", artist: "Ginuwine" },
  "Ride Captain Ride D": { title: "Ride Captain Ride", artist: "Blues Image" },
  "Sailing D": { title: "Sailing", artist: "Christopher Cross" },
  "Saturday In The Park CG": { title: "Saturday in the Park", artist: "Chicago" },
  "September F#m": { title: "September", artist: "Earth Wind and Fire" },
  "Shake it off F": { title: "Shake It Off", artist: "Taylor Swift" },
  "Somebodys Baby D": { title: "Somebody's Baby", artist: "Jackson Browne" },
  "Teenage Dirtbag-E": { title: "Teenage Dirtbag", artist: "Wheatus" },
  "Teenagers-E": { title: "Teenagers", artist: "My Chemical Romance" },
  "The Way You Make Me Feel F": { title: "The Way You Make Me Feel", artist: "Michael Jackson" },
  "Thunder Island F": { title: "Thunder Island", artist: "Jay Ferguson" },
  "Treasure Cm": { title: "Treasure", artist: "Bruno Mars" },
  "Twist And Shout D": { title: "Twist and Shout", artist: "The Beatles" },
  "24K Magic Fm around": { title: "24K Magic", artist: "Bruno Mars" },
  "Baby Got Back Cm": { title: "Baby Got Back", artist: "Sir Mix-A-Lot" },
  "Black Magic Woman G 107bpm": { title: "Black Magic Woman", artist: "Santana" },
  "Bohemian Rhapsody Bb 108.10 bpm": { title: "Bohemian Rhapsody", artist: "Queen" },
  "Cake by the Ocean Em": { title: "Cake by the Ocean", artist: "DNCE" },
  "Cant Stop the Feeling C": { title: "Can't Stop the Feeling!", artist: "Justin Timberlake" },
  "Forget you cee lo green - C": { title: "Forget You", artist: "CeeLo Green" },
  "i want to dance with somebody F#": { title: "I Wanna Dance with Somebody", artist: "Whitney Houston" },
  "No Diggity Blackstreet feat F♯m": { title: "No Diggity", artist: "Blackstreet" },
  "That’s The Way - KC - sunshine Cm": { title: "That's the Way (I Like It)", artist: "KC and the Sunshine Band" }
};

const parseSceneTitle = (sceneTitle) => {
  const exact = TITLE_FIXES[sceneTitle];
  if (exact) {
    return { ...exact };
  }

  const parts = clean(sceneTitle).split(/\s+-\s+/);
  if (parts.length >= 2) {
    const title = stripTrailingMeta(parts[0]);
    const maybeArtist = stripTrailingMeta(parts[1]);
    const looksLikeKey = /^[A-G](?:#|b|♭|♯)?(?:m|maj|min)?$/i.test(maybeArtist)
      || /^(around|bpm|\d)/i.test(maybeArtist);
    if (!looksLikeKey && maybeArtist.length > 1) {
      return {
        title,
        artist: maybeArtist.replace(/&/g, "and").replace(/M Jackson/i, "Michael Jackson")
      };
    }
  }

  let remainder = stripTrailingMeta(sceneTitle);
  for (const artist of ARTIST_SUFFIXES) {
    const normalizedRemainder = remainder.toLowerCase();
    const normalizedArtist = artist.toLowerCase();
    if (normalizedRemainder.endsWith(` ${normalizedArtist}`)) {
      const title = remainder.slice(0, remainder.length - artist.length).trim();
      if (title.length > 0) {
        return {
          title,
          artist: artist.replace(/&/g, "and").replace(/M Jackson/i, "Michael Jackson")
        };
      }
    }
  }

  return { title: remainder, artist: "" };
};

const hasPdfForProfile = (profile) => {
  const songPath = profile.songPath || songPathFromTitle(profile.sceneTitle);
  if (pdfBasenames.has(songPath)) {
    return true;
  }

  const key = sceneTitleKey(profile.sceneTitle).slice(0, 14);
  for (const pdf of pdfBasenames) {
    const pdfKey = sceneTitleKey(pdf.replace(/_/g, " ")).slice(0, 14);
    if (key && pdfKey && (key.startsWith(pdfKey) || pdfKey.startsWith(key))) {
      return true;
    }
  }

  return false;
};

const encodeQuery = (query) => encodeURIComponent(clean(query));

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const entries = [];
const seen = new Set();

for (const profile of Object.values(profiles.songs || {})) {
  if (!hasPdfForProfile(profile)) {
    continue;
  }

  const parsed = parseSceneTitle(profile.sceneTitle);
  const title = stripTrailingMeta(parsed.title);
  const artist = stripTrailingMeta(parsed.artist);
  const dedupe = sceneTitleKey(title);
  if (!title || seen.has(dedupe)) {
    continue;
  }

  seen.add(dedupe);
  entries.push({
    title,
    artist,
    sceneTitle: profile.sceneTitle,
    searchQuery: clean([artist, title].filter(Boolean).join(" "))
  });
}

entries.sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));

const csvLines = [
  "Track,Artist,Search Query,YouTube Search,Spotify Search",
  ...entries.map((entry) => [
    escapeCsv(entry.title),
    escapeCsv(entry.artist),
    escapeCsv(entry.searchQuery),
    escapeCsv(`https://www.youtube.com/results?search_query=${encodeQuery(entry.searchQuery)}`),
    escapeCsv(`https://open.spotify.com/search/${encodeQuery(entry.searchQuery)}`)
  ].join(","))
];

const htmlRows = entries.map((entry, index) => {
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeQuery(entry.searchQuery)}`;
  const spotifyUrl = `https://open.spotify.com/search/${encodeQuery(entry.searchQuery)}`;
  return `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.title)}</td>
      <td>${escapeHtml(entry.artist || "—")}</td>
      <td><a href="${youtubeUrl}" target="_blank" rel="noreferrer">YouTube</a></td>
      <td><a href="${spotifyUrl}" target="_blank" rel="noreferrer">Spotify</a></td>
    </tr>`;
}).join("");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EvenSteven Backing Tracks</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", system-ui, sans-serif;
        background: #0f141a;
        color: #eff6ff;
      }
      body {
        margin: 0;
        padding: 1.25rem;
      }
      h1 {
        margin: 0 0 0.35rem;
        font-size: 1.5rem;
      }
      p, .meta {
        color: #b9c8d9;
      }
      p {
        margin: 0 0 0.75rem;
      }
      .meta {
        margin: 0 0 1rem;
        font-size: 0.9rem;
        line-height: 1.5;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        padding: 0.55rem 0.65rem;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: #b9c8d9;
        font-size: 0.85rem;
        font-weight: 600;
      }
      a {
        color: #4dd4a6;
      }
    </style>
  </head>
  <body>
    <h1>EvenSteven Backing Tracks</h1>
    <p>${entries.length} songs from playAble /data/song-docs</p>
    <div class="meta">
      YouTube playlist: <strong>Backing Tracks</strong><br />
      Spotify playlist: <strong>EvenSteven Backing Tracks</strong><br />
      Open a link, pick the track, then add it to the playlist.
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Track</th>
          <th>Artist</th>
          <th>YouTube</th>
          <th>Spotify</th>
        </tr>
      </thead>
      <tbody>${htmlRows}
      </tbody>
    </table>
  </body>
</html>
`;

const csvPath = path.join(outDir, "backing-tracks-playlist.csv");
const htmlPath = path.join(outDir, "backing-tracks-playlist.html");

fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");
fs.writeFileSync(htmlPath, html, "utf8");

const missingArtist = entries.filter((entry) => !entry.artist).map((entry) => entry.title);
console.log(`Wrote ${entries.length} songs`);
console.log(`CSV: ${csvPath}`);
console.log(`HTML: ${htmlPath}`);
if (missingArtist.length > 0) {
  console.log(`Missing artist (${missingArtist.length}): ${missingArtist.join(", ")}`);
}
