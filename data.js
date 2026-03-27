/* ═══════════════════════════════════════════════
   PHILMONT 2025 — data.js
   All trip data lives here. Edit this file to:
     - Update camp narratives
     - Add / remove photos
     - Swap in real GPS route coordinates
   ═══════════════════════════════════════════════

   NOTE: This is a .js file rather than .json so it
   can be loaded via <script src="data.js"> without
   requiring a local web server. Pure JSON files
   trigger CORS errors when opened as file:// URLs.
*/

// ── CONFIG ────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoibWljaGFlbGFuZGN1cnRpcyIsImEiOiItVTNSejNjIn0.3H1msxhcprTDvNrDpVRr-Q';

const MAP_CONFIG = {
  center:  [-104.9600, 36.5600],
  zoom:    10.5,
  pitch:   55,
  bearing: -20,
  terrainExaggeration: 1.6,
};

// ── ITINERARY ─────────────────────────────────────
// Each entry is one day of the trek.
// coords: [longitude, latitude] of the night's camp.
// To swap in real GPS data, update FULL_ROUTE and
// DAY_SEGMENTS below rather than these per-day coords.
const DAYS = [
  {
    day: 1,
    camp: "Camping HQ",
    shortCamp: "Base Camp",
    from: null,
    to: "Camping HQ",
    miles: 0,
    gain: 0,
    loss: 0,
    elevation: 6630,
    coords: [-104.8989, 36.4635],
    features: ["Opening Campfire", "Gear Check", "Crew Orientation"],
    campType: "staffed",
    narrative: "Arrival day at Philmont's historic base camp, nestled at 6,630 feet in the foothills east of Cimarrón. The afternoon is a blur of gear sorting, bear bag practice, and the nervous anticipation that comes with standing at the trailhead of something you've been training for all year. The Opening Campfire brings the crew together under a canopy of stars unlike anything back home — a reminder of why you came. Tomorrow, the mountains begin."
  },
  {
    day: 2,
    camp: "Toothache Springs",
    shortCamp: "Toothache Spgs",
    from: "Camping HQ (Zastrow TH)",
    to: "Toothache Springs",
    miles: 4.7,
    gain: 958,
    loss: 22,
    elevation: 7960,
    coords: [-104.9280, 36.5060],
    features: ["Ranger Training", "Fire Recovery Zone", "Trail Camp"],
    campType: "trail",
    narrative: "The real trek begins with a shuttle to Zastrow Trailhead before the first footstep on trail. Your Ranger joins the crew here — part guide, part wilderness instructor, entirely essential. The climb north through the Fire Recovery Zone is a living classroom: scorched snags stand alongside explosive regrowth, a testament to the forest's resilience. Nearly a thousand feet of gain brings you to Toothache Springs as afternoon clouds build over the ridges above. First night under the pines."
  },
  {
    day: 3,
    camp: "Magpie",
    shortCamp: "Magpie",
    from: "Toothache Springs",
    to: "Magpie",
    miles: 3.9,
    gain: 744,
    loss: 1129,
    elevation: 7570,
    coords: [-104.9520, 36.5340],
    features: ["Low COPE @ Urraca", "Dry Camp", "Water @ North Fork Urraca Creek"],
    campType: "dry",
    narrative: "A shorter day by the numbers, but the Low COPE program at Urraca demands something harder than mileage: teamwork. The crew works through challenge initiatives that expose every communication fault and interpersonal friction the backcountry hasn't ironed out yet. By the time you reach Magpie — a dry camp requiring water carries from North Fork Urraca Creek — there's a different quality to how the scouts talk to each other. The mountains are doing their work."
  },
  {
    day: 4,
    camp: "Miners Park",
    shortCamp: "Miners Park",
    from: "Magpie",
    to: "Miners Park",
    miles: 5.0,
    gain: 1480,
    loss: 945,
    elevation: 8800,
    coords: [-104.9780, 36.5580],
    features: ["High COPE Program", "Lovers Leap Overlook", "Climbing & Rappelling"],
    campType: "staffed",
    narrative: "The High COPE course at Miners Park is a ropes course suspended in the trees — a vertical laboratory for trust and courage. The Lovers Leap Overlook offers the first commanding views south toward the plains, a vista that reminds everyone how far the world extends beyond a screen. By afternoon, climbing and rappelling at the natural rock faces introduces scouts to the vertical element that will recur throughout the south country. Miners Park earns its staffed camp status."
  },
  {
    day: 5,
    camp: "Black Mountain",
    shortCamp: "Black Mtn",
    from: "Miners Park",
    to: "Black Mountain",
    miles: 5.1,
    gain: 1475,
    loss: 431,
    elevation: 9634,
    coords: [-104.9960, 36.5850],
    features: ["Trail Building Project", "North Fork Urraca", "Black Mountain Encampment"],
    campType: "trail",
    narrative: "The conservation ethic is alive at Black Mountain. The Trail Building Project puts scouts to work with pulaskis and mcLeods, shaping the very trail that future crews will walk. It's hard, gratifying labor — the kind that leaves a mark on the land and on you. The Black Mountain Encampment sits high in the timber, and on clear evenings the summit ridge catches the last golden light. At 9,634 feet, the air has a different character. The crew has found its stride."
  },
  {
    day: 6,
    camp: "Divide",
    shortCamp: "Divide",
    from: "Black Mountain",
    to: "Divide",
    miles: 4.2,
    gain: 2492,
    loss: 932,
    elevation: 11150,
    coords: [-104.9700, 36.6140],
    features: ["Bonito Peak", "Big Red", "Dry Camp", "Water @ Red Hills"],
    campType: "dry",
    narrative: "This is the day the trek earns its 'rugged' classification. Nearly 2,500 feet of gain over 4.2 miles, threading past Bonito Peak and the iconic formation called Big Red. The climb is relentless, but the reward is proportional: Divide Camp sits near timberline, where the world falls away in every direction and the wind has an opinion about everything. Another dry camp — water carries are planned and executed with the efficiency of a crew that's learned from the miles behind them."
  },
  {
    day: 7,
    camp: "Lamberts Mine",
    shortCamp: "Lamberts Mine",
    from: "Divide",
    to: "Lamberts Mine",
    miles: 10.1,
    gain: 1738,
    loss: 3321,
    elevation: 8140,
    coords: [-105.0230, 36.6400],
    features: ["Mt. Phillips (optional)", "Comanche Peak", "Cyphers Mine", "Mining History"],
    campType: "staffed",
    narrative: "The big day. Ten miles, the option to summit Mount Phillips, and a descent of more than 3,300 feet that tests every knee the crew has brought into the backcountry. Those who make the push to Mount Phillips — at nearly 11,700 feet, the high point of Philmont — earn a view that stretches into Colorado. Cyphers Mine delivers living history: costumed interpreters bring the 1880s gold rush to life in the tunnels. The long descent into Lamberts Mine ends with sore legs and stories that will outlast the blisters."
  },
  {
    day: 8,
    camp: "Cimarroncito",
    shortCamp: "Cimarroncito",
    from: "Lamberts Mine",
    to: "Cimarroncito",
    miles: 4.1,
    gain: 424,
    loss: 1272,
    elevation: 7300,
    coords: [-105.0100, 36.5980],
    features: ["Window Rock (optional)", "Climbing & Rappelling"],
    campType: "staffed",
    narrative: "A recovery day by distance, but the climbing program at Cimarroncito asks tired arms to find reserves they weren't sure existed. Window Rock — a natural arch framing a rectangle of sky — rewards those who make the side trip. Cimarroncito's staffed camp comes with warm interactions and a sense that the trek's midpoint is behind you. The crew begins calculating what's left, what's been done, and how they've changed in the doing of it."
  },
  {
    day: 9,
    camp: "Cimarroncito",
    shortCamp: "Cimarroncito II",
    from: "Cimarroncito",
    to: "Cimarroncito (layover)",
    miles: 4.9,
    gain: 650,
    loss: 655,
    elevation: 7300,
    coords: [-105.0100, 36.5980],
    features: ["Climbing & Rappelling (continued)", "Layover Day"],
    campType: "layover",
    narrative: "A second day at Cimarroncito deepens the climbing program — lead climbing, multi-pitch anchors, rappelling variations that build on what was introduced yesterday. The layover rhythm settles into the crew: a slower morning, skills work through midday, the freedom of the afternoon. Camp becomes a place rather than just a waypoint. Scouts who were tentative on the rock yesterday move with new confidence today. The mountains have a way of accelerating certain kinds of growth."
  },
  {
    day: 10,
    camp: "Clarks Fork",
    shortCamp: "Clarks Fork",
    from: "Cimarroncito",
    to: "Clarks Fork",
    miles: 5.2,
    gain: 169,
    loss: 800,
    elevation: 6670,
    coords: [-104.9620, 36.5420],
    features: ["Demonstration Forest", "Horse Ride", "Western Lore Program", "Chuckwagon Dinner"],
    campType: "staffed",
    narrative: "The western lore program at Clarks Fork is pure Philmont mythology made real: horses, chuckwagons, and an evening under the stars with the Ranch's living history program. The horse ride through ponderosa pine and meadow feels like stepping into a century-old photograph. The Chuckwagon Dinner and Campfire Show is the social peak of the trek — a chance to laugh, eat well, and feel the bonds that twelve days in the backcountry have forged between the members of this crew."
  },
  {
    day: 11,
    camp: "Tooth Ridge",
    shortCamp: "Tooth Ridge",
    from: "Clarks Fork",
    to: "Tooth Ridge",
    miles: 5.9,
    gain: 2248,
    loss: 1470,
    elevation: 7440,
    coords: [-104.9300, 36.4990],
    features: ["Shaefers Peak", "Tooth of Time", "Dry Camp", "Water @ Clarks Fork"],
    campType: "dry",
    narrative: "The Tooth of Time dominates the Philmont skyline — a volcanic plug visible from the highway forty miles away, the symbol that tells every scout they're home. Reaching its summit on Day 11 is the emotional apex of the journey, a viewshed that encompasses the entire route traveled: Black Mountain to the north, Divide in the distance, Cimarroncito below. Shaefers Peak offers its own rewards. Tooth Ridge dry camp sits beneath the stars with the plains glowing amber to the east. One day left."
  },
  {
    day: 12,
    camp: "Camping HQ",
    shortCamp: "Base Camp (Return)",
    from: "Tooth Ridge",
    to: "Camping HQ",
    miles: 5.8,
    gain: 858,
    loss: 2461,
    elevation: 6630,
    coords: [-104.8989, 36.4635],
    features: ["Hike Into Base", "Closing Campfire", "Arrowhead Award"],
    campType: "staffed",
    narrative: "The final descent back to Camping HQ is bittersweet in the way that all meaningful endings are. The crew that hiked out twelve days ago and the crew hiking in now are the same people carrying different weight — not in their packs, which are considerably lighter, but in their bearing. The Closing Campfire acknowledges what was done. The Arrowhead Award marks those who completed the trek. But the real award is harder to hang on a wall: the knowledge that when the trail asked something of you, you had it to give."
  }
];

