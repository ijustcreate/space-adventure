export const ROLE_ORDER = ["pilot", "engineer", "scientist", "communicator"];

export const ROLE_META = {
  pilot: {
    label: "Pilot",
    button: "X",
    control: "Left Stick + LB/LT",
    color: "#75d5ff"
  },
  engineer: {
    label: "Life Support",
    button: "A",
    control: "D-Pad Systems",
    color: "#ffd257"
  },
  scientist: {
    label: "Science",
    button: "B",
    control: "Right Stick Scanner",
    color: "#f59dff"
  },
  communicator: {
    label: "Mission Ops",
    button: "Y",
    control: "Menu + Utility",
    color: "#8effbd"
  }
};

export const SOLAR_BODIES = [
  {
    name: "Mercury",
    radius: 2.4,
    orbitRadius: 50,
    orbitPeriodSeconds: 90,
    angle: 0.3,
    eccentricity: 0.206,
    inclinationDeg: 7,
    spinSpeed: 0.01,
    colorA: "#9da4aa",
    colorB: "#61666d",
    glow: "#f6d2a3",
    description: "Mercury races around the Sun faster than every other planet.",
    poi: ["Caloris Basin", "Solar-facing cliffs"]
  },
  {
    name: "Venus",
    radius: 5.95,
    orbitRadius: 82,
    orbitPeriodSeconds: 140,
    angle: 1.1,
    eccentricity: 0.007,
    inclinationDeg: 3.4,
    spinSpeed: 0.003,
    colorA: "#ffd0a6",
    colorB: "#cc8f54",
    glow: "#ffd7ac",
    cloudColor: "#ffefc1",
    description: "Venus is wrapped in bright clouds and has a runaway greenhouse atmosphere.",
    poi: ["Sulfur cloud deck", "Volcanic highlands"]
  },
  {
    name: "Earth",
    radius: 6.35,
    orbitRadius: 118,
    orbitPeriodSeconds: 220,
    angle: 0.75,
    eccentricity: 0.017,
    inclinationDeg: 0.1,
    spinSpeed: 0.006,
    colorA: "#3f8cff",
    colorB: "#1fdd8e",
    glow: "#8cc8ff",
    cloudColor: "#f5f9ff",
    description: "Earth is home base, with oceans, weather, and a moon that shapes its tides.",
    poi: ["International Space Station", "Artemis launch corridor", "Pacific Ocean", "Night-side city lights"]
  },
  {
    name: "Mars",
    radius: 3.38,
    orbitRadius: 168,
    orbitPeriodSeconds: 320,
    angle: 2.4,
    eccentricity: 0.093,
    inclinationDeg: 1.85,
    spinSpeed: 0.008,
    colorA: "#e08152",
    colorB: "#923c21",
    glow: "#ffad77",
    description: "Mars is a cold desert with giant volcanoes and deep canyons.",
    poi: ["Olympus Mons", "Valles Marineris", "Polar caps"]
  },
  {
    name: "Jupiter",
    radius: 14.2,
    orbitRadius: 258,
    orbitPeriodSeconds: 760,
    angle: 1.8,
    eccentricity: 0.049,
    inclinationDeg: 1.3,
    spinSpeed: 0.014,
    colorA: "#f4c37f",
    colorB: "#9f6946",
    glow: "#ffdbab",
    cloudColor: "#fff0d9",
    description: "Jupiter is a giant world with storms larger than Earth.",
    poi: ["Great Red Spot", "Europa", "Io", "Ganymede"]
  },
  {
    name: "Saturn",
    radius: 11.9,
    orbitRadius: 350,
    orbitPeriodSeconds: 1100,
    angle: 3.2,
    eccentricity: 0.056,
    inclinationDeg: 2.5,
    spinSpeed: 0.012,
    colorA: "#f4dea4",
    colorB: "#b99653",
    glow: "#ffe7b4",
    ringColor: "#f1deb4",
    cloudColor: "#fff2db",
    description: "Saturn's rings are made from countless icy particles.",
    poi: ["Main ring plane", "Titan", "Hexagon storm"]
  },
  {
    name: "Uranus",
    radius: 9.1,
    orbitRadius: 438,
    orbitPeriodSeconds: 1500,
    angle: 2.25,
    eccentricity: 0.047,
    inclinationDeg: 0.77,
    spinSpeed: 0.01,
    colorA: "#a4f2f7",
    colorB: "#60a8ce",
    glow: "#baf8ff",
    description: "Uranus rotates on its side, making its seasons extreme.",
    poi: ["Blue methane haze", "Axial tilt view"]
  },
  {
    name: "Neptune",
    radius: 8.8,
    orbitRadius: 530,
    orbitPeriodSeconds: 1880,
    angle: 5.1,
    eccentricity: 0.009,
    inclinationDeg: 1.77,
    spinSpeed: 0.011,
    colorA: "#4b86ff",
    colorB: "#2741b8",
    glow: "#7fb8ff",
    description: "Neptune is distant, blue, and whipped by powerful winds.",
    poi: ["Dark storm bands", "Triton"]
  }
];

