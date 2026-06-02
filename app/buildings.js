// Coordinates sourced from OpenStreetMap (Overpass API) — accurate as of 2026
export const UC_BUILDINGS = [
  // --- Academic Buildings ---
  { name: "Aronoff Center", category: "Academic", lng: -84.5187107, lat: 39.1343389 },
  { name: "Arts & Sciences Hall", category: "Academic", lng: -84.5190848, lat: 39.1318708 },
  { name: "Baldwin Hall", category: "Academic", lng: -84.5167338, lat: 39.1328570 },
  { name: "Blegen Hall", category: "Academic", lng: -84.5193133, lat: 39.1295879 },
  { name: "Calhoun Hall", category: "Academic", lng: -84.5170164, lat: 39.1286518 },
  { name: "College of Allied Health and Sciences", category: "Academic", lng: -84.5060634, lat: 39.1394602 },
  { name: "Dabney Hall", category: "Academic", lng: -84.5131316, lat: 39.1316391 },
  { name: "Daniels Hall", category: "Academic", lng: -84.5117840, lat: 39.1314123 },
  { name: "French Hall", category: "Academic", lng: -84.5130415, lat: 39.1324982 },
  { name: "Geology Physics Building", category: "Academic", lng: -84.5184799, lat: 39.1333979 },
  { name: "Memorial Hall", category: "Academic", lng: -84.5171189, lat: 39.1295327 },
  { name: "Rieveschl Hall", category: "Academic", lng: -84.5169843, lat: 39.1340532 },
  { name: "Rhodes Hall", category: "Academic", lng: -84.51593213045288, lat: 39.13330987411229 },
  { name: "Braunstein Hall", category: "Academic", lng: -84.51872233454046, lat: 39.13286965380032 },
  { name: "Clifton Court Hall", category: "Academic", lng: -84.51988104875024, lat: 39.13286757325243 },
  { name: "Schneider Hall", category: "Academic", lng: -84.5122141, lat: 39.1322691 },
  { name: "Scioto Hall", category: "Academic", lng: -84.5120000, lat: 39.1343069 },
  { name: "Swift Hall", category: "Academic", lng: -84.5173983, lat: 39.1324590 },
  { name: "Teachers College", category: "Academic", lng: -84.5191576, lat: 39.1302390 },
  { name: "University Hall", category: "Academic", lng: -84.5084655, lat: 39.1365778 },
  { name: "Van Wormer Hall", category: "Academic", lng: -84.5192521, lat: 39.1307390 },
  { name: "Zimmer Hall", category: "Academic", lng: -84.5168175, lat: 39.1334779 },
  { name: "Morgens Hall", category: "Academic", lng: -84.5119855, lat: 39.1349633 },
  { name: "Alms Building", category: "Academic", lng: -84.5194638, lat: 39.1339502 },

  // --- DAAP ---
  { name: "DAAP (College of Design, Art, Architecture & Planning)", category: "Academic", lng: -84.5186728, lat: 39.1345285 },
  { name: "Computer Graphics Center", category: "Academic", lng: -84.5186473, lat: 39.1342116 },

  // --- CCM (College-Conservatory of Music) ---
  { name: "Patricia Corbett Theatre", category: "Arts & Performance", lng: -84.5187556, lat: 39.1295605 },
  { name: "Corbett Center for Performing Arts", category: "Arts & Performance", lng: -84.5183133, lat: 39.1294953 },
  { name: "Corbett Auditorium", category: "Arts & Performance", lng: -84.5182129, lat: 39.1296273 },
  { name: "Cohen Family Studio Theater", category: "Arts & Performance", lng: -84.5183232, lat: 39.1299271 },
  { name: "Dieterle Vocal Arts Center", category: "Arts & Performance", lng: -84.5168874, lat: 39.1302705 },
  { name: "Probasco Auditorium", category: "Arts & Performance", lng: -84.5207760, lat: 39.1342630 },
  { name: "Mantei Center", category: "Arts & Performance", lng: -84.5155439, lat: 39.1332497 },
  { name: "Rockwern Band Center", category: "Arts & Performance", lng: -84.5139423, lat: 39.1293821 },

  // --- Medical Campus ---
  { name: "Barrett Cancer Center", category: "Medical", lng: -84.5045041, lat: 39.1367405 },
  { name: "Cardiovascular Research Center", category: "Medical", lng: -84.5029684, lat: 39.1384846 },
  { name: "Hoxworth Blood Center", category: "Medical", lng: -84.5017912, lat: 39.1363013 },
  { name: "Logan Hall", category: "Medical", lng: -84.5024073, lat: 39.1391455 },
  { name: "UC Biosciences Center", category: "Medical", lng: -84.5058597, lat: 39.1372953 },
  { name: "UC MRI Center", category: "Medical", lng: -84.5020913, lat: 39.1387270 },
  { name: "UCMC Outpatient", category: "Medical", lng: -84.5019009, lat: 39.1377348 },
  { name: "Vontz Center / French East Building", category: "Medical", lng: -84.5048585, lat: 39.1372363 },
  { name: "UC Physicians Medical Arts Building", category: "Medical", lng: -84.5049671, lat: 39.1365525 },
  { name: "Kettering Lab / Andrew Breidenbach Environmental Research Center", category: "Medical", lng: -84.5109608, lat: 39.1365641 },
  { name: "William Cooper Procter Hall", category: "Medical", lng: -84.5083070, lat: 39.1360118 },

  // --- Libraries ---
  { name: "Langsam Library", category: "Library", lng: -84.51566856049095, lat: 39.13384181132681 },
  { name: "Blegen Library", category: "Library", lng: -84.5193133, lat: 39.1295879 },
  { name: "DAAP Library", category: "Library", lng: -84.5192644, lat: 39.1344516 },
  { name: "CECH Library", category: "Library", lng: -84.5197135, lat: 39.1301685 },
  { name: "Geology-Mathematics-Physics Library", category: "Library", lng: -84.5182510, lat: 39.1329901 },
  { name: "Chemistry-Biology Library", category: "Library", lng: -84.5167116, lat: 39.1339696 },
  { name: "College of Engineering & Applied Science Library", category: "Library", lng: -84.5167741, lat: 39.1330016 },

  // --- Student Life ---
  { name: "Tangeman University Center (TUC)", category: "Student Life", lng: -84.5174707, lat: 39.1315148 },
  { name: "Steger Student Life Center", category: "Student Life", lng: -84.5165363, lat: 39.1323814 },
  { name: "University Pavilion", category: "Student Life", lng: -84.5185613, lat: 39.1309666 },
  { name: "Edwards Center", category: "Student Life", lng: -84.5125101933479, lat: 39.12920644106988 },
  { name: "University Health Services", category: "Student Life", lng: -84.5149533, lat: 39.1311901 },
  { name: "UC Department of Public Safety", category: "Student Life", lng: -84.5124404, lat: 39.1291562 },
  { name: "YMCA University Branch", category: "Student Life", lng: -84.5179440, lat: 39.1286466 },

  // --- Recreation & Athletics ---
  { name: "Armory Fieldhouse", category: "Recreation", lng: -84.5139491, lat: 39.1318310 },
  { name: "Fifth Third Arena", category: "Recreation", lng: -84.51351169821177, lat: 39.13105546016999 },
  { name: "Nippert Stadium", category: "Recreation", lng: -84.51623555614022, lat: 39.13122771301894 },
  { name: "Richard E. Lindner Center", category: "Recreation", lng: -84.5150296, lat: 39.1311624 },
  { name: "Gettler Stadium", category: "Recreation", lng: -84.51549055116931, lat: 39.12920723859705, entrances: [
    { lng: -84.51549055116931, lat: 39.12920723859705 },
    { lng: -84.51641064152886, lat: 39.128851318641324 },
    { lng: -84.5145382838183, lat: 39.12871274708813 },
  ]},
  { name: "Sheakley Lawn", category: "Recreation", lng: -84.51475577506629, lat: 39.130158474696664 },

  // --- Dining & Cafes ---
  { name: "MarketPointe (Dining Hall)", category: "Dining", lng: -84.5171268, lat: 39.1289811 },
  { name: "CenterCourt (Dining Hall)", category: "Dining", lng: -84.5157350, lat: 39.1321427 },
  { name: "Catskellar", category: "Dining", lng: -84.5172353, lat: 39.1315312 },
  { name: "The 86 Coffee Bar at CCM", category: "Dining", lng: -84.5179474, lat: 39.1306383 },
  { name: "DAAP Cafe", category: "Dining", lng: -84.5186728, lat: 39.1345285 },
  { name: "StadiumView Cafe", category: "Dining", lng: -84.5156317, lat: 39.1318285 },
  { name: "Bearcats Café", category: "Dining", lng: -84.5178386, lat: 39.1313576 },
  { name: "On The Green", category: "Dining", lng: -84.5122300, lat: 39.1336042 },
  { name: "Quick Mick's", category: "Dining", lng: -84.5177876, lat: 39.1312655 },
  { name: "Starbucks (TUC)", category: "Dining", lng: -84.5171405, lat: 39.1280480 },
  { name: "Starbucks (Langsam)", category: "Dining", lng: -84.5155713, lat: 39.1339418 },
  { name: "Starbucks (French Hall)", category: "Dining", lng: -84.5141905, lat: 39.1335915 },
  { name: "Chick-fil-A", category: "Dining", lng: -84.5174611, lat: 39.1319006 },
  { name: "Panda Express", category: "Dining", lng: -84.5174689, lat: 39.1318365 },
  { name: "Qdoba", category: "Dining", lng: -84.5174922, lat: 39.1316445 },
  { name: "Subway", category: "Dining", lng: -84.5167762, lat: 39.1322495 },
  { name: "Conscious Kitchen", category: "Dining", lng: -84.5089686, lat: 39.1334631 },
  { name: "Tim Hortons", category: "Dining", lng: -84.5121285, lat: 39.1334062 },
  { name: "Einstein Bros. Bagels", category: "Dining", lng: -84.5196557, lat: 39.1419176 },

  // --- Residence Halls ---
  { name: "Calhoun Hall (Residence)", category: "Housing", lng: -84.5170164, lat: 39.1286518 },
  { name: "Morgens Hall (Residence)", category: "Housing", lng: -84.5119855, lat: 39.1349633 },
  { name: "Scioto Hall (Residence)", category: "Housing", lng: -84.5120000, lat: 39.1343069 },
  { name: "Sidall Hall", category: "Housing", lng: -84.5176907, lat: 39.1289970 },
  { name: "University Park Apartments North", category: "Housing", lng: -84.5139258, lat: 39.1289660 },
  { name: "University Park Apartments South", category: "Housing", lng: -84.5151872, lat: 39.1284260 },
  { name: "Stratford Heights", category: "Housing", lng: -84.5213601, lat: 39.1308667 },

  // --- Parking ---
  { name: "Campus Green Garage", category: "Parking", lng: -84.5144030, lat: 39.1349637 },
  { name: "CCM Garage", category: "Parking", lng: -84.5172101, lat: 39.1300173 },
  { name: "Varsity Village Garage", category: "Parking", lng: -84.5159317, lat: 39.1301692 },
  { name: "University Avenue Garage", category: "Parking", lng: -84.5114653, lat: 39.1342648 },
  { name: "Stratford Heights Garage", category: "Parking", lng: -84.5213601, lat: 39.1308667 },
  { name: "Eden Avenue Garage", category: "Parking", lng: -84.5060929, lat: 39.1380864 },
  { name: "Goodman Street Garage", category: "Parking", lng: -84.5030536, lat: 39.1363966 },
];

const CATEGORY_COLORS = {
  "Academic": "🎓",
  "Arts & Performance": "🎭",
  "Medical": "🏥",
  "Library": "📚",
  "Student Life": "🐾",
  "Recreation": "🏟️",
  "Dining": "🍽️",
  "Housing": "🏠",
  "Parking": "🅿️",
};

export function searchBuildings(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return UC_BUILDINGS.filter(b =>
    b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
  ).slice(0, 8);
}

export { CATEGORY_COLORS };