// ── PHOTOS ────────────────────────────────────────
// Add your real photos here.
// url:   direct link to the full-size image
// thumb: link to a smaller thumbnail (can be same as url)
// coords: [longitude, latitude] where the photo was taken
const PHOTOS = [
  {
    day: 2,
    coords: [-104.9150, 36.4920],
    title: "Zastrow Trailhead",
    caption: "Day 2 departure — the trail begins here.",
    url: "",
    thumb: ""
  },
  {
    day: 4,
    coords: [-104.9780, 36.5510],
    title: "Lovers Leap Overlook",
    caption: "First big views south toward the plains.",
    url: "",
    thumb: ""
  },
  {
    day: 5,
    coords: [-104.9960, 36.5820],
    title: "Trail Work",
    caption: "Conservation project on the Black Mountain trail.",
    url: "",
    thumb: ""
  },
  {
    day: 6,
    coords: [-104.9700, 36.6100],
    title: "Big Red",
    caption: "The iconic red rock formation near Divide Camp.",
    url: "",
    thumb: ""
  },
  {
    day: 7,
    coords: [-104.9920, 36.6280],
    title: "Mount Phillips Summit",
    caption: "Nearly 11,700 feet — the high point of the trek.",
    url: "",
    thumb: ""
  },
  {
    day: 11,
    coords: [-104.9330, 36.4990],
    title: "Tooth of Time Summit",
    caption: "The Tooth — visible from 40 miles away.",
    url: "",
    thumb: ""
  }
];