export const MOON_DATA = {
  name: "Moon",
  radius: 1.8,
  orbitRadius: 18,
  orbitPeriodSeconds: 32,
  angle: 1.4,
  eccentricity: 0.055,
  inclinationDeg: 5.1,
  spinSpeed: 0.003,
  colorA: "#d4d6d8",
  colorB: "#8f939a",
  glow: "#edf2ff",
  description: "The Moon reflects sunlight and helps drive Earth's tides.",
  poi: ["Artemis flyby node", "Apollo heritage zone", "Far side crater field"]
};

export const SHIP_FACTS = {
  artemis: {
    name: "Artemis II",
    description: "A separate Orion-style spacecraft flying a repeating Earth-Moon story loop.",
    poi: ["Launch", "High Earth orbit", "Translunar injection", "Lunar flyby", "Free-return arc", "Splashdown marker"]
  }
};

export const CAMERA_MODES = [
  {
    id: "cockpit",
    label: "Cockpit",
    description: "First-person view from inside the spacecraft.",
    distance: -0.25,
    height: 0.38,
    lookAhead: 34,
    fov: 80
  },
  {
    id: "chase",
    label: "Chase",
    description: "Locked behind the ship for active piloting.",
    distance: 12,
    height: 3.4,
    lookAhead: 18,
    fov: 56
  },
  {
    id: "wide",
    label: "Wide Chase",
    description: "Zoomed out cinematic follow camera.",
    distance: 24,
    height: 8,
    lookAhead: 24,
    fov: 48
  }
];

export const SPECIAL_LOCATIONS = [
  {
    name: "International Space Station",
    anchor: "Earth",
    offset: [11, 3, 1],
    color: "#d8f2ff",
    description: "A continuously crewed research station orbiting Earth.",
    poi: ["Solar arrays", "Crew habitat", "Earth observation"]
  },
  {
    name: "Hubble Space Telescope",
    anchor: "Earth",
    offset: [-8, 5, -4],
    color: "#96c7ff",
    description: "A flagship observatory that transformed how we see the universe.",
    poi: ["Deep field images", "Mirror servicing", "Nebula photography"]
  },
  {
    name: "James Webb Space Telescope",
    anchor: "Earth",
    offset: [18, 10, -12],
    color: "#ffd786",
    description: "A deep-space infrared observatory stationed near the Earth-Sun L2 region.",
    poi: ["Sunshield", "Infrared mirror", "Early universe studies"]
  },
  {
    name: "Voyager 1",
    anchor: "Neptune",
    offset: [74, 18, -30],
    color: "#ffefb0",
    description: "A far-traveling probe exploring interstellar space beyond the heliosphere.",
    poi: ["Golden Record", "Heliosphere crossing", "Deep space signal"]
  },
  {
    name: "Voyager 2",
    anchor: "Neptune",
    offset: [58, -14, 42],
    color: "#f9d38f",
    description: "The only probe to have visited Uranus and Neptune up close.",
    poi: ["Grand tour", "Neptune flyby", "Planetary portraits"]
  },
  {
    name: "Orion Nebula",
    anchor: "Sun",
    offset: [0, 160, -620],
    color: "#98e5ff",
    description: "A bright stellar nursery visible in the Orion constellation.",
    poi: ["Star formation", "Gas cloud glow", "Young stars"]
  },
  {
    name: "Pillars of Creation",
    anchor: "Sun",
    offset: [-120, 110, -700],
    color: "#ffbf90",
    description: "Towering structures of gas and dust inside the Eagle Nebula.",
    poi: ["Dust towers", "Embedded stars", "JWST imagery"]
  }
];

