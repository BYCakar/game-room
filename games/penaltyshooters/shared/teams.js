// Original fantasy leagues and kit palette from Penalty Shooters 2 public data.
// Turkey uses the 2026-2027 TFF tables checked on 2026-11-12; see
// ../client/assets/README.md for the selection rule and sources.
export const PATTERNS = Object.freeze([
  {
    "id": "s01",
    "name": "Vertical stripes"
  },
  {
    "id": "s02",
    "name": "Horizontal stripes"
  },
  {
    "id": "s03",
    "name": "Plain"
  },
  {
    "id": "s04",
    "name": "Halves"
  },
  {
    "id": "s05",
    "name": "Diagonal sash"
  },
  {
    "id": "s06",
    "name": "Contrast sleeves"
  },
  {
    "id": "s07",
    "name": "Chest band"
  },
  {
    "id": "s08",
    "name": "Center stripe"
  },
  {
    "id": "s09",
    "name": "Shoulder bands"
  },
  {
    "id": "s10",
    "name": "Checks"
  },
  {
    "id": "s11",
    "name": "Cross"
  },
  {
    "id": "s13",
    "name": "Side stripes"
  },
  {
    "id": "s14",
    "name": "Sleeve and chest bands"
  }
]);

export const KIT_COLOURS = Object.freeze(["#ffffff", "#e50000", "#0000b2", "#ffff00", "#0099cc", "#cc6633", "#cc99cc", "#7f1a38", "#33cc33", "#6600cc", "#003366", "#000000", "#820f14", "#336633", "#66ccff", "#cccccc", "#ffffcc", "#ffcc99", "#ffcc66", "#660000", "#63f561"]);

export const DEFAULT_TEAM = Object.freeze({name: "My Team", primary: "#e52235", secondary: "#ffffff", shorts: "#182844", pattern: "s03"});