// ── ROUTE COORDINATES ─────────────────────────────
// Approximated from known Philmont geography.
// Replace with coordinates exported from your GPX file
// for a precise trail line. Each entry: [lng, lat].
const FULL_ROUTE = [
  [-104.8989, 36.4635],
  [-104.9010, 36.4680], [-104.9050, 36.4740], [-104.9100, 36.4830],
  [-104.9150, 36.4900], [-104.9180, 36.4960], [-104.9220, 36.5010],
  [-104.9260, 36.5040], [-104.9280, 36.5060],
  [-104.9300, 36.5100], [-104.9340, 36.5160], [-104.9380, 36.5220],
  [-104.9420, 36.5280], [-104.9470, 36.5310], [-104.9520, 36.5340],
  [-104.9560, 36.5370], [-104.9600, 36.5410], [-104.9640, 36.5450],
  [-104.9680, 36.5490], [-104.9720, 36.5530], [-104.9780, 36.5580],
  [-104.9820, 36.5620], [-104.9860, 36.5680], [-104.9890, 36.5730],
  [-104.9920, 36.5780], [-104.9950, 36.5820], [-104.9960, 36.5850],
  [-104.9930, 36.5900], [-104.9880, 36.5960], [-104.9830, 36.6020],
  [-104.9780, 36.6070], [-104.9740, 36.6110], [-104.9700, 36.6140],
  [-104.9750, 36.6200], [-104.9820, 36.6270], [-104.9900, 36.6330],
  [-104.9980, 36.6380], [-105.0060, 36.6400], [-105.0160, 36.6410],
  [-105.0230, 36.6400],
  [-105.0200, 36.6340], [-105.0170, 36.6270], [-105.0140, 36.6200],
  [-105.0120, 36.6120], [-105.0110, 36.6050], [-105.0100, 36.5980],
  [-105.0080, 36.5950], [-105.0060, 36.5920], [-105.0080, 36.5950],
  [-105.0100, 36.5980],
  [-105.0070, 36.5900], [-104.9990, 36.5800], [-104.9900, 36.5700],
  [-104.9800, 36.5600], [-104.9720, 36.5520], [-104.9640, 36.5460],
  [-104.9620, 36.5420],
  [-104.9580, 36.5360], [-104.9530, 36.5290], [-104.9480, 36.5220],
  [-104.9420, 36.5160], [-104.9360, 36.5090], [-104.9310, 36.5030],
  [-104.9300, 36.4990],
  [-104.9270, 36.4940], [-104.9220, 36.4880], [-104.9160, 36.4820],
  [-104.9100, 36.4770], [-104.9040, 36.4710], [-104.8989, 36.4635],
];