export const CONSTELLATIONS = [
  {
    name: "Orion",
    color: "#7dc8ff",
    stars: [
      { id: "betelgeuse", position: [-0.32, 0.26, -1], size: 5.6 },
      { id: "bellatrix", position: [0.08, 0.22, -1], size: 4.5 },
      { id: "alnitak", position: [-0.12, 0.0, -1], size: 4.1 },
      { id: "alnilam", position: [0.0, -0.02, -1], size: 4.2 },
      { id: "mintaka", position: [0.12, -0.05, -1], size: 4.0 },
      { id: "saiph", position: [-0.06, -0.3, -1], size: 4.5 },
      { id: "rigel", position: [0.22, -0.34, -1], size: 5.6 }
    ],
    lanes: [
      ["betelgeuse", "bellatrix"],
      ["betelgeuse", "alnitak"],
      ["bellatrix", "mintaka"],
      ["alnitak", "alnilam"],
      ["alnilam", "mintaka"],
      ["alnitak", "saiph"],
      ["mintaka", "rigel"],
      ["saiph", "rigel"]
    ]
  },
  {
    name: "Big Dipper",
    color: "#ffe18b",
    stars: [
      { id: "dubhe", position: [-0.76, 0.34, -1], size: 4.5 },
      { id: "merak", position: [-0.58, 0.18, -1], size: 4.0 },
      { id: "phecda", position: [-0.34, 0.16, -1], size: 3.8 },
      { id: "megrez", position: [-0.16, 0.28, -1], size: 3.6 },
      { id: "alioth", position: [0.02, 0.38, -1], size: 4.1 },
      { id: "mizar", position: [0.24, 0.42, -1], size: 4.4 },
      { id: "alkaid", position: [0.48, 0.36, -1], size: 4.2 }
    ],
    lanes: [
      ["dubhe", "merak"],
      ["merak", "phecda"],
      ["phecda", "megrez"],
      ["megrez", "alioth"],
      ["alioth", "mizar"],
      ["mizar", "alkaid"]
    ]
  }
];

export const UI_ZONES = [
  { id: "I", label: "Crew Arch", center: [0.5, 0.09] },
  { id: "II", label: "Top Right", center: [0.89, 0.16] },
  { id: "III", label: "Right Mid", center: [0.9, 0.57] },
  { id: "IV", label: "Bottom Core", center: [0.5, 0.88] },
  { id: "V", label: "Left Lower", center: [0.13, 0.71] },
  { id: "VI", label: "Left Upper", center: [0.13, 0.29] },
  { id: "VII", label: "Center Focus", center: [0.5, 0.47] },
  { id: "VIII", label: "Upper Left Beam", center: [0.28, 0.18] },
  { id: "IX", label: "Upper Right Beam", center: [0.74, 0.18] },
  { id: "X", label: "Right Lower Beam", center: [0.86, 0.82] },
  { id: "XI", label: "Left Lower Beam", center: [0.07, 0.84] }
];

