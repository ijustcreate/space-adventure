/*
 * Empire of Ants — browser prototype
 *
 * The governing idea: the player changes the weather; the colony decides whether
 * to bring an umbrella. Ants are agents, not tiny employees waiting for a click.
 */

(() => {
  "use strict";

  const WORLD = { width: 1200, height: 720, surface: 132 };
  const GRID = { cols: 60, rows: 34 };
  GRID.cellW = WORLD.width / GRID.cols;
  GRID.cellH = (WORLD.height - WORLD.surface) / GRID.rows;

  const HOME = { x: 602, y: 374 };
  const STORAGE = { x: 464, y: 478 };
  const BROOD_ROOM = { x: 766, y: 485 };
  const ENTRANCE = { x: 600, y: WORLD.surface - 3 };
  const SAVE_KEY = "empire-of-ants-alpha-v2";
  const SAVE_VERSION = 2;

  const canvas = document.querySelector("#worldCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const canvasWrap = document.querySelector("#canvasWrap");
  const cursorLabel = document.querySelector("#cursorLabel");

  const ui = Object.fromEntries(
    [
      "dayReadout", "seedReadout", "modeLabel", "populationValue", "populationDelta",
      "carbsValue", "proteinValue", "humidityValue", "stabilityValue", "carbsMeter",
      "proteinMeter", "humidityMeter", "stabilityMeter", "eggValue", "larvaValue",
      "pupaValue", "broodTotal", "activeCount", "forageBar", "digBar", "nurseBar",
      "maintainBar", "forageCount", "digCount", "nurseCount", "maintainCount",
      "objectiveCount", "foodProgress", "digProgress", "workerProgress", "eventLog",
      "statusChip", "specimenTag", "specimenTitle", "specimenText", "autosaveLabel",
      "pauseIcon", "coachCard", "coachIndex", "coachTitle", "coachText", "toast"
    ].map((id) => [id, document.getElementById(id)])
  );

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cellIndex = (x, y) => y * GRID.cols + x;
  const cellXY = (index) => ({ x: index % GRID.cols, y: Math.floor(index / GRID.cols) });
  const cellCenter = (x, y) => ({
    x: (x + 0.5) * GRID.cellW,
    y: WORLD.surface + (y + 0.5) * GRID.cellH
  });

  let state;
  let activeTool = "inspect";
  let pointerDown = false;
  let lastPointerCell = "";
  let selectedAntId = null;
  let nextFoodType = "carbs";
  let lastFrame = performance.now();
  let uiClock = 0;
  let saveClock = 0;
  let ambientOn = false;
  let audioContext = null;
  let ambientTimer = null;
  let toastTimer = null;

  function createRng(seed) {
    let value = seed >>> 0 || 0x9e3779b9;
    return {
      next() {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967296;
      },
      get value() { return value >>> 0; },
      set value(next) { value = next >>> 0 || 0x9e3779b9; }
    };
  }

  let rng = createRng(1);
  const random = () => rng.next();
  const randomRange = (min, max) => lerp(min, max, random());

  function freshSeed() {
    if (globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || 8675309;
    }
    return (Date.now() ^ 0xa17c010) >>> 0;
  }

  function makeArray(length, factory) {
    return Array.from({ length }, (_, index) => factory(index));
  }

  function carveEllipse(open, cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (x < 0 || x >= GRID.cols || y < 0 || y >= GRID.rows) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) open[cellIndex(x, y)] = 1;
      }
    }
  }

  function lineCells(x0, y0, x1, y1) {
    const cells = [];
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      cells.push({ x, y });
      if (x === x1 && y === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
    return cells;
  }

  function carveTunnel(open, x0, y0, x1, y1, radius = 1) {
    for (const cell of lineCells(x0, y0, x1, y1)) {
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const x = cell.x + ox;
          const y = cell.y + oy;
          if (x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows && ox * ox + oy * oy <= radius * radius + 0.5) {
            open[cellIndex(x, y)] = 1;
          }
        }
      }
    }
  }

  function createTerrain(seed) {
    rng = createRng(seed ^ 0x5f3759df);
    const length = GRID.cols * GRID.rows;
    const open = new Uint8Array(length);
    const planned = new Uint8Array(length);
    const progress = new Float32Array(length);
    const moisture = new Float32Array(length);
    const hardness = new Float32Array(length);

    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        const index = cellIndex(x, y);
        const wave = Math.sin(x * 0.31 + seed * 0.00001) * 0.04 + Math.cos(y * 0.58) * 0.03;
        moisture[index] = clamp(0.59 + wave + randomRange(-0.05, 0.05), 0.38, 0.78);
        hardness[index] = clamp(0.78 + y * 0.011 + randomRange(-0.2, 0.28), 0.55, 1.35);
      }
    }

    carveTunnel(open, 30, 0, 30, 11, 1);
    carveEllipse(open, 30, 14, 6, 5);
    carveTunnel(open, 27, 16, 23, 20, 1);
    carveEllipse(open, 21, 20, 5, 4);
    carveTunnel(open, 33, 16, 38, 20, 1);
    carveEllipse(open, 39, 20, 6, 4);

    return { open, planned, progress, moisture, hardness };
  }

  function createAnt(id, near = HOME) {
    return {
      id,
      x: near.x + randomRange(-46, 46),
      y: near.y + randomRange(-34, 34),
      angle: randomRange(0, Math.PI * 2),
      task: "maintenance",
      phase: "idle",
      path: [],
      carrying: null,
      foodNodeId: null,
      targetCell: null,
      wait: randomRange(0, 2),
      energy: randomRange(0.74, 1),
      trailClock: randomRange(0, 0.3)
    };
  }

  function makeFreshState(seed = freshSeed()) {
    rng = createRng(seed);
    const terrain = createTerrain(seed);
    rng = createRng(seed);
    const ants = makeArray(12, (index) => createAnt(index + 1));
    const initialOpen = terrain.open.reduce((sum, value) => sum + value, 0);
    return {
      version: SAVE_VERSION,
      seed,
      rngState: rng.value,
      simHours: 6,
      speed: 1,
      paused: false,
      queenHealth: 100,
      carbs: 24,
      protein: 18,
      eggs: 5,
      larvae: 4,
      pupae: 2,
      eggProgress: 0,
      larvaProgress: 0,
      pupaProgress: 0,
      layProgress: 0,
      nurseCare: 0,
      foodGathered: 0,
      excavated: 0,
      initialWorkers: ants.length,
      nextAntId: ants.length + 1,
      stability: 96,
      temperature: 23.4,
      overlay: false,
      open: terrain.open,
      planned: terrain.planned,
      digProgress: terrain.progress,
      moisture: terrain.moisture,
      hardness: terrain.hardness,
      initialOpen,
      ants,
      foodNodes: [
        { id: 1, x: 223, y: 92, type: "protein", quantity: 9, radius: 18 },
        { id: 2, x: 959, y: 98, type: "carbs", quantity: 12, radius: 20 }
      ],
      nextFoodId: 3,
      trails: [],
      dust: [],
      logs: [{ hour: 6, text: "Observation began. Twelve workers are active." }],
      objectives: { food: false, dig: false, worker: false },
      coachStep: 0
    };
  }

  function serializeState() {
    state.rngState = rng.value;
    const copy = { ...state };
    copy.open = Array.from(state.open);
    copy.planned = Array.from(state.planned);
    copy.digProgress = Array.from(state.digProgress);
    copy.moisture = Array.from(state.moisture);
    copy.hardness = Array.from(state.hardness);
    copy.trails = state.trails.slice(-180);
    copy.dust = [];
    return JSON.stringify(copy);
  }

  function saveGame(showFeedback = false) {
    try {
      localStorage.setItem(SAVE_KEY, serializeState());
      ui.autosaveLabel.textContent = `SAVED · ${formatClock(state.simHours)}`;
      if (showFeedback) toast("Colony saved in this browser");
    } catch (error) {
      ui.autosaveLabel.textContent = "SAVE UNAVAILABLE";
      if (showFeedback) toast("This browser blocked local saving");
    }
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved || saved.version !== SAVE_VERSION || !saved.seed) return null;
      const terrain = createTerrain(saved.seed);
      saved.open = Uint8Array.from(saved.open || terrain.open);
      saved.planned = Uint8Array.from(saved.planned || terrain.planned);
      saved.digProgress = Float32Array.from(saved.digProgress || terrain.progress);
      saved.moisture = Float32Array.from(saved.moisture || terrain.moisture);
      saved.hardness = Float32Array.from(saved.hardness || terrain.hardness);
      saved.trails = saved.trails || [];
      saved.dust = [];
      saved.logs = saved.logs || [];
      saved.objectives = saved.objectives || { food: false, dig: false, worker: false };
      saved.paused = false;
      return saved;
    } catch (error) {
      return null;
    }
  }

  function resetColony(seed = freshSeed()) {
    state = makeFreshState(seed);
    rng = createRng(state.seed);
    selectedAntId = null;
    activeTool = "inspect";
    document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
      const active = button.dataset.tool === activeTool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelector("#overlayButton").classList.remove("is-active");
    document.querySelector("#overlayButton").setAttribute("aria-pressed", "false");
    updateCoach(0, true);
    for (const ant of state.ants) assignTask(ant);
    saveGame(false);
    updateUI(true);
  }

  function formatClock(totalHours) {
    const hour = ((Math.floor(totalHours) % 24) + 24) % 24;
    const minute = Math.floor((totalHours % 1) * 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function formatDay() {
    const day = Math.floor(state.simHours / 24) + 1;
    return `DAY ${String(day).padStart(2, "0")} · ${formatClock(state.simHours)}`;
  }

  function addLog(text) {
    const previous = state.logs[state.logs.length - 1];
    if (previous?.text === text) return;
    state.logs.push({ hour: state.simHours, text });
    state.logs = state.logs.slice(-10);
    ui.eventLog.textContent = `${formatClock(state.simHours)} — ${text}`;
  }

  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("is-visible"), 1800);
  }

  function averageHumidity() {
    let total = 0;
    let samples = 0;
    for (let y = 14; y <= 24; y += 1) {
      for (let x = 15; x <= 45; x += 1) {
        if ((x + y) % 2 !== 0) continue;
        total += state.moisture[cellIndex(x, y)];
        samples += 1;
      }
    }
    return samples ? total / samples : 0.6;
  }

  function nearestOpenCell(targetX, targetY) {
    let best = null;
    let bestDistance = Infinity;
    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        if (!state.open[cellIndex(x, y)]) continue;
        const score = (targetX - x) ** 2 + (targetY - y) ** 2;
        if (score < bestDistance) {
          bestDistance = score;
          best = { x, y };
        }
      }
    }
    return best || { x: 30, y: 14 };
  }

  function planCell(x, y) {
    if (x < 1 || x >= GRID.cols - 1 || y < 1 || y >= GRID.rows - 1) return;
    const index = cellIndex(x, y);
    if (!state.open[index]) state.planned[index] = 1;
  }

  function markExcavationAt(x, y, radius = 2) {
    const gridX = clamp(Math.floor(x / GRID.cellW), 1, GRID.cols - 2);
    const gridY = clamp(Math.floor((y - WORLD.surface) / GRID.cellH), 1, GRID.rows - 2);
    const nearest = nearestOpenCell(gridX, gridY);

    // Ants cannot honor a blue-sky tunnel diagram, so connect every request to known space.
    for (const cell of lineCells(nearest.x, nearest.y, gridX, gridY)) {
      planCell(cell.x, cell.y);
    }
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (ox * ox + oy * oy <= radius * radius + 0.4) planCell(gridX + ox, gridY + oy);
      }
    }

    if (state.coachStep === 0) updateCoach(1, true);
    return { gridX, gridY, plannedCells: countPlanned() };
  }

  function addFoodAt(x, type = nextFoodType, quantity = 14) {
    const safeX = clamp(x, 55, WORLD.width - 55);
    const nearby = state.foodNodes.find((node) => Math.abs(node.x - safeX) < 35 && node.type === type);
    if (nearby) {
      nearby.quantity += quantity;
    } else {
      state.foodNodes.push({
        id: state.nextFoodId++,
        x: safeX,
        y: type === "carbs" ? 96 : 91,
        type,
        quantity,
        radius: type === "carbs" ? 20 : 17
      });
    }
    nextFoodType = type === "carbs" ? "protein" : "carbs";
    addLog(`${type === "carbs" ? "Carbohydrate" : "Protein"} source placed in the foraging range.`);
    if (state.coachStep === 0) updateCoach(1, true);
    return { x: safeX, type, quantity };
  }

  function addMoistureAt(x, y, radius = 4) {
    const gridX = clamp(Math.floor(x / GRID.cellW), 0, GRID.cols - 1);
    const gridY = clamp(Math.floor((y - WORLD.surface) / GRID.cellH), 0, GRID.rows - 1);
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const px = gridX + ox;
        const py = gridY + oy;
        if (px < 0 || px >= GRID.cols || py < 0 || py >= GRID.rows) continue;
        const falloff = 1 - Math.hypot(ox, oy) / (radius + 0.75);
        if (falloff > 0) {
          const index = cellIndex(px, py);
          state.moisture[index] = clamp(state.moisture[index] + 0.34 * falloff, 0, 1);
        }
      }
    }
    addLog("Water is diffusing toward the brood chamber.");
    return { gridX, gridY, humidity: Math.round(averageHumidity() * 100) };
  }

  function countPlanned() {
    return state.planned.reduce((sum, value) => sum + value, 0);
  }

  function isFrontierCell(index) {
    if (!state.planned[index]) return false;
    const { x, y } = cellXY(index);
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
    return neighbors.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && nx < GRID.cols && ny >= 0 && ny < GRID.rows && state.open[cellIndex(nx, ny)];
    });
  }

  function chooseDigCell() {
    const assignmentCounts = new Map();
    for (const ant of state.ants) {
      if (ant.task === "dig" && ant.targetCell !== null) {
        assignmentCounts.set(ant.targetCell, (assignmentCounts.get(ant.targetCell) || 0) + 1);
      }
    }
    let fallback = null;
    for (let index = 0; index < state.planned.length; index += 1) {
      if (!state.planned[index]) continue;
      if (fallback === null) fallback = index;
      if (isFrontierCell(index) && (assignmentCounts.get(index) || 0) < 2) return index;
    }
    return fallback;
  }

  function availableFoodNode() {
    const needsProtein = state.protein < state.carbs * 0.72 || state.larvae > 5;
    const candidates = state.foodNodes.filter((node) => node.quantity > 0.2);
    if (!candidates.length) return null;
    const preferred = candidates.filter((node) => node.type === (needsProtein ? "protein" : "carbs"));
    const pool = preferred.length ? preferred : candidates;
    return pool[Math.floor(random() * pool.length)];
  }

  function weightedTask() {
    const hasFood = state.foodNodes.some((node) => node.quantity > 0.2);
    const hasDig = countPlanned() > 0;
    const brood = state.eggs + state.larvae + state.pupae;
    const lowFood = clamp((30 - (state.carbs + state.protein)) / 30, 0, 1);
    const weights = [
      ["forage", hasFood ? 0.25 + lowFood * 0.4 : 0],
      ["dig", hasDig ? 0.38 : 0],
      ["nurse", brood ? 0.2 + clamp(state.larvae / 20, 0, 0.18) : 0],
      ["maintenance", 0.2]
    ];
    const total = weights.reduce((sum, entry) => sum + entry[1], 0);
    let roll = random() * total;
    for (const [task, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return task;
    }
    return "maintenance";
  }

  function assignTask(ant, forcedTask = null) {
    ant.task = forcedTask || weightedTask();
    ant.wait = 0;
    ant.path = [];
    ant.targetCell = null;
    ant.foodNodeId = null;

    if (ant.task === "forage") {
      const node = availableFoodNode();
      if (!node) return assignTask(ant, "maintenance");
      ant.foodNodeId = node.id;
      ant.phase = "outbound";
      ant.path = [
        { x: HOME.x, y: 330 },
        { x: ENTRANCE.x, y: ENTRANCE.y },
        { x: node.x, y: node.y }
      ];
    } else if (ant.task === "dig") {
      const index = chooseDigCell();
      if (index === null) return assignTask(ant, "maintenance");
      ant.targetCell = index;
      const cell = cellXY(index);
      ant.phase = "working";
      ant.path = [cellCenter(cell.x, cell.y)];
    } else if (ant.task === "nurse") {
      ant.phase = "caring";
      ant.path = [{
        x: BROOD_ROOM.x + randomRange(-60, 60),
        y: BROOD_ROOM.y + randomRange(-30, 30)
      }];
    } else {
      ant.phase = "patrol";
      ant.path = [randomOpenPosition()];
    }
  }

  function randomOpenPosition() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const index = Math.floor(random() * state.open.length);
      if (state.open[index]) {
        const cell = cellXY(index);
        const center = cellCenter(cell.x, cell.y);
        return { x: center.x + randomRange(-5, 5), y: center.y + randomRange(-4, 4) };
      }
    }
    return { x: HOME.x, y: HOME.y };
  }

  function moveAnt(ant, target, dt, pace = 1) {
    const dx = target.x - ant.x;
    const dy = target.y - ant.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining < 0.001) return true;
    const step = Math.min(remaining, (55 + ant.energy * 18) * pace * dt);
    ant.angle = Math.atan2(dy, dx);
    ant.x += (dx / remaining) * step;
    ant.y += (dy / remaining) * step;
    ant.energy = clamp(ant.energy - dt * 0.002, 0.45, 1);
    return remaining <= step + 1;
  }

  function followPath(ant, dt, pace = 1) {
    if (!ant.path.length) return true;
    if (moveAnt(ant, ant.path[0], dt, pace)) ant.path.shift();
    return ant.path.length === 0;
  }

  function updateForager(ant, dt) {
    const node = state.foodNodes.find((entry) => entry.id === ant.foodNodeId);
    if (ant.phase === "outbound") {
      if (!node || node.quantity <= 0.1) return assignTask(ant);
      if (followPath(ant, dt, 1.08)) {
        const amount = Math.min(1, node.quantity);
        node.quantity -= amount;
        ant.carrying = { type: node.type, amount };
        ant.phase = "returning";
        ant.path = [
          { x: ENTRANCE.x, y: ENTRANCE.y },
          { x: HOME.x, y: 330 },
          { x: STORAGE.x, y: STORAGE.y }
        ];
      }
    } else if (ant.phase === "returning") {
      ant.trailClock -= dt;
      if (ant.trailClock <= 0) {
        state.trails.push({ x: ant.x, y: ant.y, life: 1, type: ant.carrying?.type || "carbs" });
        ant.trailClock = 0.18;
      }
      if (followPath(ant, dt, 0.96)) {
        if (ant.carrying) {
          const delivered = ant.carrying.amount;
          if (ant.carrying.type === "protein") state.protein += delivered;
          else state.carbs += delivered;
          state.foodGathered += delivered;
        }
        ant.carrying = null;
        ant.energy = clamp(ant.energy + 0.18, 0, 1);
        assignTask(ant);
      }
    }
  }

  function updateDigger(ant, dt) {
    if (ant.targetCell === null || !state.planned[ant.targetCell]) return assignTask(ant);
    if (!followPath(ant, dt, 0.84)) return;
    const hardness = state.hardness[ant.targetCell] || 1;
    state.digProgress[ant.targetCell] += dt * 0.28 / hardness;
    if (random() < dt * 4) {
      state.dust.push({ x: ant.x + randomRange(-5, 5), y: ant.y + randomRange(-4, 4), life: 1 });
    }
    if (state.digProgress[ant.targetCell] >= 1) {
      const finished = ant.targetCell;
      state.open[finished] = 1;
      state.planned[finished] = 0;
      state.digProgress[finished] = 0;
      state.excavated += 1;
      if (state.excavated === 1) addLog("The first marked cell is open. A route is beginning to form.");
      if (state.excavated > 0 && state.excavated % 10 === 0) addLog(`${state.excavated} new soil cells excavated.`);
      assignTask(ant);
    }
  }

  function updateNurse(ant, dt) {
    if (!followPath(ant, dt, 0.75)) return;
    ant.wait += dt;
    state.nurseCare = clamp(state.nurseCare + dt * 0.0035, 0, 1);
    if (ant.wait > randomRange(1.2, 2.8)) {
      ant.wait = 0;
      ant.path = [{
        x: BROOD_ROOM.x + randomRange(-62, 62),
        y: BROOD_ROOM.y + randomRange(-31, 31)
      }];
      if (random() < 0.18) assignTask(ant);
    }
  }

  function updateMaintenance(ant, dt) {
    if (!followPath(ant, dt, 0.72)) return;
    ant.wait += dt;
    ant.energy = clamp(ant.energy + dt * 0.025, 0, 1);
    if (ant.wait > randomRange(0.6, 2.3)) assignTask(ant);
  }

  function updateAnts(dt) {
    for (const ant of state.ants) {
      if (ant.task === "forage") updateForager(ant, dt);
      else if (ant.task === "dig") updateDigger(ant, dt);
      else if (ant.task === "nurse") updateNurse(ant, dt);
      else updateMaintenance(ant, dt);
    }
    state.foodNodes = state.foodNodes.filter((node) => node.quantity > 0.05);
    for (const trail of state.trails) trail.life -= dt * 0.045;
    state.trails = state.trails.filter((trail) => trail.life > 0).slice(-600);
    for (const speck of state.dust) {
      speck.life -= dt * 1.5;
      speck.y += dt * 4;
    }
    state.dust = state.dust.filter((speck) => speck.life > 0).slice(-180);
  }

  function transitionBrood(stage, amount = 1) {
    const whole = Math.min(Math.floor(amount), state[stage]);
    if (!whole) return;
    if (stage === "eggs") {
      state.eggs -= whole;
      state.larvae += whole;
      addLog(`${whole === 1 ? "An egg has" : `${whole} eggs have`} hatched.`);
    } else if (stage === "larvae") {
      state.larvae -= whole;
      state.pupae += whole;
      addLog(`${whole === 1 ? "A larva has" : `${whole} larvae have`} pupated.`);
    } else if (stage === "pupae") {
      state.pupae -= whole;
      for (let index = 0; index < whole; index += 1) {
        const ant = createAnt(state.nextAntId++, BROOD_ROOM);
        state.ants.push(ant);
        assignTask(ant);
      }
      addLog(`${whole === 1 ? "A new worker has" : `${whole} new workers have`} emerged.`);
    }
  }

  function updateColony(hoursDelta) {
    const humidity = averageHumidity();
    const broodFactor = clamp((humidity - 0.35) / 0.34, 0.25, 1.18) * (0.72 + state.nurseCare * 0.45);
    state.nurseCare = clamp(state.nurseCare - hoursDelta * 0.035, 0, 1);

    state.carbs = Math.max(0, state.carbs - hoursDelta * (0.014 + state.ants.length * 0.0017));
    state.protein = Math.max(0, state.protein - hoursDelta * (0.008 + state.larvae * 0.0016));
    state.temperature = 23.3 + Math.sin(state.simHours * 0.11) * 1.1;

    if (state.carbs > 1 && state.protein > 1 && humidity > 0.42 && humidity < 0.88) {
      state.queenHealth = clamp(state.queenHealth + hoursDelta * 0.025, 0, 100);
      state.layProgress += hoursDelta * (0.075 + state.protein * 0.0009);
    } else {
      state.queenHealth = clamp(state.queenHealth - hoursDelta * 0.26, 0, 100);
    }

    while (state.layProgress >= 1) {
      state.layProgress -= 1;
      state.eggs += 1;
      state.protein = Math.max(0, state.protein - 0.12);
      if (state.eggs % 5 === 0) addLog("The queen laid another cluster of eggs.");
    }

    state.eggProgress += (state.eggs / 18) * hoursDelta * broodFactor;
    if (state.eggProgress >= 1) {
      const count = Math.floor(state.eggProgress);
      state.eggProgress -= count;
      transitionBrood("eggs", count);
    }
    state.larvaProgress += (state.larvae / 25) * hoursDelta * broodFactor;
    if (state.larvaProgress >= 1) {
      const count = Math.floor(state.larvaProgress);
      state.larvaProgress -= count;
      transitionBrood("larvae", count);
    }
    state.pupaProgress += (state.pupae / 30) * hoursDelta * broodFactor;
    if (state.pupaProgress >= 1) {
      const count = Math.floor(state.pupaProgress);
      state.pupaProgress -= count;
      transitionBrood("pupae", count);
    }

    const moisturePenalty = humidity > 0.86 ? (humidity - 0.86) * 90 : 0;
    const expansionPenalty = Math.max(0, state.excavated - 55) * 0.045;
    state.stability = clamp(96 - expansionPenalty - moisturePenalty, 20, 99);

    // Evaporation is slow, because busywork is not a game mechanic just because nature does it.
    for (let index = 0; index < state.moisture.length; index += 1) {
      state.moisture[index] = clamp(state.moisture[index] - hoursDelta * 0.000012, 0.24, 1);
    }

    if (state.carbs < 3 && state.protein < 3) addLog("Food reserves are critically low. Foragers are changing priorities.");
    if (humidity < 0.44) addLog("Brood chamber humidity is below the healthy range.");
    if (state.stability < 45) addLog("Wide excavations are stressing the surrounding soil.");
  }

  function updateObjectives() {
    const previous = { ...state.objectives };
    state.objectives.food = state.foodGathered >= 10;
    state.objectives.dig = state.excavated >= 30;
    state.objectives.worker = state.ants.length > state.initialWorkers;
    for (const key of Object.keys(state.objectives)) {
      if (!previous[key] && state.objectives[key]) {
        const messages = {
          food: "Objective complete: the colony established a food route.",
          dig: "Objective complete: a new chamber is taking shape.",
          worker: "Objective complete: the colony raised a new worker."
        };
        addLog(messages[key]);
        toast(messages[key].replace("Objective complete: ", ""));
      }
    }
    const completeCount = Object.values(state.objectives).filter(Boolean).length;
    if (completeCount === 3 && state.coachStep < 3) updateCoach(3, true);
  }

  function update(dt) {
    if (state.paused) return;
    const scaledDt = dt * state.speed;
    const hoursDelta = scaledDt * 0.42;
    state.simHours += hoursDelta;
    updateAnts(scaledDt);
    updateColony(hoursDelta);
    updateObjectives();
  }

  const soilSpecks = makeArray(760, (index) => {
    const pseudo = createRng((index + 1) * 9277);
    return {
      x: pseudo.next() * WORLD.width,
      y: WORLD.surface + pseudo.next() * (WORLD.height - WORLD.surface),
      size: 0.5 + pseudo.next() * 2.2,
      light: pseudo.next()
    };
  });

  const stones = makeArray(38, (index) => {
    const pseudo = createRng((index + 9) * 7117);
    return {
      x: 30 + pseudo.next() * (WORLD.width - 60),
      y: WORLD.surface + 24 + pseudo.next() * (WORLD.height - WORLD.surface - 48),
      rx: 6 + pseudo.next() * 16,
      ry: 3 + pseudo.next() * 8,
      angle: pseudo.next() * Math.PI
    };
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function prepareContext() {
    const rect = canvas.getBoundingClientRect();
    const ratio = clamp(window.devicePixelRatio || 1, 1, 2);
    ctx.setTransform((rect.width * ratio) / WORLD.width, 0, 0, (rect.height * ratio) / WORLD.height, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.surface);
    sky.addColorStop(0, "#171b1a");
    sky.addColorStop(1, "#2b2920");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.width, WORLD.surface);

    ctx.fillStyle = "rgba(242,184,75,0.06)";
    ctx.beginPath();
    ctx.arc(1005, 34, 84, 0, Math.PI * 2);
    ctx.fill();

    const soil = ctx.createLinearGradient(0, WORLD.surface, 0, WORLD.height);
    soil.addColorStop(0, "#68432a");
    soil.addColorStop(0.28, "#553421");
    soil.addColorStop(0.62, "#40271b");
    soil.addColorStop(1, "#2c1c16");
    ctx.fillStyle = soil;
    ctx.fillRect(0, WORLD.surface, WORLD.width, WORLD.height - WORLD.surface);

    ctx.fillStyle = "rgba(16,9,6,0.12)";
    ctx.fillRect(0, 296, WORLD.width, 3);
    ctx.fillRect(0, 508, WORLD.width, 4);

    for (const speck of soilSpecks) {
      ctx.globalAlpha = 0.07 + speck.light * 0.12;
      ctx.fillStyle = speck.light > 0.55 ? "#e0a56f" : "#1c100b";
      ctx.fillRect(speck.x, speck.y, speck.size, speck.size);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(22,13,10,0.34)";
    for (const stone of stones) {
      ctx.save();
      ctx.translate(stone.x, stone.y);
      ctx.rotate(stone.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, stone.rx, stone.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = "#ad8050";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.surface);
    for (let x = 0; x <= WORLD.width; x += 15) {
      ctx.lineTo(x, WORLD.surface + Math.sin(x * 0.08) * 2 + Math.sin(x * 0.021) * 3);
    }
    ctx.stroke();

    // A few plant stems make the surface legible without turning the sim into clip-art ecology.
    ctx.strokeStyle = "rgba(143,151,94,0.55)";
    ctx.lineWidth = 2;
    for (const x of [72, 108, 1080, 1117]) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD.surface);
      ctx.quadraticCurveTo(x + 8, WORLD.surface - 33, x + (x % 2 ? -4 : 11), WORLD.surface - 64);
      ctx.stroke();
    }

    ctx.font = "10px SFMono-Regular, Consolas, monospace";
    ctx.fillStyle = "rgba(239,231,216,0.46)";
    ctx.fillText("FORAGING RANGE", 18, 23);
    ctx.fillText("SOIL PROFILE / LIVE", 18, WORLD.surface + 23);
  }

  function drawMoisture() {
    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        const amount = state.moisture[cellIndex(x, y)];
        if (amount < 0.64) continue;
        ctx.fillStyle = `rgba(65, 170, 184, ${(amount - 0.62) * 0.24})`;
        ctx.fillRect(x * GRID.cellW, WORLD.surface + y * GRID.cellH, GRID.cellW + 0.6, GRID.cellH + 0.6);
      }
    }
  }

  function drawNest() {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        const index = cellIndex(x, y);
        const px = x * GRID.cellW;
        const py = WORLD.surface + y * GRID.cellH;
        if (state.open[index]) {
          const moist = state.moisture[index];
          ctx.fillStyle = moist > 0.72 ? "#17191a" : "#130e0c";
          ctx.fillRect(px - 0.7, py - 0.7, GRID.cellW + 1.4, GRID.cellH + 1.4);
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(232,176,98,0.11)";
    ctx.lineWidth = 1;
    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        const index = cellIndex(x, y);
        if (!state.open[index]) continue;
        const px = x * GRID.cellW;
        const py = WORLD.surface + y * GRID.cellH;
        if (y === 0 || !state.open[cellIndex(x, y - 1)]) {
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + GRID.cellW, py); ctx.stroke();
        }
        if (y === GRID.rows - 1 || !state.open[cellIndex(x, y + 1)]) {
          ctx.beginPath(); ctx.moveTo(px, py + GRID.cellH); ctx.lineTo(px + GRID.cellW, py + GRID.cellH); ctx.stroke();
        }
        if (x === 0 || !state.open[cellIndex(x - 1, y)]) {
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + GRID.cellH); ctx.stroke();
        }
        if (x === GRID.cols - 1 || !state.open[cellIndex(x + 1, y)]) {
          ctx.beginPath(); ctx.moveTo(px + GRID.cellW, py); ctx.lineTo(px + GRID.cellW, py + GRID.cellH); ctx.stroke();
        }
      }
    }

    for (let y = 0; y < GRID.rows; y += 1) {
      for (let x = 0; x < GRID.cols; x += 1) {
        const index = cellIndex(x, y);
        if (!state.planned[index]) continue;
        const px = x * GRID.cellW;
        const py = WORLD.surface + y * GRID.cellH;
        const frontier = isFrontierCell(index);
        ctx.fillStyle = frontier ? "rgba(242,184,75,0.24)" : "rgba(242,184,75,0.1)";
        ctx.fillRect(px + 2, py + 2, GRID.cellW - 4, GRID.cellH - 4);
        ctx.strokeStyle = frontier ? "rgba(255,218,131,0.7)" : "rgba(242,184,75,0.36)";
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(px + 2.5, py + 2.5, GRID.cellW - 5, GRID.cellH - 5);
        ctx.setLineDash([]);
        if (state.digProgress[index] > 0) {
          ctx.fillStyle = "rgba(255,218,131,0.75)";
          ctx.fillRect(px + 3, py + GRID.cellH - 4, (GRID.cellW - 6) * state.digProgress[index], 1.5);
        }
      }
    }
  }

  function drawFood() {
    for (const node of state.foodNodes) {
      const remaining = clamp(node.quantity / 14, 0.2, 1);
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.globalAlpha = 0.45 + remaining * 0.55;
      if (node.type === "carbs") {
        ctx.fillStyle = "#e0aa4f";
        for (let index = 0; index < 9; index += 1) {
          const angle = index * 2.39;
          const radius = 4 + (index % 3) * 5;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.58, 2.4 + (index % 2), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#a96643";
        ctx.beginPath();
        ctx.ellipse(0, 0, node.radius, node.radius * 0.55, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,220,180,0.35)";
        ctx.beginPath();
        ctx.moveTo(-node.radius * 0.55, -2);
        ctx.lineTo(node.radius * 0.4, 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPheromones() {
    if (!state.overlay) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const trail of state.trails) {
      ctx.globalAlpha = clamp(trail.life * 0.28, 0, 0.28);
      ctx.fillStyle = trail.type === "protein" ? "#dc7444" : "#f2c153";
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, 3.2 + trail.life * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawQueenAndBrood() {
    const pulse = 1 + Math.sin(state.simHours * 2) * 0.035;
    ctx.save();
    ctx.translate(HOME.x, HOME.y);
    ctx.rotate(-0.18);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#30231e";
    ctx.strokeStyle = "#d6a95d";
    ctx.lineWidth = 1.3;
    for (const part of [{x:-19,rx:19,ry:13},{x:5,rx:10,ry:9},{x:21,rx:9,ry:8}]) {
      ctx.beginPath();
      ctx.ellipse(part.x, 0, part.rx, part.ry, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    const broodCounts = [state.eggs, state.larvae, state.pupae];
    let visualIndex = 0;
    for (let stage = 0; stage < broodCounts.length; stage += 1) {
      const count = Math.min(broodCounts[stage], 18);
      for (let index = 0; index < count; index += 1) {
        const column = visualIndex % 8;
        const row = Math.floor(visualIndex / 8);
        const x = BROOD_ROOM.x - 54 + column * 15 + (row % 2) * 4;
        const y = BROOD_ROOM.y - 26 + row * 14;
        ctx.fillStyle = stage === 2 ? "#aa9470" : stage === 1 ? "#c9bda2" : "#ece2cb";
        ctx.beginPath();
        if (stage === 1) ctx.ellipse(x, y, 6, 3.3, -0.35, 0, Math.PI * 2);
        else ctx.ellipse(x, y, 3.2, stage === 2 ? 6 : 5, stage === 2 ? 0.2 : -0.1, 0, Math.PI * 2);
        ctx.fill();
        visualIndex += 1;
      }
    }
  }

  function drawAnt(ant) {
    ctx.save();
    ctx.translate(ant.x, ant.y);
    ctx.rotate(ant.angle);
    const selected = selectedAntId === ant.id;
    if (selected) {
      ctx.strokeStyle = "rgba(255,218,131,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(224,210,185,0.78)";
    ctx.lineWidth = 0.8;
    for (const side of [-1, 1]) {
      for (const x of [-4, 1, 5]) {
        ctx.beginPath();
        ctx.moveTo(x, side * 1.4);
        ctx.lineTo(x - 1, side * 5);
        ctx.lineTo(x + 4, side * 7);
        ctx.stroke();
      }
    }
    ctx.fillStyle = ant.carrying ? "#f0bd54" : "#d8cbb5";
    ctx.beginPath(); ctx.ellipse(-5, 0, 4.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.5, 0, 2.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5, 0, 3.6, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (ant.carrying) {
      ctx.fillStyle = ant.carrying.type === "protein" ? "#c16d47" : "#ffd26a";
      ctx.beginPath(); ctx.arc(10, -3, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const speck of state.dust) {
      ctx.globalAlpha = speck.life * 0.55;
      ctx.fillStyle = "#d29a62";
      ctx.fillRect(speck.x, speck.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    ctx.font = "9px SFMono-Regular, Consolas, monospace";
    ctx.fillStyle = "rgba(242,184,75,0.48)";
    ctx.fillText("FOUNDRESS", HOME.x - 38, HOME.y - 35);
    ctx.fillText("STORAGE", STORAGE.x - 25, STORAGE.y + 55);
    ctx.fillText("BROOD", BROOD_ROOM.x - 18, BROOD_ROOM.y + 57);

    if (state.overlay) {
      ctx.fillStyle = "rgba(242,184,75,0.72)";
      ctx.fillText("PHEROMONE FIELD: FOOD / HOME", WORLD.width - 224, 23);
    }
  }

  function render() {
    resizeCanvas();
    prepareContext();
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    drawBackground();
    drawMoisture();
    drawNest();
    drawFood();
    drawPheromones();
    drawQueenAndBrood();
    for (const ant of state.ants) drawAnt(ant);
    drawParticles();
    drawLabels();

    if (state.paused) {
      ctx.fillStyle = "rgba(9,6,5,0.48)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f2b84b";
      ctx.font = "700 13px SFMono-Regular, Consolas, monospace";
      ctx.fillText("OBSERVATION PAUSED", WORLD.width / 2, 52);
      ctx.textAlign = "start";
    }
  }

  function taskCounts() {
    const counts = { forage: 0, dig: 0, nurse: 0, maintenance: 0 };
    for (const ant of state.ants) counts[ant.task] = (counts[ant.task] || 0) + 1;
    return counts;
  }

  function setMeter(element, value) {
    element.style.width = `${clamp(value, 0, 100)}%`;
  }

  function updateUI(force = false) {
    const humidity = Math.round(averageHumidity() * 100);
    const counts = taskCounts();
    const brood = state.eggs + state.larvae + state.pupae;
    ui.dayReadout.textContent = formatDay();
    ui.seedReadout.textContent = `M-${state.seed.toString(16).slice(-6).toUpperCase().padStart(6, "0")}`;
    ui.populationValue.textContent = state.ants.length;
    ui.populationDelta.textContent = `+${brood} brood developing`;
    ui.carbsValue.textContent = state.carbs.toFixed(1);
    ui.proteinValue.textContent = state.protein.toFixed(1);
    ui.humidityValue.textContent = `${humidity}%`;
    ui.stabilityValue.textContent = `${Math.round(state.stability)}%`;
    setMeter(ui.carbsMeter, state.carbs * 3.2);
    setMeter(ui.proteinMeter, state.protein * 4.1);
    setMeter(ui.humidityMeter, humidity);
    setMeter(ui.stabilityMeter, state.stability);
    ui.eggValue.textContent = state.eggs;
    ui.larvaValue.textContent = state.larvae;
    ui.pupaValue.textContent = state.pupae;
    ui.broodTotal.textContent = brood;
    ui.activeCount.textContent = `${state.ants.length} ACTIVE`;
    const denominator = Math.max(1, state.ants.length);
    for (const task of ["forage", "dig", "nurse", "maintenance"]) {
      const short = task === "maintenance" ? "maintain" : task;
      ui[`${short}Count`].textContent = counts[task];
      setMeter(ui[`${short}Bar`], (counts[task] / denominator) * 100);
    }

    ui.foodProgress.textContent = `${Math.floor(state.foodGathered)} / 10 gathered`;
    ui.digProgress.textContent = `${state.excavated} / 30 opened`;
    ui.workerProgress.textContent = state.objectives.worker ? "A new worker emerged" : `${state.pupae} pupae developing`;
    const completeCount = Object.values(state.objectives).filter(Boolean).length;
    ui.objectiveCount.textContent = `${completeCount} / 3`;
    for (const key of Object.keys(state.objectives)) {
      document.querySelector(`[data-objective="${key}"]`).classList.toggle("is-complete", state.objectives[key]);
    }

    const foodTotal = state.carbs + state.protein;
    let label = "STABLE";
    let className = "status-chip";
    if (state.queenHealth < 40 || foodTotal < 3 || humidity < 38 || state.stability < 35) {
      label = "CRITICAL";
      className += " danger";
    } else if (state.queenHealth < 72 || foodTotal < 10 || humidity < 48 || state.stability < 60) {
      label = "WATCH";
      className += " warn";
    }
    ui.statusChip.textContent = label;
    ui.statusChip.className = className;
    ui.pauseIcon.textContent = state.paused ? "▶" : "Ⅱ";
    document.querySelector("#pauseButton").setAttribute("aria-label", state.paused ? "Resume simulation" : "Pause simulation");

    if (force || state.logs.length) {
      const latest = state.logs[state.logs.length - 1];
      ui.eventLog.textContent = `${formatClock(latest.hour)} — ${latest.text}`;
    }
  }

  function updateCoach(step, reveal = false) {
    state.coachStep = step;
    const copy = [
      ["01", "The colony is alive.", "Place food above ground or mark soil below for excavation. The ants choose the rest."],
      ["02", "Now watch the response.", "Workers will reassign themselves. Turn on Trails to reveal the colony’s chemical memory."],
      ["03", "A system, not a script.", "Food, moisture, brood care, and excavation compete for the same finite workforce."],
      ["✓", "The first loop is complete.", "You fed, expanded, and reproduced without ordering a single ant around. That is the game."]
    ][step] || ["", "", ""];
    ui.coachIndex.textContent = copy[0];
    ui.coachTitle.textContent = copy[1];
    ui.coachText.textContent = copy[2];
    if (reveal) ui.coachCard.classList.remove("is-hidden");
  }

  function setTool(tool) {
    activeTool = tool;
    const labels = {
      inspect: "OBSERVATION MODE",
      dig: "EXCAVATION BRUSH · DRAG BELOW GROUND",
      food: `PLACE ${nextFoodType.toUpperCase()} · CLICK ABOVE GROUND`,
      water: "MOISTURE PIPETTE · DRAG THROUGH SOIL"
    };
    ui.modeLabel.textContent = labels[tool];
    document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setSpeed(speed) {
    if (speed === 0) {
      state.paused = true;
    } else {
      state.speed = speed;
      state.paused = false;
    }
    document.querySelectorAll("[data-speed]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.speed) === state.speed && !state.paused);
    });
    updateUI();
    return { paused: state.paused, speed: state.speed };
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * WORLD.width, 0, WORLD.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * WORLD.height, 0, WORLD.height),
      cssX: event.clientX - rect.left,
      cssY: event.clientY - rect.top
    };
  }

  function inspectAt(point) {
    let closest = null;
    let closestDistance = 28;
    for (const ant of state.ants) {
      const score = Math.hypot(ant.x - point.x, ant.y - point.y);
      if (score < closestDistance) { closest = ant; closestDistance = score; }
    }
    if (closest) {
      selectedAntId = closest.id;
      const taskText = {
        forage: closest.carrying ? "returning with food" : "following a food route",
        dig: "excavating the nearest frontier",
        nurse: "tending the developing brood",
        maintenance: "maintaining the nest network"
      }[closest.task];
      ui.specimenTag.textContent = `WORKER ${String(closest.id).padStart(2, "0")}`;
      ui.specimenTitle.textContent = taskText[0].toUpperCase() + taskText.slice(1);
      ui.specimenText.textContent = `Energy ${Math.round(closest.energy * 100)}%. Her behavior comes from colony pressure, local signals, and a heroic absence of meetings.`;
      return;
    }
    if (Math.hypot(HOME.x - point.x, HOME.y - point.y) < 70) {
      selectedAntId = null;
      ui.specimenTag.textContent = "QUEEN";
      ui.specimenTitle.textContent = "Foundress M-01";
      ui.specimenText.textContent = `Health ${Math.round(state.queenHealth)}%. Fed, sheltered, and gloriously unconcerned with middle management.`;
      return;
    }
    const food = state.foodNodes.find((node) => Math.hypot(node.x - point.x, node.y - point.y) < node.radius + 20);
    if (food) {
      selectedAntId = null;
      ui.specimenTag.textContent = "RESOURCE";
      ui.specimenTitle.textContent = food.type === "carbs" ? "Carbohydrate source" : "Protein source";
      ui.specimenText.textContent = `${food.quantity.toFixed(1)} units remain. Scouts can recruit more foragers by reinforcing the route home.`;
      return;
    }
    selectedAntId = null;
    ui.specimenTag.textContent = "SOIL";
    ui.specimenTitle.textContent = point.y < WORLD.surface ? "Surface foraging range" : "Uncatalogued soil pocket";
    ui.specimenText.textContent = point.y < WORLD.surface
      ? "Resources placed here must be discovered, collected, and physically returned to the nest."
      : "Use the excavation brush to make this location part of the colony’s future.";
  }

  function applyTool(point, drag = false) {
    if (activeTool === "inspect" && !drag) inspectAt(point);
    else if (activeTool === "dig" && point.y > WORLD.surface + 6) {
      const key = `${Math.floor(point.x / GRID.cellW)}:${Math.floor((point.y - WORLD.surface) / GRID.cellH)}`;
      if (key !== lastPointerCell) {
        markExcavationAt(point.x, point.y, 2);
        lastPointerCell = key;
      }
    } else if (activeTool === "food" && !drag && point.y < WORLD.surface + 42) {
      addFoodAt(point.x, nextFoodType);
      setTool("food");
    } else if (activeTool === "water" && point.y > WORLD.surface) {
      const key = `${Math.floor(point.x / (GRID.cellW * 2))}:${Math.floor((point.y - WORLD.surface) / (GRID.cellH * 2))}`;
      if (key !== lastPointerCell) {
        addMoistureAt(point.x, point.y, 3);
        lastPointerCell = key;
      }
    }
  }

  function updateCursor(point) {
    const rect = canvas.getBoundingClientRect();
    cursorLabel.style.left = `${clamp(point.cssX, 0, rect.width - 140)}px`;
    cursorLabel.style.top = `${clamp(point.cssY, 0, rect.height - 45)}px`;
    cursorLabel.style.display = "block";
    if (activeTool === "dig") {
      const depth = Math.max(0, Math.round((point.y - WORLD.surface) * 0.65));
      cursorLabel.textContent = point.y > WORLD.surface ? `MARK DIG · ${depth} mm` : "SOIL ONLY";
    } else if (activeTool === "food") {
      cursorLabel.textContent = point.y < WORLD.surface + 42 ? `PLACE ${nextFoodType.toUpperCase()}` : "SURFACE ONLY";
    } else if (activeTool === "water") {
      cursorLabel.textContent = point.y > WORLD.surface ? "ADD MOISTURE" : "SOIL ONLY";
    } else {
      cursorLabel.textContent = "INSPECT";
    }
  }

  function togglePause() {
    state.paused = !state.paused;
    document.querySelectorAll("[data-speed]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.speed) === state.speed && !state.paused);
    });
    updateUI();
  }

  function toggleOverlay() {
    state.overlay = !state.overlay;
    const button = document.querySelector("#overlayButton");
    button.classList.toggle("is-active", state.overlay);
    button.setAttribute("aria-pressed", String(state.overlay));
    if (state.overlay && state.coachStep < 2) updateCoach(2, true);
  }

  function makeAmbientTick() {
    if (!ambientOn || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = randomRange(800, 1600);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.018, audioContext.currentTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.04);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.05);
  }

  function toggleSound() {
    ambientOn = !ambientOn;
    const button = document.querySelector("#muteButton");
    button.textContent = ambientOn ? "SOUND ON" : "SOUND OFF";
    button.setAttribute("aria-pressed", String(ambientOn));
    if (ambientOn) {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume();
      makeAmbientTick();
      ambientTimer = setInterval(makeAmbientTick, 1150);
    } else {
      clearInterval(ambientTimer);
    }
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const register = (tool) => {
      try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (error) { /* optional browser capability */ }
    };

    register({
      name: "read_colony_state",
      title: "Read colony state",
      description: "Read the visible ant colony's current population, brood, resources, environment, objectives, and time.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const counts = taskCounts();
        return {
          day: Math.floor(state.simHours / 24) + 1,
          time: formatClock(state.simHours),
          workers: state.ants.length,
          brood: { eggs: state.eggs, larvae: state.larvae, pupae: state.pupae },
          resources: { carbs: +state.carbs.toFixed(1), protein: +state.protein.toFixed(1) },
          environment: { humidity: Math.round(averageHumidity() * 100), stability: Math.round(state.stability) },
          assignments: counts,
          objectives: state.objectives
        };
      }
    });

    register({
      name: "set_simulation_speed",
      title: "Set simulation speed",
      description: "Pause or run the visible colony at 1x, 2x, or 4x speed.",
      inputSchema: {
        type: "object",
        properties: { speed: { type: "number", enum: [0, 1, 2, 4] } },
        required: ["speed"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (![0, 1, 2, 4].includes(input?.speed)) throw new Error("speed must be 0, 1, 2, or 4");
        return setSpeed(input.speed);
      }
    });

    register({
      name: "place_food_source",
      title: "Place food source",
      description: "Place a carbohydrate or protein source in the visible surface foraging range.",
      inputSchema: {
        type: "object",
        properties: {
          position: { type: "number", minimum: 0.05, maximum: 0.95, description: "Horizontal position from left (0) to right (1)." },
          type: { type: "string", enum: ["carbs", "protein"] },
          quantity: { type: "number", minimum: 1, maximum: 30 }
        },
        required: ["position", "type"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!Number.isFinite(input?.position) || input.position < 0.05 || input.position > 0.95) throw new Error("position must be between 0.05 and 0.95");
        if (!["carbs", "protein"].includes(input.type)) throw new Error("type must be carbs or protein");
        const quantity = input.quantity ?? 14;
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 30) throw new Error("quantity must be between 1 and 30");
        return addFoodAt(input.position * WORLD.width, input.type, quantity);
      }
    });

    register({
      name: "mark_excavation",
      title: "Mark excavation",
      description: "Mark a connected underground location for worker ants to excavate.",
      inputSchema: {
        type: "object",
        properties: {
          horizontal: { type: "number", minimum: 0.05, maximum: 0.95 },
          depth: { type: "number", minimum: 0.05, maximum: 0.95 },
          radius: { type: "integer", minimum: 1, maximum: 3 }
        },
        required: ["horizontal", "depth"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!Number.isFinite(input?.horizontal) || input.horizontal < 0.05 || input.horizontal > 0.95) throw new Error("horizontal must be between 0.05 and 0.95");
        if (!Number.isFinite(input?.depth) || input.depth < 0.05 || input.depth > 0.95) throw new Error("depth must be between 0.05 and 0.95");
        const radius = input.radius ?? 2;
        if (![1, 2, 3].includes(radius)) throw new Error("radius must be 1, 2, or 3");
        return markExcavationAt(input.horizontal * WORLD.width, WORLD.surface + input.depth * (WORLD.height - WORLD.surface), radius);
      }
    });

    register({
      name: "moisten_soil",
      title: "Moisten soil",
      description: "Add moisture to a visible underground location to support brood development.",
      inputSchema: {
        type: "object",
        properties: {
          horizontal: { type: "number", minimum: 0.05, maximum: 0.95 },
          depth: { type: "number", minimum: 0.05, maximum: 0.95 }
        },
        required: ["horizontal", "depth"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!Number.isFinite(input?.horizontal) || input.horizontal < 0.05 || input.horizontal > 0.95) throw new Error("horizontal must be between 0.05 and 0.95");
        if (!Number.isFinite(input?.depth) || input.depth < 0.05 || input.depth > 0.95) throw new Error("depth must be between 0.05 and 0.95");
        return addMoistureAt(input.horizontal * WORLD.width, WORLD.surface + input.depth * (WORLD.height - WORLD.surface), 4);
      }
    });
  }

  function bindEvents() {
    document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
      button.addEventListener("click", () => setTool(button.dataset.tool));
    });
    document.querySelectorAll("[data-speed]").forEach((button) => {
      button.addEventListener("click", () => setSpeed(Number(button.dataset.speed)));
    });
    document.querySelector("#pauseButton").addEventListener("click", togglePause);
    document.querySelector("#overlayButton").addEventListener("click", toggleOverlay);
    document.querySelector("#helpButton").addEventListener("click", () => document.querySelector("#helpDialog").showModal());
    document.querySelector("#dismissCoach").addEventListener("click", () => ui.coachCard.classList.add("is-hidden"));
    document.querySelector("#saveButton").addEventListener("click", () => saveGame(true));
    document.querySelector("#resetButton").addEventListener("click", () => document.querySelector("#resetDialog").showModal());
    document.querySelector("#confirmReset").addEventListener("click", () => {
      localStorage.removeItem(SAVE_KEY);
      resetColony();
      toast("A new colony has been generated");
    });
    document.querySelector("#muteButton").addEventListener("click", toggleSound);

    canvas.addEventListener("pointerdown", (event) => {
      pointerDown = true;
      lastPointerCell = "";
      canvas.setPointerCapture(event.pointerId);
      const point = canvasPoint(event);
      applyTool(point, false);
      updateCursor(point);
    });
    canvas.addEventListener("pointermove", (event) => {
      const point = canvasPoint(event);
      updateCursor(point);
      if (pointerDown && (activeTool === "dig" || activeTool === "water")) applyTool(point, true);
    });
    canvas.addEventListener("pointerup", (event) => {
      pointerDown = false;
      lastPointerCell = "";
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointercancel", () => { pointerDown = false; lastPointerCell = ""; });
    canvas.addEventListener("pointerleave", () => { cursorLabel.style.display = "none"; });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("keydown", (event) => {
      if (event.target.matches("input, textarea, select")) return;
      const toolKeys = { "1": "inspect", "2": "dig", "3": "food", "4": "water" };
      if (toolKeys[event.key]) setTool(toolKeys[event.key]);
      else if (event.key === " ") { event.preventDefault(); togglePause(); }
      else if (event.key.toLowerCase() === "p") toggleOverlay();
      else if (event.key === "?") document.querySelector("#helpDialog").showModal();
    });

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pagehide", () => saveGame(false));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveGame(false);
    });
  }

  function frame(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 0.05);
    lastFrame = now;
    update(dt);
    render();
    uiClock += dt;
    saveClock += dt;
    if (uiClock >= 0.2) {
      updateUI();
      uiClock = 0;
    }
    if (saveClock >= 12) {
      saveGame(false);
      saveClock = 0;
    }
    requestAnimationFrame(frame);
  }

  function init() {
    state = loadGame() || makeFreshState();
    rng = createRng(state.rngState || state.seed);
    for (const ant of state.ants) {
      if (!ant.path?.length) assignTask(ant);
    }
    bindEvents();
    registerWebMcpTools();
    setTool("inspect");
    setSpeed(state.speed || 1);
    const overlayButton = document.querySelector("#overlayButton");
    overlayButton.classList.toggle("is-active", state.overlay);
    overlayButton.setAttribute("aria-pressed", String(Boolean(state.overlay)));
    updateCoach(state.coachStep || 0, false);
    updateUI(true);
    resizeCanvas();
    requestAnimationFrame(frame);
  }

  init();
})();