// Maps each day to its slice of FULL_ROUTE (start/end index).
// Update these if you add more GPS points to FULL_ROUTE.
const DAY_SEGMENTS = [
  { start: 0,  end: 0  }, // Day 1  — base camp, no hike
  { start: 0,  end: 8  }, // Day 2  — Zastrow TH → Toothache Springs
  { start: 8,  end: 14 }, // Day 3  — Toothache Springs → Magpie
  { start: 14, end: 20 }, // Day 4  — Magpie → Miners Park
  { start: 20, end: 26 }, // Day 5  — Miners Park → Black Mountain
  { start: 26, end: 32 }, // Day 6  — Black Mountain → Divide
  { start: 32, end: 39 }, // Day 7  — Divide → Lamberts Mine
  { start: 39, end: 45 }, // Day 8  — Lamberts Mine → Cimarroncito
  { start: 45, end: 49 }, // Day 9  — Cimarroncito layover loop
  { start: 49, end: 55 }, // Day 10 — Cimarroncito → Clarks Fork
  { start: 55, end: 62 }, // Day 11 — Clarks Fork → Tooth Ridge
  { start: 62, end: 68 }, // Day 12 — Tooth Ridge → Base Camp
];

// ── ELEVATION PROFILE ─────────────────────────────
// Approximate elevations (feet) matching FULL_ROUTE points.
// Replace with elevation data extracted from your GPX file.
const ELEV_PROFILE = [
  6630, 6700, 6900, 7100, 7400, 7600, 7800, 7900, 7960,
  7900, 7750, 7600, 7500, 7470, 7570,
  7600, 7700, 7900, 8200, 8500, 8700, 8800,
  8900, 9100, 9300, 9500, 9580, 9634,
  9600, 9500, 9800, 10200, 10700, 11000, 11150,
  11100, 11200, 11400, 11500, 11600, 11650, 11700, 11000,
  10200, 9400, 8600, 8200, 7900, 7550,
  7500, 7450, 7400, 7350, 7310, 7280, 7300,
  7280, 7260, 7300, 7280,
  7250, 7100, 6950, 6800, 6730, 6690, 6680, 6670,
  6750, 6900, 7100, 7300, 7350, 7400, 7440,
  7500, 7400, 7200, 7000, 6850, 6700, 6630,
];