export const LEAGUES = [
  {
    "id": "england",
    "name": "England",
    "flag": "🏴",
    "teams": [
      {
        "id": "england-1",
        "name": "CANNON WOW",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 90
      },
      {
        "id": "england-2",
        "name": "HOBGOBLINS",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "england-3",
        "name": "CHEESE UTD",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "england-4",
        "name": "MEANBORO",
        "primary": "#000000",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "england-5",
        "name": "SPOORS",
        "primary": "#0000b2",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "england-6",
        "name": "TOFFEES",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 42
      },
      {
        "id": "england-7",
        "name": "REDS DIVIDED",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "england-8",
        "name": "MAGPIES",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "england-9",
        "name": "BAGGIES",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 51
      },
      {
        "id": "england-10",
        "name": "POTTERS",
        "primary": "#7f1a38",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "england-11",
        "name": "RIVERSIDERS",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s04",
        "rating": 53
      },
      {
        "id": "england-12",
        "name": "SEASIDERS",
        "primary": "#33cc33",
        "secondary": "#cc6633",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "england-13",
        "name": "BLUENOSES",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s09",
        "rating": 66
      },
      {
        "id": "england-14",
        "name": "VILLAINS",
        "primary": "#336633",
        "secondary": "#7f1a38",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 53
      },
      {
        "id": "england-15",
        "name": "COTTAGERS",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "england-16",
        "name": "LATICS",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s13",
        "rating": 68
      },
      {
        "id": "england-17",
        "name": "WOLFORN",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "england-18",
        "name": "MALLETS",
        "primary": "#66ccff",
        "secondary": "#7f1a38",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 57
      },
      {
        "id": "england-19",
        "name": "BLACK CATS",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 46
      },
      {
        "id": "england-20",
        "name": "HOOPS",
        "primary": "#cc99cc",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 58
      },
      {
        "id": "england-21",
        "name": "BLUE BIRDS",
        "primary": "#7f1a38",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "england-22",
        "name": "JACKS",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "england-23",
        "name": "YELLOW BIRDIES",
        "primary": "#ffff00",
        "secondary": "#33cc33",
        "shorts": "#ffff00",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "england-24",
        "name": "SKY BLUES",
        "primary": "#003366",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "england-25",
        "name": "WHITES",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "england-26",
        "name": "RAMS",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "england-27",
        "name": "TROTTERS",
        "primary": "#0000b2",
        "secondary": "#33cc33",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 59
      },
      {
        "id": "england-28",
        "name": "CLARETS",
        "primary": "#e50000",
        "secondary": "#7f1a38",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 47
      },
      {
        "id": "england-29",
        "name": "TREES",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "england-30",
        "name": "HORNETS",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s13",
        "rating": 58
      },
      {
        "id": "england-31",
        "name": "LIONS",
        "primary": "#003366",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "england-32",
        "name": "DONNYR",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 43
      }
    ]
  },
  {
    "id": "spain",
    "name": "Spain",
    "flag": "🇪🇸",
    "teams": [
      {
        "id": "spain-1",
        "name": "BLANKOS X",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "spain-2",
        "name": "BLAUGRANES",
        "primary": "#ffffff",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s01",
        "rating": 90
      },
      {
        "id": "spain-3",
        "name": "ATLETISMO",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 80
      },
      {
        "id": "spain-4",
        "name": "ILICANTOS",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "spain-5",
        "name": "LEHOIAK",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 75
      },
      {
        "id": "spain-6",
        "name": "HISPALENSES",
        "primary": "#0099cc",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 70
      },
      {
        "id": "spain-7",
        "name": "PERIQUITOS",
        "primary": "#ffffff",
        "secondary": "#cc99cc",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "spain-8",
        "name": "SUBMARINO",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "spain-9",
        "name": "TXURI URDINAK",
        "primary": "#0099cc",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 59
      },
      {
        "id": "spain-10",
        "name": "MANOS",
        "primary": "#0000b2",
        "secondary": "#0099cc",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 57
      },
      {
        "id": "spain-11",
        "name": "VERDIBLANCOS",
        "primary": "#e50000",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "spain-12",
        "name": "CELESTES",
        "primary": "#ffffff",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "spain-13",
        "name": "CALIFAS",
        "primary": "#66ccff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 59
      },
      {
        "id": "spain-14",
        "name": "TURCOS",
        "primary": "#cc6633",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 56
      },
      {
        "id": "spain-15",
        "name": "ARMEROS",
        "primary": "#0000b2",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s01",
        "rating": 50
      },
      {
        "id": "spain-16",
        "name": "AZULONES",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "spain-17",
        "name": "NAZARIES",
        "primary": "#cc99cc",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s02",
        "rating": 61
      },
      {
        "id": "spain-18",
        "name": "GRANOTAS",
        "primary": "#7f1a38",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "spain-19",
        "name": "BOQUERONES",
        "primary": "#66ccff",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 66
      },
      {
        "id": "spain-20",
        "name": "FRANJIRROJOS",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s05",
        "rating": 42
      },
      {
        "id": "spain-21",
        "name": "PIMENTONEROS",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s13",
        "rating": 68
      },
      {
        "id": "spain-22",
        "name": "PUCELANOS",
        "primary": "#ffff00",
        "secondary": "#6600cc",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 58
      },
      {
        "id": "spain-23",
        "name": "TETE",
        "primary": "#ffffff",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "spain-24",
        "name": "ROJIBLANCOS",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 65
      },
      {
        "id": "spain-25",
        "name": "GORRITXOAK",
        "primary": "#003366",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "spain-26",
        "name": "UNION AMARILLA",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "spain-27",
        "name": "BERMELLONES",
        "primary": "#0000b2",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "spain-28",
        "name": "RECRE DECANO",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 47
      },
      {
        "id": "spain-29",
        "name": "RACINGUISTAS",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 49
      },
      {
        "id": "spain-30",
        "name": "QUESO MECANICO",
        "primary": "#ffff00",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 58
      },
      {
        "id": "spain-31",
        "name": "NOOMANTINO",
        "primary": "#6600cc",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "spain-32",
        "name": "PEPINILLOS",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 43
      }
    ]
  },
  {
    "id": "global",
    "name": "Global Cup",
    "flag": "🌍",
    "teams": [
      {
        "id": "global-1",
        "name": "Mexico",
        "primary": "#33cc33",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "global-2",
        "name": "South Africa",
        "primary": "#ffff00",
        "secondary": "#ffcc66",
        "shorts": "#336633",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "global-3",
        "name": "Korea Republic",
        "primary": "#e50000",
        "secondary": "#7f1a38",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 50
      },
      {
        "id": "global-4",
        "name": "Czechia",
        "primary": "#820f14",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-5",
        "name": "Canada",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-6",
        "name": "Bosnia & Herzegovina",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 40
      },
      {
        "id": "global-7",
        "name": "Qatar",
        "primary": "#820f14",
        "secondary": "#820f14",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-8",
        "name": "Switzerland",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "global-9",
        "name": "Brazil",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "global-10",
        "name": "Morocco",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-11",
        "name": "Haiti",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 40
      },
      {
        "id": "global-12",
        "name": "Scotland",
        "primary": "#003366",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-13",
        "name": "United States",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 55
      },
      {
        "id": "global-14",
        "name": "Australia",
        "primary": "#ffcc66",
        "secondary": "#ffcc66",
        "shorts": "#336633",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-15",
        "name": "Paraguay",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 55
      },
      {
        "id": "global-16",
        "name": "Turkey",
        "primary": "#ffffff",
        "secondary": "#820f14",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 60
      },
      {
        "id": "global-17",
        "name": "Germany",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s09",
        "rating": 90
      },
      {
        "id": "global-18",
        "name": "Curacao",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 40
      },
      {
        "id": "global-19",
        "name": "Ivory Coast",
        "primary": "#cc6633",
        "secondary": "#cc6633",
        "shorts": "#cc6633",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-20",
        "name": "Ecuador",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-21",
        "name": "Netherlands",
        "primary": "#cc6633",
        "secondary": "#cc6633",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "global-22",
        "name": "Japan",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "global-23",
        "name": "Sweden",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "global-24",
        "name": "Tunisia",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-25",
        "name": "Belgium",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "global-26",
        "name": "Egypt",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-27",
        "name": "Iran",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-28",
        "name": "New Zealand",
        "primary": "#000000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-29",
        "name": "Spain",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#003366",
        "pattern": "s06",
        "rating": 80
      },
      {
        "id": "global-30",
        "name": "Cabo Verde",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 40
      },
      {
        "id": "global-31",
        "name": "Saudi Arabia",
        "primary": "#336633",
        "secondary": "#336633",
        "shorts": "#336633",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-32",
        "name": "Uruguay",
        "primary": "#66ccff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "global-33",
        "name": "France",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "global-34",
        "name": "Senegal",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-35",
        "name": "Iraq",
        "primary": "#33cc33",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-36",
        "name": "Norway",
        "primary": "#e50000",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s11",
        "rating": 50
      },
      {
        "id": "global-37",
        "name": "Argentina",
        "primary": "#66ccff",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 85
      },
      {
        "id": "global-38",
        "name": "Algeria",
        "primary": "#ffffff",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-39",
        "name": "Austria",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "global-40",
        "name": "Jordan",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-41",
        "name": "Portugal",
        "primary": "#820f14",
        "secondary": "#820f14",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 70
      },
      {
        "id": "global-42",
        "name": "Congo DR",
        "primary": "#66ccff",
        "secondary": "#66ccff",
        "shorts": "#66ccff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-43",
        "name": "Uzbekistan",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "global-44",
        "name": "Colombia",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "global-45",
        "name": "England",
        "primary": "#ffffff",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "global-46",
        "name": "Croatia",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s10",
        "rating": 60
      },
      {
        "id": "global-47",
        "name": "Ghana",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "global-48",
        "name": "Panama",
        "primary": "#e50000",
        "secondary": "#003366",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 45
      }
    ]
  },
  {
    "id": "italy",
    "name": "Italy",
    "flag": "🇮🇹",
    "teams": [
      {
        "id": "italy-1",
        "name": "VECCHIO SIGNORE",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 90
      },
      {
        "id": "italy-2",
        "name": "GIALLONERI",
        "primary": "#ffff00",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 90
      },
      {
        "id": "italy-3",
        "name": "MILANESE FELICE ",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 85
      },
      {
        "id": "italy-4",
        "name": "ROMANISTI",
        "primary": "#000000",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "italy-5",
        "name": "VIOLA VERDE",
        "primary": "#33cc33",
        "secondary": "#6600cc",
        "shorts": "#6600cc",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "italy-6",
        "name": "LAZIALI RICCHI",
        "primary": "#336633",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 59
      },
      {
        "id": "italy-7",
        "name": "GRANDE N",
        "primary": "#0000b2",
        "secondary": "#0099cc",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "italy-8",
        "name": "TORO GRANATA",
        "primary": "#003366",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 46
      },
      {
        "id": "italy-9",
        "name": "CROCI BLU",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 62
      },
      {
        "id": "italy-10",
        "name": "BOLO VELTRI",
        "primary": "#0000b2",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s04",
        "rating": 51
      },
      {
        "id": "italy-11",
        "name": "ATALANTIS",
        "primary": "#0099cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 53
      },
      {
        "id": "italy-12",
        "name": "GRIFONE",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s04",
        "rating": 61
      },
      {
        "id": "italy-13",
        "name": "ZEBRETTE",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "italy-14",
        "name": "CASTEDDU",
        "primary": "#cc99cc",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s04",
        "rating": 66
      },
      {
        "id": "italy-15",
        "name": "ROSANERO",
        "primary": "#7f1a38",
        "secondary": "#cc99cc",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 42
      },
      {
        "id": "italy-16",
        "name": "HELLO VARANO",
        "primary": "#e50000",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "italy-17",
        "name": "PARMESAN",
        "primary": "#33cc33",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "italy-18",
        "name": "GALLETTI",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 68
      },
      {
        "id": "italy-19",
        "name": "BERICI",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "italy-20",
        "name": "RONDINELLE",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s08",
        "rating": 57
      },
      {
        "id": "italy-21",
        "name": "AMARANTO",
        "primary": "#003366",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "italy-22",
        "name": "ELEFANTI",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "italy-23",
        "name": "SPEZIALE",
        "primary": "#003366",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "italy-24",
        "name": "CASANA",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "italy-25",
        "name": "MUSSI",
        "primary": "#ffff00",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s06",
        "rating": 61
      },
      {
        "id": "italy-26",
        "name": "EMPAL",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "italy-27",
        "name": "CANARINI",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "italy-28",
        "name": "PERU",
        "primary": "#000000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 47
      },
      {
        "id": "italy-29",
        "name": "SASSI",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 49
      },
      {
        "id": "italy-30",
        "name": "TORRE PISA",
        "primary": "#ffff00",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 58
      },
      {
        "id": "italy-31",
        "name": "TERNI",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 50
      },
      {
        "id": "italy-32",
        "name": "LUPI AVE",
        "primary": "#cc6633",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 43
      }
    ]
  },
  {
    "id": "france",
    "name": "France",
    "flag": "🇫🇷",
    "teams": [
      {
        "id": "france-1",
        "name": "GERMS",
        "primary": "#0000b2",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 91
      },
      {
        "id": "france-2",
        "name": "PRINCIPAUTE",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s14",
        "rating": 90
      },
      {
        "id": "france-3",
        "name": "FLAQUES",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "france-4",
        "name": "VERDANS",
        "primary": "#6600cc",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 87
      },
      {
        "id": "france-5",
        "name": "GONEX",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s05",
        "rating": 89
      },
      {
        "id": "france-6",
        "name": "OLYMPY NS",
        "primary": "#ffffff",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "france-7",
        "name": "GEEROND 09",
        "primary": "#000000",
        "secondary": "#ffffff",
        "shorts": "#003366",
        "pattern": "s09",
        "rating": 80
      },
      {
        "id": "france-8",
        "name": "THONS",
        "primary": "#cc99cc",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "france-9",
        "name": "TEFEXE SC",
        "primary": "#33cc33",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 70
      },
      {
        "id": "france-10",
        "name": "TURCHINI",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "france-11",
        "name": "RIMSE",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 46
      },
      {
        "id": "france-12",
        "name": "R-NOIRIS",
        "primary": "#0000b2",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 70
      },
      {
        "id": "france-13",
        "name": "CANARZO",
        "primary": "#6600cc",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s01",
        "rating": 51
      },
      {
        "id": "france-14",
        "name": "PARRESEUX",
        "primary": "#cc6633",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "france-15",
        "name": "PAILLADE",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#cc6633",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "france-16",
        "name": "GUING GONG",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "france-17",
        "name": "NIZZOR 09",
        "primary": "#0099cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 52
      },
      {
        "id": "france-18",
        "name": "SCHXY",
        "primary": "#0000b2",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 68
      },
      {
        "id": "france-19",
        "name": "ATHENIANS",
        "primary": "#cc6633",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "france-20",
        "name": "L'OURS",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 57
      },
      {
        "id": "france-21",
        "name": "REDGRAIN",
        "primary": "#336633",
        "secondary": "#820f14",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "france-22",
        "name": "SANGOR",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "france-23",
        "name": "NORMANS",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 65
      },
      {
        "id": "france-24",
        "name": "THORNEX",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#ffffff",
        "pattern": "s13",
        "rating": 55
      },
      {
        "id": "france-25",
        "name": "CHEVRES 99",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s05",
        "rating": 61
      },
      {
        "id": "france-26",
        "name": "MUSTARDS",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "france-27",
        "name": "BRAST",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "france-28",
        "name": "TOURIST",
        "primary": "#ffffff",
        "secondary": "#0099cc",
        "shorts": "#0099cc",
        "pattern": "s03",
        "rating": 47
      },
      {
        "id": "france-29",
        "name": "SCOISTES",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "france-30",
        "name": "DESPERANCE",
        "primary": "#cc6633",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "france-31",
        "name": "DOYEN",
        "primary": "#cc99cc",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s04",
        "rating": 50
      },
      {
        "id": "france-32",
        "name": "AGE MOYEN",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 43
      }
    ]
  },
  {
    "id": "brazil",
    "name": "Brazil",
    "flag": "🇧🇷",
    "teams": [
      {
        "id": "brazil-1",
        "name": "TRICOLOR F",
        "primary": "#6600cc",
        "secondary": "#820f14",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 91
      },
      {
        "id": "brazil-2",
        "name": "MENGAO",
        "primary": "#820f14",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 90
      },
      {
        "id": "brazil-3",
        "name": "IMORTAL",
        "primary": "#003366",
        "secondary": "#0099cc",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 85
      },
      {
        "id": "brazil-4",
        "name": "COLORIDA",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 87
      },
      {
        "id": "brazil-5",
        "name": "TIMAO",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 89
      },
      {
        "id": "brazil-6",
        "name": "GALO",
        "primary": "#820f14",
        "secondary": "#33cc33",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 80
      },
      {
        "id": "brazil-7",
        "name": "FURACO",
        "primary": "#ffff00",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 80
      },
      {
        "id": "brazil-8",
        "name": "BAHIACO",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "brazil-9",
        "name": "FLECHA",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 70
      },
      {
        "id": "brazil-10",
        "name": "VERDAO CHEP",
        "primary": "#cc99cc",
        "secondary": "#cc6633",
        "shorts": "#cc6633",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "brazil-11",
        "name": "JOELHO BRANCO",
        "primary": "#0000b2",
        "secondary": "#33cc33",
        "shorts": "#000000",
        "pattern": "s07",
        "rating": 46
      },
      {
        "id": "brazil-12",
        "name": "TIGR",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 70
      },
      {
        "id": "brazil-13",
        "name": "RAPOSA",
        "primary": "#cc99cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s09",
        "rating": 51
      },
      {
        "id": "brazil-14",
        "name": "FIGY",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "brazil-15",
        "name": "ESMERALDA 05",
        "primary": "#cc99cc",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "brazil-16",
        "name": "ALVIVERDE",
        "primary": "#000000",
        "secondary": "#336633",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "brazil-17",
        "name": "PEIXE",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "brazil-18",
        "name": "TRICOLOR",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 68
      },
      {
        "id": "brazil-19",
        "name": "LEAO AZUL",
        "primary": "#ffff00",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 61
      },
      {
        "id": "brazil-20",
        "name": "VIBT",
        "primary": "#0099cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 57
      },
      {
        "id": "brazil-21",
        "name": "NAVARCA",
        "primary": "#336633",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s05",
        "rating": 58
      },
      {
        "id": "brazil-22",
        "name": "CERA",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "brazil-23",
        "name": "TIMBUU",
        "primary": "#cc99cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 65
      },
      {
        "id": "brazil-24",
        "name": "ABCD",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 55
      },
      {
        "id": "brazil-25",
        "name": "COELHINHO",
        "primary": "#820f14",
        "secondary": "#33cc33",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "brazil-26",
        "name": "COBRA ATOL",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 60
      },
      {
        "id": "brazil-27",
        "name": "DRAGAO",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 49
      },
      {
        "id": "brazil-28",
        "name": "LAUS",
        "primary": "#0000b2",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 47
      },
      {
        "id": "brazil-29",
        "name": "MACACA",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s05",
        "rating": 49
      },
      {
        "id": "brazil-30",
        "name": "ICSY",
        "primary": "#6600cc",
        "secondary": "#ffffff",
        "shorts": "#33cc33",
        "pattern": "s04",
        "rating": 58
      },
      {
        "id": "brazil-31",
        "name": "ANTA",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 50
      },
      {
        "id": "brazil-32",
        "name": "DESCALCO",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 43
      }
    ]
  },
  {
    "id": "turkey",
    "name": "Turkey",
    "flag": "🇹🇷",
    "teams": [
      {
        "id": "turkey-galatasaray",
        "name": "Galatasaray",
        "primary": "#d71920",
        "secondary": "#ffcc00",
        "shorts": "#ffffff",
        "pattern": "s04",
        "rating": 95
      },
      {
        "id": "turkey-trabzonspor",
        "name": "Trabzonspor",
        "primary": "#7a183b",
        "secondary": "#6bbde9",
        "shorts": "#7a183b",
        "pattern": "s01",
        "rating": 89
      },
      {
        "id": "turkey-besiktas",
        "name": "Beşiktaş",
        "primary": "#ffffff",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 89
      },
      {
        "id": "turkey-kasimpasa",
        "name": "Kasımpaşa",
        "primary": "#12264d",
        "secondary": "#ffffff",
        "shorts": "#12264d",
        "pattern": "s01",
        "rating": 77
      },
      {
        "id": "turkey-fenerbahce",
        "name": "Fenerbahçe",
        "primary": "#ffdf00",
        "secondary": "#14244d",
        "shorts": "#14244d",
        "pattern": "s01",
        "rating": 94
      },
      {
        "id": "turkey-kocaelispor",
        "name": "Kocaelispor",
        "primary": "#008447",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 75
      },
      {
        "id": "turkey-basaksehir",
        "name": "İstanbul Başakşehir",
        "primary": "#f58025",
        "secondary": "#172b50",
        "shorts": "#172b50",
        "pattern": "s06",
        "rating": 80
      },
      {
        "id": "turkey-corum",
        "name": "Çorum FK",
        "primary": "#ce1b2d",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 73
      },
      {
        "id": "turkey-goztepe",
        "name": "Göztepe",
        "primary": "#e32228",
        "secondary": "#ffcf00",
        "shorts": "#111111",
        "pattern": "s04",
        "rating": 79
      },
      {
        "id": "turkey-rizespor",
        "name": "Çaykur Rizespor",
        "primary": "#0066b3",
        "secondary": "#009b55",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 75
      },
      {
        "id": "turkey-erzurumspor",
        "name": "Erzurumspor FK",
        "primary": "#79c5e8",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 72
      },
      {
        "id": "turkey-alanyaspor",
        "name": "Alanyaspor",
        "primary": "#f47b20",
        "secondary": "#138747",
        "shorts": "#138747",
        "pattern": "s01",
        "rating": 73
      },
      {
        "id": "turkey-genclerbirligi",
        "name": "Gençlerbirliği",
        "primary": "#d51c2b",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 71
      },
      {
        "id": "turkey-konyaspor",
        "name": "Konyaspor",
        "primary": "#007b43",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 74
      },
      {
        "id": "turkey-gaziantep",
        "name": "Gaziantep FK",
        "primary": "#dc182b",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 73
      },
      {
        "id": "turkey-samsunspor",
        "name": "Samsunspor",
        "primary": "#e21b2c",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 78
      },
      {
        "id": "turkey-eyupspor",
        "name": "Eyüpspor",
        "primary": "#6a2a85",
        "secondary": "#ffdd00",
        "shorts": "#6a2a85",
        "pattern": "s06",
        "rating": 70
      },
      {
        "id": "turkey-bursaspor",
        "name": "Bursaspor",
        "primary": "#008b52",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 73
      },
      {
        "id": "turkey-kayserispor",
        "name": "Kayserispor",
        "primary": "#e51c23",
        "secondary": "#ffcf00",
        "shorts": "#e51c23",
        "pattern": "s04",
        "rating": 72
      },
      {
        "id": "turkey-igdir",
        "name": "Iğdır FK",
        "primary": "#168b4a",
        "secondary": "#ffffff",
        "shorts": "#168b4a",
        "pattern": "s01",
        "rating": 68
      },
      {
        "id": "turkey-mardin1969",
        "name": "Mardin 1969 Spor",
        "primary": "#d82332",
        "secondary": "#1a2957",
        "shorts": "#1a2957",
        "pattern": "s01",
        "rating": 66
      },
      {
        "id": "turkey-batmanpetrolspor",
        "name": "Batman Petrolspor",
        "primary": "#da1a29",
        "secondary": "#ffffff",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 66
      },
      {
        "id": "turkey-keciorengucu",
        "name": "Ankara Keçiörengücü",
        "primary": "#713b87",
        "secondary": "#ffffff",
        "shorts": "#713b87",
        "pattern": "s01",
        "rating": 67
      },
      {
        "id": "turkey-bodrum",
        "name": "Bodrum FK",
        "primary": "#087b40",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 68
      },
      {
        "id": "turkey-antalyaspor",
        "name": "Antalyaspor",
        "primary": "#e41d2d",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 71
      },
      {
        "id": "turkey-karagumruk",
        "name": "Fatih Karagümrük",
        "primary": "#cf1628",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 69
      },
      {
        "id": "turkey-erokspor",
        "name": "Esenler Erokspor",
        "primary": "#ffe500",
        "secondary": "#159347",
        "shorts": "#159347",
        "pattern": "s01",
        "rating": 65
      },
      {
        "id": "turkey-muglaspor",
        "name": "Muğlaspor",
        "primary": "#138647",
        "secondary": "#ffffff",
        "shorts": "#138647",
        "pattern": "s01",
        "rating": 63
      },
      {
        "id": "turkey-umraniyespor",
        "name": "Ümraniyespor",
        "primary": "#e52330",
        "secondary": "#ffffff",
        "shorts": "#e52330",
        "pattern": "s01",
        "rating": 66
      },
      {
        "id": "turkey-sariyer",
        "name": "Sarıyer",
        "primary": "#193c78",
        "secondary": "#ffffff",
        "shorts": "#193c78",
        "pattern": "s01",
        "rating": 64
      },
      {
        "id": "turkey-vanspor",
        "name": "Van Spor FK",
        "primary": "#ce1927",
        "secondary": "#111111",
        "shorts": "#111111",
        "pattern": "s01",
        "rating": 64
      },
      {
        "id": "turkey-bandirmaspor",
        "name": "Bandırmaspor",
        "primary": "#7c183b",
        "secondary": "#ffffff",
        "shorts": "#7c183b",
        "pattern": "s01",
        "rating": 65
      }
    ]
  },
  {
    "id": "northamerica",
    "name": "North America",
    "flag": "🇺🇸",
    "teams": [
      {
        "id": "northamerica-1",
        "name": "CHIC WATER",
        "primary": "#7f1a38",
        "secondary": "#003366",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "northamerica-2",
        "name": "COOL CREW",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "northamerica-3",
        "name": "DC UNITS",
        "primary": "#003366",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "northamerica-4",
        "name": "MONT CLASH",
        "primary": "#ffffff",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "northamerica-5",
        "name": "NE REVOLT",
        "primary": "#e50000",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "northamerica-6",
        "name": "NY VILLAGE",
        "primary": "#000000",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 59
      },
      {
        "id": "northamerica-7",
        "name": "RED COWS",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#e50000",
        "pattern": "s06",
        "rating": 46
      },
      {
        "id": "northamerica-8",
        "name": "RENALDO CITY",
        "primary": "#33cc33",
        "secondary": "#6600cc",
        "shorts": "#6600cc",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "northamerica-9",
        "name": "PHILLY UNIQUE",
        "primary": "#e50000",
        "secondary": "#ffcc66",
        "shorts": "#003366",
        "pattern": "s08",
        "rating": 51
      },
      {
        "id": "northamerica-10",
        "name": "QUEEN CITY",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "northamerica-11",
        "name": "COLOR SLUGS",
        "primary": "#ffff00",
        "secondary": "#820f14",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 53
      },
      {
        "id": "northamerica-12",
        "name": "BIG D FANS",
        "primary": "#33cc33",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "northamerica-13",
        "name": "HSTN DUNE",
        "primary": "#0099cc",
        "secondary": "#cc6633",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "northamerica-14",
        "name": "GALAXIANS UTD",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 66
      },
      {
        "id": "northamerica-15",
        "name": "PORT LUMBERS",
        "primary": "#cc6633",
        "secondary": "#ffffff",
        "shorts": "#33cc33",
        "pattern": "s09",
        "rating": 42
      },
      {
        "id": "northamerica-16",
        "name": "SWEET LAKE",
        "primary": "#000000",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s06",
        "rating": 53
      },
      {
        "id": "northamerica-17",
        "name": "JOSE'S SON",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#000000",
        "pattern": "s06",
        "rating": 52
      },
      {
        "id": "northamerica-18",
        "name": "SILENCERS",
        "primary": "#0099cc",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 68
      },
      {
        "id": "northamerica-19",
        "name": "SPORT THING",
        "primary": "#000000",
        "secondary": "#66ccff",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "northamerica-20",
        "name": "BLACKHATS",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 57
      },
      {
        "id": "northamerica-21",
        "name": "SILVERHEADS",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s06",
        "rating": 58
      },
      {
        "id": "northamerica-22",
        "name": "RAILPIGEONS",
        "primary": "#0099cc",
        "secondary": "#cc6633",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "northamerica-23",
        "name": "ED MOON",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "northamerica-24",
        "name": "FT LAUD STREAKERS",
        "primary": "#ffff00",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 55
      },
      {
        "id": "northamerica-25",
        "name": "INDY 12",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "northamerica-26",
        "name": "JACKSON ARMY",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 60
      },
      {
        "id": "northamerica-27",
        "name": "MIN DIVIDED",
        "primary": "#336633",
        "secondary": "#66ccff",
        "shorts": "#66ccff",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "northamerica-28",
        "name": "NY COMICS",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 47
      },
      {
        "id": "northamerica-29",
        "name": "OTTAWA JOY",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s13",
        "rating": 49
      },
      {
        "id": "northamerica-30",
        "name": "ST PIONS",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s07",
        "rating": 58
      },
      {
        "id": "northamerica-31",
        "name": "TAMP NERDS",
        "primary": "#0000b2",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s02",
        "rating": 50
      },
      {
        "id": "northamerica-32",
        "name": "MIAMI BICE",
        "primary": "#e50000",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 43
      }
    ]
  },
  {
    "id": "argentina",
    "name": "Argentina",
    "flag": "🇦🇷",
    "teams": [
      {
        "id": "argentina-1",
        "name": "DIRECTORES",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s05",
        "rating": 80
      },
      {
        "id": "argentina-2",
        "name": "XENAZES",
        "primary": "#000000",
        "secondary": "#ffff00",
        "shorts": "#003366",
        "pattern": "s07",
        "rating": 80
      },
      {
        "id": "argentina-3",
        "name": "SANTO SUERVO",
        "primary": "#ffffff",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s01",
        "rating": 78
      },
      {
        "id": "argentina-4",
        "name": "INDY ROJO",
        "primary": "#cc6633",
        "secondary": "#ffffff",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 75
      },
      {
        "id": "argentina-5",
        "name": "ACADENZA",
        "primary": "#820f14",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 70
      },
      {
        "id": "argentina-6",
        "name": "FORTIN",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s09",
        "rating": 69
      },
      {
        "id": "argentina-7",
        "name": "PINCHORAT",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 68
      },
      {
        "id": "argentina-8",
        "name": "TRIPEROS",
        "primary": "#e50000",
        "secondary": "#003366",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 67
      },
      {
        "id": "argentina-9",
        "name": "GLOBO",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 66
      },
      {
        "id": "argentina-10",
        "name": "LEPRA BOYS",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s04",
        "rating": 65
      },
      {
        "id": "argentina-11",
        "name": "CANALLA",
        "primary": "#e50000",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s01",
        "rating": 64
      },
      {
        "id": "argentina-12",
        "name": "BICHO",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#e50000",
        "pattern": "s05",
        "rating": 63
      },
      {
        "id": "argentina-13",
        "name": "MATADORES",
        "primary": "#0099cc",
        "secondary": "#e50000",
        "shorts": "#0000b2",
        "pattern": "s07",
        "rating": 59
      },
      {
        "id": "argentina-14",
        "name": "SANTO",
        "primary": "#ffff00",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 57
      },
      {
        "id": "argentina-15",
        "name": "TOMBA",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 56
      },
      {
        "id": "argentina-16",
        "name": "PIRATAS",
        "primary": "#820f14",
        "secondary": "#66ccff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 55
      },
      {
        "id": "argentina-17",
        "name": "TIBURON",
        "primary": "#ffffff",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s01",
        "rating": 55
      },
      {
        "id": "argentina-18",
        "name": "LAN GRANATE",
        "primary": "#003366",
        "secondary": "#003366",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "argentina-19",
        "name": "HALCON",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "argentina-20",
        "name": "AURINEGRO",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 48
      },
      {
        "id": "argentina-21",
        "name": "FER VERDOLAGA",
        "primary": "#cc6633",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "argentina-22",
        "name": "CALAMARES",
        "primary": "#e50000",
        "secondary": "#660000",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 45
      },
      {
        "id": "argentina-23",
        "name": "TALADRO",
        "primary": "#ffff00",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-24",
        "name": "FUNEBREROS",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-25",
        "name": "BOHEMIOS",
        "primary": "#33cc33",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s04",
        "rating": 45
      },
      {
        "id": "argentina-26",
        "name": "CONL",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s06",
        "rating": 45
      },
      {
        "id": "argentina-27",
        "name": "CERVECERO",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "argentina-28",
        "name": "PART",
        "primary": "#0000b2",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-29",
        "name": "ARFA",
        "primary": "#e50000",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-30",
        "name": "INFLUENZA",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-31",
        "name": "CAJEROS",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 45
      },
      {
        "id": "argentina-32",
        "name": "PEPINO MALVADO",
        "primary": "#ffffff",
        "secondary": "#003366",
        "shorts": "#003366",
        "pattern": "s09",
        "rating": 45
      }
    ]
  },
  {
    "id": "netherlands",
    "name": "Netherlands",
    "flag": "🇳🇱",
    "teams": [
      {
        "id": "netherlands-1",
        "name": "GODENZAR",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s08",
        "rating": 75
      },
      {
        "id": "netherlands-2",
        "name": "LUMINO",
        "primary": "#000000",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 74
      },
      {
        "id": "netherlands-3",
        "name": "KAASOREN 05",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 60
      },
      {
        "id": "netherlands-4",
        "name": "MAAS CLUB",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s04",
        "rating": 70
      },
      {
        "id": "netherlands-5",
        "name": "VITAS",
        "primary": "#0099cc",
        "secondary": "#000000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 62
      },
      {
        "id": "netherlands-6",
        "name": "HONDEN",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "netherlands-7",
        "name": "SUPERFREEZE",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 55
      },
      {
        "id": "netherlands-8",
        "name": "UTREXO",
        "primary": "#cc99cc",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s14",
        "rating": 50
      },
      {
        "id": "netherlands-9",
        "name": "BEVRIEZING",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 51
      },
      {
        "id": "netherlands-10",
        "name": "BLAUW VINGERS",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 53
      },
      {
        "id": "netherlands-11",
        "name": "NIJEN",
        "primary": "#7f1a38",
        "secondary": "#33cc33",
        "shorts": "#000000",
        "pattern": "s04",
        "rating": 49
      },
      {
        "id": "netherlands-12",
        "name": "CUMBARA SC",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "netherlands-13",
        "name": "BILLY III",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 48
      },
      {
        "id": "netherlands-14",
        "name": "HERACLIEDEN",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 47
      },
      {
        "id": "netherlands-15",
        "name": "SUPERBOEREN",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 40
      },
      {
        "id": "netherlands-16",
        "name": "KRALINGERS",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 41
      },
      {
        "id": "netherlands-17",
        "name": "TROSTEN",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 46
      },
      {
        "id": "netherlands-18",
        "name": "OOSTVAAR",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#33cc33",
        "pattern": "s01",
        "rating": 42
      },
      {
        "id": "netherlands-19",
        "name": "WITZWARTEN",
        "primary": "#7f1a38",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 39
      },
      {
        "id": "netherlands-20",
        "name": "RAMHORN",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 39
      },
      {
        "id": "netherlands-21",
        "name": "OMNI BUCKS",
        "primary": "#7f1a38",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 33
      },
      {
        "id": "netherlands-22",
        "name": "D-BUSH",
        "primary": "#7f1a38",
        "secondary": "#ffffff",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 37
      },
      {
        "id": "netherlands-23",
        "name": "EINDE 90",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 37
      },
      {
        "id": "netherlands-24",
        "name": "EMNME",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s08",
        "rating": 36
      },
      {
        "id": "netherlands-25",
        "name": "GELUKKIG",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 38
      },
      {
        "id": "netherlands-26",
        "name": "BANGE ADELAARS",
        "primary": "#6600cc",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s01",
        "rating": 39
      },
      {
        "id": "netherlands-27",
        "name": "HELMOR",
        "primary": "#0000b2",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 32
      },
      {
        "id": "netherlands-28",
        "name": "WITTE STER",
        "primary": "#e50000",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s06",
        "rating": 36
      },
      {
        "id": "netherlands-29",
        "name": "BREDANAAR",
        "primary": "#cc99cc",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s05",
        "rating": 40
      },
      {
        "id": "netherlands-30",
        "name": "OSSARON",
        "primary": "#ffff00",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s05",
        "rating": 32
      },
      {
        "id": "netherlands-31",
        "name": "SPARK",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 31
      },
      {
        "id": "netherlands-32",
        "name": "WALLWY",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s06",
        "rating": 35
      }
    ]
  },
  {
    "id": "germany",
    "name": "Germany",
    "flag": "🇩🇪",
    "teams": [
      {
        "id": "germany-1",
        "name": "HOLLYWOOD",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s01",
        "rating": 95
      },
      {
        "id": "germany-2",
        "name": "SCHWARZGELGEN",
        "primary": "#ffff00",
        "secondary": "#ffff00",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "germany-3",
        "name": "KONIGSROTTEN",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "germany-4",
        "name": "2.FC LVRZ ",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s05",
        "rating": 80
      },
      {
        "id": "germany-5",
        "name": "AUTO CITY",
        "primary": "#0000b2",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s09",
        "rating": 80
      },
      {
        "id": "germany-6",
        "name": "BOLZEN",
        "primary": "#cc6633",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 75
      },
      {
        "id": "germany-7",
        "name": "WASSERMELONEN",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 70
      },
      {
        "id": "germany-8",
        "name": "FOWGGER",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 70
      },
      {
        "id": "germany-9",
        "name": "HFFE",
        "primary": "#cc6633",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "germany-10",
        "name": "HNRT",
        "primary": "#33cc33",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "germany-11",
        "name": "JUNGE DAME",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 60
      },
      {
        "id": "germany-12",
        "name": "ADLER 011",
        "primary": "#003366",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 61
      },
      {
        "id": "germany-13",
        "name": "FRGB",
        "primary": "#000000",
        "secondary": "#e50000",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "germany-14",
        "name": "KAKERLAKEN",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 66
      },
      {
        "id": "germany-15",
        "name": "WRED",
        "primary": "#e50000",
        "secondary": "#336633",
        "shorts": "#33cc33",
        "pattern": "s09",
        "rating": 62
      },
      {
        "id": "germany-16",
        "name": "ROTHOSEN",
        "primary": "#0000b2",
        "secondary": "#0000b2",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "germany-17",
        "name": "LEGENDE",
        "primary": "#000000",
        "secondary": "#820f14",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "germany-18",
        "name": "BRAUN",
        "primary": "#cc99cc",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 68
      },
      {
        "id": "germany-19",
        "name": "ZIEGE 04",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "germany-20",
        "name": "FAULTIERE",
        "primary": "#003366",
        "secondary": "#0099cc",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 57
      },
      {
        "id": "germany-21",
        "name": "KLEEBLAETTER",
        "primary": "#cc99cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s02",
        "rating": 58
      },
      {
        "id": "germany-22",
        "name": "KASSIERER",
        "primary": "#003366",
        "secondary": "#820f14",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "germany-23",
        "name": "ROTE GURKEN",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "germany-24",
        "name": "SECHZGER",
        "primary": "#003366",
        "secondary": "#66ccff",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 55
      },
      {
        "id": "germany-25",
        "name": "FREIBEUTER",
        "primary": "#003366",
        "secondary": "#660000",
        "shorts": "#660000",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "germany-26",
        "name": "SCHANZER",
        "primary": "#000000",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 60
      },
      {
        "id": "germany-27",
        "name": "SAND HOUSE",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "germany-28",
        "name": "SCHLAFWANDLER",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s01",
        "rating": 47
      },
      {
        "id": "germany-29",
        "name": "VEILCHEN",
        "primary": "#cc99cc",
        "secondary": "#6600cc",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "germany-30",
        "name": "BH84",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "germany-31",
        "name": "HERIMAN",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 50
      },
      {
        "id": "germany-32",
        "name": "EISEN JUNGS",
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "shorts": "#e50000",
        "pattern": "s13",
        "rating": 43
      }
    ]
  },
  {
    "id": "russia",
    "name": "Russia",
    "flag": "🇷🇺",
    "teams": [
      {
        "id": "russia-1",
        "name": "PETER LVI",
        "primary": "#ffffff",
        "secondary": "#0099cc",
        "shorts": "#0099cc",
        "pattern": "s03",
        "rating": 90
      },
      {
        "id": "russia-2",
        "name": "ARMYX",
        "primary": "#ffff00",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 90
      },
      {
        "id": "russia-3",
        "name": "KAMNI",
        "primary": "#820f14",
        "secondary": "#820f14",
        "shorts": "#820f14",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "russia-4",
        "name": "KRASNO BELYE",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s07",
        "rating": 90
      },
      {
        "id": "russia-5",
        "name": "PARAVOZY",
        "primary": "#0000b2",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 85
      },
      {
        "id": "russia-6",
        "name": "DINAMIKY",
        "primary": "#0099cc",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 80
      },
      {
        "id": "russia-7",
        "name": "BYKI",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 65
      },
      {
        "id": "russia-8",
        "name": "KAZAKI",
        "primary": "#6600cc",
        "secondary": "#33cc33",
        "shorts": "#33cc33",
        "pattern": "s03",
        "rating": 63
      },
      {
        "id": "russia-9",
        "name": "PERMYAKI",
        "primary": "#ffffff",
        "secondary": "#000000",
        "shorts": "#000000",
        "pattern": "s02",
        "rating": 62
      },
      {
        "id": "russia-10",
        "name": "GOROZHANE",
        "primary": "#e50000",
        "secondary": "#000000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 68
      },
      {
        "id": "russia-11",
        "name": "SELMASHI",
        "primary": "#336633",
        "secondary": "#ffff00",
        "shorts": "#ffff00",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "russia-12",
        "name": "VOLKI G",
        "primary": "#33cc33",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 62
      },
      {
        "id": "russia-13",
        "name": "ORLY",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 53
      },
      {
        "id": "russia-14",
        "name": "PERYA",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#0099cc",
        "pattern": "s03",
        "rating": 61
      },
      {
        "id": "russia-15",
        "name": "BARSY",
        "primary": "#ffffff",
        "secondary": "#e50000",
        "shorts": "#ffffff",
        "pattern": "s01",
        "rating": 46
      },
      {
        "id": "russia-16",
        "name": "SIBR NOVI",
        "primary": "#0000b2",
        "secondary": "#cc6633",
        "shorts": "#0000b2",
        "pattern": "s13",
        "rating": 50
      },
      {
        "id": "russia-17",
        "name": "VOLGARI",
        "primary": "#000000",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 52
      },
      {
        "id": "russia-18",
        "name": "NALCY",
        "primary": "#0099cc",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 59
      },
      {
        "id": "russia-19",
        "name": "SHINA",
        "primary": "#ffffff",
        "secondary": "#0099cc",
        "shorts": "#ffffff",
        "pattern": "s13",
        "rating": 41
      },
      {
        "id": "russia-20",
        "name": "MORDI",
        "primary": "#003366",
        "secondary": "#ffffff",
        "shorts": "#003366",
        "pattern": "s03",
        "rating": 57
      },
      {
        "id": "russia-21",
        "name": "URALTSY",
        "primary": "#cc6633",
        "secondary": "#33cc33",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 58
      },
      {
        "id": "russia-22",
        "name": "SIBIRYAKI",
        "primary": "#e50000",
        "secondary": "#0099cc",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "russia-23",
        "name": "CERNO BELIE",
        "primary": "#e50000",
        "secondary": "#ffffff",
        "shorts": "#000000",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "russia-24",
        "name": "RAY",
        "primary": "#ffffff",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "russia-25",
        "name": "BALDA",
        "primary": "#7f1a38",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 51
      },
      {
        "id": "russia-26",
        "name": "PRYANIKI",
        "primary": "#33cc33",
        "secondary": "#e50000",
        "shorts": "#e50000",
        "pattern": "s03",
        "rating": 45
      },
      {
        "id": "russia-27",
        "name": "BAIK",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "russia-28",
        "name": "GRUZOVIKI",
        "primary": "#33cc33",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 47
      },
      {
        "id": "russia-29",
        "name": "FAKELONY",
        "primary": "#0000b2",
        "secondary": "#ffff00",
        "shorts": "#0000b2",
        "pattern": "s03",
        "rating": 49
      },
      {
        "id": "russia-30",
        "name": "FALCON",
        "primary": "#e50000",
        "secondary": "#0000b2",
        "shorts": "#0000b2",
        "pattern": "s01",
        "rating": 58
      },
      {
        "id": "russia-31",
        "name": "ORNI",
        "primary": "#0000b2",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 50
      },
      {
        "id": "russia-32",
        "name": "SNAGA",
        "primary": "#33cc33",
        "secondary": "#ffffff",
        "shorts": "#ffffff",
        "pattern": "s03",
        "rating": 43
      }
    ]
  }
];

const patternIds = new Set(PATTERNS.map(pattern => pattern.id));
const colourPattern = /^#[0-9a-fA-F]{6}$/;

// Strict boundary for team data received over the wire. Only editable fields survive.
export function normalizeTeam(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (typeof input.name !== 'string') return null;
  const name = input.name.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().replace(/\s+/g, ' ');
  if (!name || [...name].length > 28 || !patternIds.has(input.pattern)) return null;
  for (const key of ['primary', 'secondary', 'shorts']) {
    if (typeof input[key] !== 'string' || !colourPattern.test(input[key])) return null;
  }
  return {name, primary: input.primary.toLowerCase(), secondary: input.secondary.toLowerCase(), shorts: input.shorts.toLowerCase(), pattern: input.pattern};
}

export function getLeague(id) {
  return LEAGUES.find(league => league.id === id) || null;
}

export function getTeam(leagueId, teamId) {
  return getLeague(leagueId)?.teams.find(team => team.id === teamId) || null;
}