export const EDUCATION_MODULES = [
  {
    id: "orbits",
    title: "Orbit Playground",
    accent: "#7dc8ff",
    summary: "See how planets trace ellipses around the Sun and why inner worlds move faster.",
    slides: [
      {
        title: "The Sun Holds The Solar System Together",
        body: "The Sun's gravity bends the paths of planets into repeated loops called orbits. In this exhibit we compress time, but the shape stays true: each planet follows a tilted ellipse around the Sun.",
        camera: "solarWide",
        showOrbitGuides: true
      },
      {
        title: "Inner Planets Move Faster",
        body: "Mercury and Venus are closer to the Sun, so they complete their trips sooner. Farther planets like Neptune take much longer to go around.",
        camera: "innerPlanets",
        showOrbitGuides: true
      },
      {
        title: "Moons Orbit Planets Too",
        body: "The Moon is not orbiting the Sun by itself. It travels with Earth, while also circling Earth on its own smaller path.",
        camera: "earthMoon",
        showOrbitGuides: true
      }
    ]
  },
  {
    id: "gravity",
    title: "Gravity Lab",
    accent: "#ffd257",
    summary: "Explore gravity wells, tug-of-war between Earth and Moon, and how tides form.",
    slides: [
      {
        title: "Big Worlds Pull Harder",
        body: "Gravity comes from mass. Giant planets like Jupiter bend motion more strongly, while small moons make gentler gravity wells.",
        camera: "gravityWide",
        showGravity: true
      },
      {
        title: "Tides Stretch The Ocean",
        body: "The Moon pulls Earth a little more strongly on the side facing it. That difference stretches the oceans into bulges that become tides.",
        camera: "earthMoon",
        showGravity: true,
        showTides: true
      },
      {
        title: "Gravity Assists Change Paths",
        body: "A spacecraft can borrow motion by passing near a planet. Engineers use that trick to fling probes farther into space without carrying all the fuel themselves.",
        camera: "jupiterAssist",
        showGravity: true
      }
    ]
  },
  {
    id: "light",
    title: "Light And Shadows",
    accent: "#ffbf90",
    summary: "Watch sunlight paint day and night across Earth and make the Moon glow.",
    slides: [
      {
        title: "Sunlight Makes Day And Night",
        body: "Earth spins slowly, so one side faces the Sun while the other side turns into night. Clouds, oceans, and land all reflect light in different ways.",
        camera: "earthSun",
        showOrbitGuides: false
      },
      {
        title: "Moonlight Is Reflected Sunlight",
        body: "The Moon does not shine by itself. It glows because sunlight hits its dusty surface and bounces back toward us.",
        camera: "moonGlow",
        showOrbitGuides: false
      },
      {
        title: "Phases Depend On Angle",
        body: "As the Moon moves around Earth, we see different fractions of its sunlit half. That changing angle creates lunar phases.",
        camera: "earthMoon",
        showOrbitGuides: true
      }
    ]
  },
  {
    id: "ai",
    title: "Built With AI",
    accent: "#8effbd",
    summary: "See how an AI coding assistant helped build the interactive exhibit prototype.",
    slides: [
      {
        title: "Ideas Became A Playable Prototype",
        body: "A human described the museum experience in plain language. AI helped turn those notes into interface layouts, control logic, visual effects, and educational content.",
        camera: "museumWindow"
      },
      {
        title: "Humans Steered The Vision",
        body: "AI made code, art direction suggestions, and documentation, but a human kept deciding what felt right for children, for the museum, and for NASA-inspired learning.",
        camera: "museumWindow"
      },
      {
        title: "Iteration Made It Better",
        body: "The prototype improved through many rounds of feedback: ship scale, orbit feel, UI zones, lighting, lessons, and controls were all refined step by step.",
        camera: "solarWide"
      }
    ]
  }
];

export const WORLD_SCALE_NOTE =
  "The exhibit compresses immense real distances into a room-sized simulator. Planet order, orbit shape, moon relationships, and lighting stay faithful, while travel times are accelerated so children can explore in minutes instead of years.";
