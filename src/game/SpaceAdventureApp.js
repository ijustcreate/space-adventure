import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  CAMERA_MODES,
  CONSTELLATIONS,
  EDUCATION_MODULES,
  MOON_DATA,
  ROLE_META,
  ROLE_ORDER,
  SHIP_FACTS,
  SOLAR_BODIES,
  SPECIAL_LOCATIONS,
  UI_ZONES,
  WORLD_SCALE_NOTE
} from "./content.js";
import { InputManager } from "./InputManager.js";

const TIME_STEP = 1 / 60;
const ARTEMIS_LOOP_SECONDS = 600;
const ORBIT_TIME_SCALE = 0.24;
const START_OFFSET = new THREE.Vector3(-18, 5.5, 24);
const UI_LAYOUT_STORAGE_KEY = "space-adventure-ui-layout-v4";
const TEXT_STORAGE_KEY = "space-adventure-text-overrides-v2";
const DEBUG_STORAGE_KEY = "space-adventure-debug-settings-v3";

const DEFAULT_UI_LAYOUT = {
  brand: { x: 0, y: 0, scale: 1 },
  crew: { x: 0, y: 0, scale: 1 },
  supportPrimary: { x: 0, y: 0, scale: 1 },
  supportSecondary: { x: 0, y: 0, scale: 1 },
  science: { x: 0, y: 0, scale: 1 },
  guide: { x: 0, y: 0, scale: 1 }
};

const DEFAULT_DEBUG_SETTINGS = {
  cameraModeIndex: 1,
  invertCameraStep: true,
  cameraPanMinDeg: -32,
  cameraPanMaxDeg: 32,
  cameraRecenterSpeed: 3.1,
  cameraSmooth: 2.4,
  bloomStrength: 0.42,
  cruiseSpeed: 8,
  solarDriftStrength: 0,
  orbitTrailTurns: 1,
  flightAssist: false,
  showConstellations: false,
  showConstellationLabels: false,
  showGravityWells: false
};

const PANEL_ORDER = [
  { id: "brand", label: "Hero Panel" },
  { id: "crew", label: "Crew Panel" },
  { id: "supportPrimary", label: "Zone II Panel" },
  { id: "supportSecondary", label: "Zone III Panel" },
  { id: "science", label: "Zone V Panel" },
  { id: "guide", label: "Guide Strip" }
];

const KEYMAP_GROUPS = [
  {
    label: "Seat Presence",
    ids: ["seat_pilot", "seat_engineer", "seat_scientist", "seat_communicator"]
  },
  {
    label: "Pilot Flight",
    ids: ["pilot_left", "pilot_right", "pilot_up", "pilot_down"]
  },
  {
    label: "Engineer Camera",
    ids: ["engineer_up", "engineer_down", "engineer_left", "engineer_right"]
  },
  {
    label: "HUD Editing",
    ids: [
      "scientist_left",
      "scientist_right",
      "scientist_up",
      "scientist_down",
      "scientist_scale_modifier",
      "save_layout",
      "reset_layout"
    ]
  },
  {
    label: "System",
    ids: [
      "communicator_action",
      "constellation_toggle",
      "toggle_mode",
      "debug_toggle",
      "fullscreen"
    ]
  }
];

export class SpaceAdventureApp {
  constructor(root) {
    this.root = root;
    this.input = new InputManager();
    this.clock = new THREE.Clock();
    this.accumulator = 0;
    this.elapsed = 0;
    this.orbitTime = 0;
    this.inactivityTime = 0;
    this.debugVisible = false;
    this.isPaused = false;
    this.uiEditEnabled = false;
    this.uiEditScope = "selected";
    this.selectedPanelId = "brand";
    this.lastRemapPendingAction = null;
    this.uiTransformState = null;
    this.cameraPan = 0;
    this.cameraPanTarget = 0;
    this.cameraProfileCurrent = { ...CAMERA_MODES[1] };
    this.flightModeLabel = "Free Flight";
    this.targetInfo =
      "Aim near a planet, Artemis, or a mission marker, then press scan.";
    this.lockedTarget = null;
    this.activeLesson = null;
    this.activeLessonStep = 0;
    this.pauseSelectionIndex = 0;
    this.lessonSelectionIndex = 0;
    this.zoneSelection = "I";
    this.scienceDustCollected = 0;
    this.scannerStatusText = "Idle";
    this.gravityTargetName = "None";
    this.lifeSupportState = {
      oxygen: 0.92,
      water: 0.87,
      engineTemp: 0.46,
      engineFrozen: false,
      engineOverheated: false
    };
    this.resourcePulse = 0;

    this.debugSettings = this.loadStoredJSON(
      DEBUG_STORAGE_KEY,
      DEFAULT_DEBUG_SETTINGS
    );
    this.uiLayout = this.mergeUiLayout(
      this.loadStoredJSON(UI_LAYOUT_STORAGE_KEY, DEFAULT_UI_LAYOUT)
    );
    this.textOverrides = this.loadStoredJSON(TEXT_STORAGE_KEY, {});

    this.playerState = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    };
    this.tmpVector = new THREE.Vector3();
    this.tmpVectorB = new THREE.Vector3();
    this.tmpVectorC = new THREE.Vector3();
    this.tmpVectorD = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.shipCollisionRadius = 0.22;
    this.lastCollisionName = null;
    this.worldBodies = [];
    this.specialLocations = [];
    this.dustPositions = [];
    this.lessonButtons = [];
    this.pauseButtons = [];
    this.zoneAssignments = {
      crew: "I",
      supportPrimary: "II",
      supportSecondary: "III",
      science: "V",
      brand: "VI",
      guide: "IV"
    };

    this.setupDom();
    this.setupThree();

    this.createScene();
    this.updateBodies(0);
    this.updateOrbitTrails();
    this.updateSpecialLocations();
    this.updateExhibitStation();
    this.updateArtemisPath();
    this.updateArtemisShip();
    this.updatePresentationMode();
    this.resetPlayerToEarth();
    this.updateCamera(TIME_STEP);
    this.updateUi(TIME_STEP);

    this.boundAnimate = this.animate.bind(this);
    requestAnimationFrame(this.boundAnimate);
  }

  loadStoredJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return structuredClone(fallback);
      }
      return {
        ...structuredClone(fallback),
        ...JSON.parse(raw)
      };
    } catch {
      return structuredClone(fallback);
    }
  }

  saveStoredJSON(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  mergeUiLayout(layout) {
    const merged = structuredClone(DEFAULT_UI_LAYOUT);
    for (const [panelId, config] of Object.entries(layout || {})) {
      if (!merged[panelId]) {
        continue;
      }
      merged[panelId] = {
        ...merged[panelId],
        ...config
      };
    }
    return merged;
  }

  setupDom() {
    this.root.innerHTML = `
      <div class="app-shell">
        <div class="display-stage" data-display-stage>
          <canvas class="space-canvas"></canvas>
          <div class="display-glass"></div>
          <svg class="window-overlay" viewBox="0 0 1560 1000" preserveAspectRatio="none" aria-hidden="true">
            <rect class="window-outer" x="10" y="10" width="1540" height="980" rx="10"></rect>
            <g class="window-lattice">
              <path
                class="window-grid"
                d="
                  M 0 520 L 310 0
                  M 0 480 L 310 1000
                  M 1560 520 L 1250 0
                  M 1560 480 L 1250 1000
                  M 310 0 L 430 155
                  M 1250 0 L 1130 155
                  M 0 500 L 260 500
                  M 430 155 L 260 500
                  M 430 155 L 1130 155
                  M 1130 155 L 1300 500
                  M 1300 500 L 1560 500
                  M 1300 500 L 1130 845
                  M 1130 845 L 430 845
                  M 430 845 L 260 500
                  M 310 1000 L 430 845
                  M 1250 1000 L 1130 845
                "
              ></path>
            </g>
          </svg>
          <div class="cockpit-overlay hidden" data-cockpit-overlay>
            <div class="cockpit-frame"></div>
          </div>
          <div class="hud">
            <div class="brand-block" data-ui-panel="brand">
              <span class="eyebrow editable-text" data-editable-key="hero_eyebrow">NASA-Inspired Exhibit Window</span>
              <h1 class="editable-text" data-editable-key="hero_title">Orbital View</h1>
              <p class="subcopy editable-text" data-editable-key="hero_copy">Tap a crew seat or press 1-4 to take control. Idle mode becomes a museum-style orbital tableau.</p>
            </div>
            <div class="crew-panel" data-ui-panel="crew">
              <div class="panel-title editable-text" data-editable-key="crew_title">Crew Stations</div>
              <div class="seat-grid" data-seat-grid></div>
            </div>
            <div class="support-panel support-primary" data-ui-panel="supportPrimary">
              <div class="panel-title editable-text" data-editable-key="support_primary_title">Life Support</div>
              <div class="meter-card">
                <div class="meter-label editable-text" data-editable-key="meter_oxygen_label">Oxygen</div>
                <div class="meter-track"><div class="meter-fill oxygen" data-meter-fill="oxygen"></div></div>
                <div class="meter-value" data-meter-value="oxygen">92%</div>
              </div>
              <div class="meter-card">
                <div class="meter-label editable-text" data-editable-key="meter_water_label">Water</div>
                <div class="meter-track"><div class="meter-fill water" data-meter-fill="water"></div></div>
                <div class="meter-value" data-meter-value="water">87%</div>
              </div>
            </div>
            <div class="support-panel support-secondary" data-ui-panel="supportSecondary">
              <div class="panel-title editable-text" data-editable-key="support_secondary_title">Engine Core</div>
              <div class="meter-card">
                <div class="meter-label editable-text" data-editable-key="meter_engine_label">Engine Temperature</div>
                <div class="meter-track temp"><div class="meter-fill engine" data-meter-fill="engine"></div></div>
                <div class="meter-value" data-meter-value="engine">46%</div>
              </div>
              <div class="status-row">
                <span class="editable-text" data-editable-key="status_camera_label">Camera</span>
                <strong data-camera-mode>Chase</strong>
              </div>
              <div class="status-row">
                <span class="editable-text" data-editable-key="status_nearest_label">Nearest</span>
                <strong data-nearest>Earth</strong>
              </div>
              <div class="status-row">
                <span class="editable-text" data-editable-key="status_scan_label">Scan Target</span>
                <strong data-target>None</strong>
              </div>
              <div class="status-row">
                <span class="editable-text" data-editable-key="status_boost_label">Boost State</span>
                <strong data-boost-state>Nominal</strong>
              </div>
              <div class="status-row">
                <span class="editable-text" data-editable-key="status_loop_label">Artemis Loop</span>
                <strong>10:00</strong>
              </div>
            </div>
            <div class="science-panel" data-ui-panel="science">
              <div class="panel-title editable-text" data-editable-key="science_panel_title">Science Bay</div>
              <div class="science-stat">
                <span class="editable-text" data-editable-key="science_dust_label">Dust Collected</span>
                <strong data-dust-count>0</strong>
              </div>
              <div class="science-stat">
                <span class="editable-text" data-editable-key="science_scanner_label">Scanner</span>
                <strong data-scanner-status>Idle</strong>
              </div>
              <div class="science-stat">
                <span class="editable-text" data-editable-key="science_gravity_label">Gravity View</span>
                <strong data-gravity-status>Off</strong>
              </div>
              <p class="science-copy editable-text" data-editable-key="science_panel_copy">Hold B and point the right stick to sweep a science cone through dust and planets.</p>
            </div>
            <div class="hud-center">
              <div class="reticle">
                <div class="reticle-ring"></div>
                <div class="reticle-crosshair"></div>
              </div>
            </div>
            <div class="guide-strip" data-ui-panel="guide">
              <span class="editable-text" data-editable-key="guide_1">Seats 1-4</span>
              <span class="editable-text" data-editable-key="guide_2">WASD</span>
              <span class="editable-text" data-editable-key="guide_3">Arrows</span>
              <span class="editable-text" data-editable-key="guide_4">Space</span>
              <span class="editable-text" data-editable-key="guide_5">Start / Esc</span>
              <span class="editable-text" data-editable-key="guide_6">F1</span>
            </div>
          </div>
        </div>
        <div class="intro-overlay" data-intro>
          <div class="intro-card">
            <span class="eyebrow editable-text" data-editable-key="intro_eyebrow">Prototype Build</span>
            <h2 class="editable-text" data-editable-key="intro_title">Separate Ships, Shared Wonder</h2>
            <p class="editable-text" data-editable-key="intro_copy">The glowing Artemis ship follows a 10-minute Earth-Moon loop. Your crew controls a different ship that can escort Artemis, study the sky, and fly anywhere in the exhibit solar system.</p>
            <div class="intro-actions">
              <button data-start-btn>Start Mission</button>
              <button class="secondary" data-intro-dismiss>Hide Overlay</button>
            </div>
          </div>
        </div>
        <div class="pause-overlay hidden" data-pause>
          <div class="pause-card">
            <span class="eyebrow editable-text" data-editable-key="pause_eyebrow">Simulation Paused</span>
            <h2 class="editable-text" data-editable-key="pause_title">Pause Menu</h2>
            <p class="editable-text" data-editable-key="pause_copy">Use the controller D-pad or left stick to move through the menu. Press A or X to confirm, and B or Start to go back.</p>
            <div class="pause-actions">
              <button data-menu-item data-pause-resume>Resume Mission</button>
              <button class="secondary" data-menu-item data-pause-earth>Return To Earth Orbit</button>
              <button class="secondary" data-menu-item data-pause-debug>Open Debug</button>
            </div>
            <div class="lesson-grid" data-lesson-grid>
              ${EDUCATION_MODULES.map(
                (module) => `
                  <button class="lesson-tile" data-menu-item data-lesson-launch="${module.id}" style="--lesson-accent:${module.accent}">
                    <span class="lesson-kicker">Interactive Lesson</span>
                    <strong>${module.title}</strong>
                    <span>${module.summary}</span>
                  </button>
                `
              ).join("")}
            </div>
          </div>
        </div>
        <div class="lesson-overlay hidden" data-lesson-overlay>
          <div class="lesson-card">
            <span class="eyebrow" data-lesson-kicker>Interactive Museum Lesson</span>
            <h2 data-lesson-title>Orbit Playground</h2>
            <p data-lesson-body>Lesson text</p>
            <div class="lesson-meta">
              <div class="lesson-chip"><span>Module</span><strong data-lesson-module>Orbit Playground</strong></div>
              <div class="lesson-chip"><span>Step</span><strong data-lesson-step>1 / 3</strong></div>
            </div>
            <div class="lesson-actions">
              <button class="secondary" data-menu-item data-lesson-prev>Previous</button>
              <button data-menu-item data-lesson-next>Next</button>
              <button class="secondary" data-menu-item data-lesson-exit>Return To Pause</button>
            </div>
          </div>
        </div>
        <div class="debug-overlay hidden" data-debug>
          <div class="debug-card" data-debug-window role="dialog" aria-modal="true" aria-label="Developer Debug Window">
            <div class="debug-window-bar">
              <div class="debug-window-copy">
                <span class="eyebrow editable-text" data-editable-key="debug_window_eyebrow">Museum Operator Window</span>
                <strong class="debug-window-title editable-text" data-editable-key="debug_window_title">Space Adventure Debug Tools</strong>
              </div>
              <button class="window-close" data-debug-close aria-label="Close debug window">×</button>
            </div>
            <div class="debug-scroll-region">
              <div class="debug-header">
                <div>
                  <h3 class="editable-text" data-editable-key="debug_title">Developer Debug Panel</h3>
                  <p class="editable-text" data-editable-key="debug_copy">Double-click text to edit it, remap keys, tune the camera, and reshape the HUD without pushing the game behind it.</p>
                </div>
                <button class="secondary" data-debug-close-secondary>Done</button>
              </div>
              <div class="debug-grid">
                <section class="debug-section">
                  <label>Seat Mode</label>
                  <button data-toggle-mode>Toggle Hold Mode</button>
                  <p data-seat-mode></p>
                  <button data-reset-bindings>Reset Key Bindings</button>
                </section>
                <section class="debug-section">
                  <label>Flight Assist</label>
                  <label class="checkbox-row"><input type="checkbox" data-flight-assist /> Artemis follow assist</label>
                  <label class="slider-row"><span>Cruise Speed</span><input type="range" min="8" max="40" step="1" data-setting="cruiseSpeed" /></label>
                  <label class="slider-row"><span>Solar Drift</span><input type="range" min="0" max="2" step="0.05" data-setting="solarDriftStrength" /></label>
                  <label class="slider-row"><span>Orbit Wake Turns</span><input type="range" min="0.35" max="4" step="0.05" data-setting="orbitTrailTurns" /></label>
                </section>
                <section class="debug-section">
                  <label>Camera Tuning</label>
                  <label class="checkbox-row inline"><input type="checkbox" data-invert-camera-step /> Flip D-Pad Up/Down</label>
                  <label class="slider-row"><span>Pan Min</span><input type="range" min="-70" max="-5" step="1" data-setting="cameraPanMinDeg" /></label>
                  <label class="slider-row"><span>Pan Max</span><input type="range" min="5" max="70" step="1" data-setting="cameraPanMaxDeg" /></label>
                  <label class="slider-row"><span>Recenter</span><input type="range" min="0.5" max="6" step="0.1" data-setting="cameraRecenterSpeed" /></label>
                  <label class="slider-row"><span>Follow Smooth</span><input type="range" min="0.5" max="5" step="0.1" data-setting="cameraSmooth" /></label>
                  <label class="slider-row"><span>Bloom</span><input type="range" min="0" max="1.4" step="0.02" data-setting="bloomStrength" /></label>
                </section>
                <section class="debug-section">
                  <label>Sky Overlay</label>
                  <label class="checkbox-row"><input type="checkbox" data-show-constellations /> Show constellation lanes</label>
                  <label class="checkbox-row"><input type="checkbox" data-show-constellation-labels /> Show constellation labels</label>
                  <label class="checkbox-row"><input type="checkbox" data-show-gravity-wells /> Show gravity fields</label>
                  <p class="debug-note">${WORLD_SCALE_NOTE}</p>
                </section>
                <section class="debug-section debug-section-wide">
                  <label>HUD Layout Editor</label>
                  <label class="checkbox-row inline"><input type="checkbox" data-ui-edit-enabled /> Enable UI edit tools</label>
                  <div class="scope-toggle" data-ui-scope-toggle>
                    <button type="button" data-ui-scope="selected">Selected Panel</button>
                    <button type="button" data-ui-scope="all">All Panels</button>
                  </div>
                  <select data-panel-select></select>
                  <label class="slider-row"><span>Selected Scale</span><input type="range" min="0.7" max="1.5" step="0.01" data-ui-scale /></label>
                  <div class="button-row">
                    <button data-ui-save>Save Layout</button>
                    <button data-ui-reset>Reset Layout</button>
                  </div>
                  <p data-ui-edit-status></p>
                  <div class="zone-map" data-zone-map>
                    ${UI_ZONES.map(
                      (zone) => `<button type="button" class="zone-node" data-zone-id="${zone.id}" style="left:${zone.center[0] * 100}%;top:${zone.center[1] * 100}%">${zone.id}</button>`
                    ).join("")}
                  </div>
                </section>
              </div>
              <div class="debug-lower">
                <section class="debug-section controller-section">
                  <label>Xbox 360 Input Visualizer</label>
                  <div class="controller-visual" data-controller-visual>
                    <div class="controller-shell">
                      <div class="controller-stick left" data-stick="left"><div class="controller-thumb"></div></div>
                      <div class="controller-stick right" data-stick="right"><div class="controller-thumb"></div></div>
                      <div class="controller-button face x" data-gp-button="2">X</div>
                      <div class="controller-button face a" data-gp-button="0">A</div>
                      <div class="controller-button face b" data-gp-button="1">B</div>
                      <div class="controller-button face y" data-gp-button="3">Y</div>
                      <div class="controller-button center back" data-gp-button="8">Back</div>
                      <div class="controller-button center start" data-gp-button="9">Start</div>
                      <div class="controller-button shoulder lb" data-gp-button="4">LB</div>
                      <div class="controller-button shoulder rb" data-gp-button="5">RB</div>
                      <div class="controller-button shoulder rt" data-gp-button="7">RT</div>
                      <div class="controller-dpad up" data-gp-button="12"></div>
                      <div class="controller-dpad down" data-gp-button="13"></div>
                      <div class="controller-dpad left" data-gp-button="14"></div>
                      <div class="controller-dpad right" data-gp-button="15"></div>
                    </div>
                    <p data-controller-status>Waiting for controller...</p>
                  </div>
                </section>
                <section class="debug-section keymap-section">
                  <label>Keyboard Remapping</label>
                  <div class="keymap-list" data-keymap-list></div>
                </section>
              </div>
              <div class="debug-readout" data-debug-readout></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.displayStageNode = this.root.querySelector("[data-display-stage]");
    this.canvas = this.root.querySelector(".space-canvas");
    this.cockpitOverlayNode = this.root.querySelector("[data-cockpit-overlay]");
    this.cameraModeNode = this.root.querySelector("[data-camera-mode]");
    this.nearestNode = this.root.querySelector("[data-nearest]");
    this.targetNode = this.root.querySelector("[data-target]");
    this.boostStateNode = this.root.querySelector("[data-boost-state]");
    this.dustCountNode = this.root.querySelector("[data-dust-count]");
    this.scannerStatusNode = this.root.querySelector("[data-scanner-status]");
    this.gravityStatusNode = this.root.querySelector("[data-gravity-status]");
    this.meterFillNodes = {
      oxygen: this.root.querySelector('[data-meter-fill="oxygen"]'),
      water: this.root.querySelector('[data-meter-fill="water"]'),
      engine: this.root.querySelector('[data-meter-fill="engine"]')
    };
    this.meterValueNodes = {
      oxygen: this.root.querySelector('[data-meter-value="oxygen"]'),
      water: this.root.querySelector('[data-meter-value="water"]'),
      engine: this.root.querySelector('[data-meter-value="engine"]')
    };
    this.debugNode = this.root.querySelector("[data-debug]");
    this.debugReadoutNode = this.root.querySelector("[data-debug-readout]");
    this.seatModeNode = this.root.querySelector("[data-seat-mode]");
    this.introNode = this.root.querySelector("[data-intro]");
    this.pauseNode = this.root.querySelector("[data-pause]");
    this.lessonOverlayNode = this.root.querySelector("[data-lesson-overlay]");
    this.lessonTitleNode = this.root.querySelector("[data-lesson-title]");
    this.lessonBodyNode = this.root.querySelector("[data-lesson-body]");
    this.lessonModuleNode = this.root.querySelector("[data-lesson-module]");
    this.lessonStepNode = this.root.querySelector("[data-lesson-step]");
    this.uiEditStatusNode = this.root.querySelector("[data-ui-edit-status]");
    this.controllerStatusNode = this.root.querySelector("[data-controller-status]");
    this.panelSelectNode = this.root.querySelector("[data-panel-select]");
    this.uiScaleNode = this.root.querySelector("[data-ui-scale]");
    this.uiEditEnabledNode = this.root.querySelector("[data-ui-edit-enabled]");
    this.debugWindowNode = this.root.querySelector("[data-debug-window]");
    this.zoneMapNode = this.root.querySelector("[data-zone-map]");
    this.panelNodes = new Map();
    this.pauseButtons = Array.from(this.root.querySelectorAll("[data-menu-item]"));
    this.lessonButtons = this.pauseButtons.filter((button) => button.dataset.lessonLaunch);

    for (const panel of this.root.querySelectorAll("[data-ui-panel]")) {
      this.panelNodes.set(panel.dataset.uiPanel, panel);
    }

    this.initializeUiTransformHandles();

    this.root.querySelector("[data-start-btn]").addEventListener("click", () => {
      this.ensureAudio();
      this.introNode.classList.add("hidden");
    });
    this.root.querySelector("[data-intro-dismiss]").addEventListener("click", () => {
      this.ensureAudio();
      this.introNode.classList.add("hidden");
    });
    this.root.querySelector("[data-pause-resume]").addEventListener("click", () => {
      this.playUiBlip(660, 0.08);
      this.resumeFromPause();
    });
    this.root.querySelector("[data-pause-earth]").addEventListener("click", () => {
      this.playUiBlip(560, 0.08);
      this.resetPlayerToEarth();
      this.resumeFromPause();
    });
    this.root.querySelector("[data-pause-debug]").addEventListener("click", () => {
      this.playUiBlip(520, 0.08);
      this.debugVisible = true;
      this.updateDebugVisibility();
    });
    for (const button of this.root.querySelectorAll("[data-lesson-launch]")) {
      button.addEventListener("click", () => {
        this.openLesson(button.dataset.lessonLaunch);
      });
    }
    this.root.querySelector("[data-lesson-prev]").addEventListener("click", () => {
      this.shiftLessonStep(-1);
    });
    this.root.querySelector("[data-lesson-next]").addEventListener("click", () => {
      this.shiftLessonStep(1);
    });
    this.root.querySelector("[data-lesson-exit]").addEventListener("click", () => {
      this.closeLesson();
    });
    for (const button of this.root.querySelectorAll("[data-debug-close], [data-debug-close-secondary]")) {
      button.addEventListener("click", () => {
        this.debugVisible = false;
        this.updateDebugVisibility();
      });
    }
    this.root.querySelector("[data-toggle-mode]").addEventListener("click", () => {
      this.input.toggleMode = !this.input.toggleMode;
    });
    this.root.querySelector("[data-reset-bindings]").addEventListener("click", () => {
      this.input.resetBindings();
      this.refreshKeymapList();
    });
    for (const button of this.root.querySelectorAll("[data-zone-id]")) {
      button.addEventListener("click", () => {
        this.zoneSelection = button.dataset.zoneId;
        this.uiEditStatusNode.textContent = `Zone ${this.zoneSelection} selected. Drag panels physically or use the Scientist stick to place them.`;
        this.updateZoneMap();
      });
    }

    this.initializeSeatCards();
    this.initializePanelSelector();
    this.initializeDebugControls();
    this.initializeUiTransformInteraction();
    this.initializeEditableText();
    this.refreshKeymapList();
    this.applyTextOverrides();
    this.applyUILayout();
    this.updateZoneMap();
    this.updateMenuFocus();
  }

  initializeSeatCards() {
    const seatGrid = this.root.querySelector("[data-seat-grid]");
    this.seatNodes = {};
    for (const role of ROLE_ORDER) {
      const meta = ROLE_META[role];
      const seat = document.createElement("div");
      seat.className = "seat-card";
      seat.dataset.seatRole = role;
      seat.setAttribute("role", "button");
      seat.setAttribute("tabindex", "0");
      seat.setAttribute("aria-pressed", "false");
      seat.style.setProperty("--seat-color", meta.color);
      seat.innerHTML = `
        <div class="seat-icon"></div>
        <div class="seat-copy">
          <span class="seat-name editable-text" data-editable-key="seat_${role}_name">${meta.label}</span>
          <span class="seat-hint editable-text" data-editable-key="seat_${role}_hint">${meta.button} + ${meta.control}</span>
        </div>
      `;
      seat.addEventListener("click", (event) => {
        if (event.target.closest("[data-editable-key]")) {
          return;
        }
        this.input.toggleSeatOverride(role);
        this.introNode.classList.add("hidden");
        this.updateUi(TIME_STEP);
      });
      seat.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.input.toggleSeatOverride(role);
        this.introNode.classList.add("hidden");
        this.updateUi(TIME_STEP);
      });
      seatGrid.appendChild(seat);
      this.seatNodes[role] = seat;
    }
  }

  initializeUiTransformHandles() {
    for (const [panelId, node] of this.panelNodes.entries()) {
      node.dataset.panelId = panelId;
      const tools = document.createElement("div");
      tools.className = "ui-transform-tools";
      tools.innerHTML = `
        <button type="button" class="ui-transform-handle move" data-ui-handle="move" data-panel-id="${panelId}" title="Drag to move ${panelId}">Move</button>
        <button type="button" class="ui-transform-handle scale" data-ui-handle="scale" data-panel-id="${panelId}" title="Drag to scale ${panelId}">Scale</button>
      `;
      node.appendChild(tools);
    }
  }

  initializeUiTransformInteraction() {
    this.root.addEventListener("pointerdown", (event) => {
      if (!this.debugVisible || !this.uiEditEnabled) {
        return;
      }

      const panelNode = event.target.closest?.("[data-ui-panel]");
      if (panelNode) {
        this.selectedPanelId = panelNode.dataset.uiPanel;
        this.panelSelectNode.value = this.selectedPanelId;
        this.applyUILayout();
      }

      const handle = event.target.closest?.("[data-ui-handle]");
      if (!handle) {
        return;
      }

      event.preventDefault();
      const panelId = handle.dataset.panelId;
      const layout = this.uiLayout[panelId];
      if (!layout) {
        return;
      }

      this.selectedPanelId = panelId;
      this.panelSelectNode.value = panelId;
      this.uiTransformState = {
        panelId,
        handle: handle.dataset.uiHandle,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layout }
      };
      this.applyUILayout();
    });

    window.addEventListener("pointermove", (event) => {
      if (!this.uiTransformState) {
        return;
      }

      const layout = this.uiLayout[this.uiTransformState.panelId];
      if (!layout) {
        return;
      }

      const deltaX = event.clientX - this.uiTransformState.startX;
      const deltaY = event.clientY - this.uiTransformState.startY;

      if (this.uiTransformState.handle === "move") {
        layout.x = this.uiTransformState.startLayout.x + deltaX;
        layout.y = this.uiTransformState.startLayout.y + deltaY;
      } else {
        const scaleDelta = (deltaX - deltaY) * 0.0035;
        layout.scale = THREE.MathUtils.clamp(
          this.uiTransformState.startLayout.scale + scaleDelta,
          0.7,
          1.5
        );
      }

      this.applyUILayout();
    });

    window.addEventListener("pointerup", () => {
      this.uiTransformState = null;
    });
  }

  initializePanelSelector() {
    this.panelSelectNode.innerHTML = PANEL_ORDER.map(
      (panel) => `<option value="${panel.id}">${panel.label}</option>`
    ).join("");
    this.panelSelectNode.value = this.selectedPanelId;
    this.panelSelectNode.addEventListener("change", () => {
      this.selectedPanelId = this.panelSelectNode.value;
      this.uiScaleNode.value = this.uiLayout[this.selectedPanelId].scale;
      this.applyUILayout();
    });
  }

  initializeDebugControls() {
    for (const input of this.root.querySelectorAll("[data-setting]")) {
      const key = input.dataset.setting;
      input.value = this.debugSettings[key];
      input.addEventListener("input", () => {
        this.debugSettings[key] = Number(input.value);
        this.persistDebugSettings();
      });
    }

    const flightAssistNode = this.root.querySelector("[data-flight-assist]");
    const invertCameraStepNode = this.root.querySelector("[data-invert-camera-step]");
    const constellationsNode = this.root.querySelector("[data-show-constellations]");
    const constellationLabelsNode = this.root.querySelector(
      "[data-show-constellation-labels]"
    );
    const gravityWellsNode = this.root.querySelector("[data-show-gravity-wells]");
    flightAssistNode.checked = this.debugSettings.flightAssist;
    invertCameraStepNode.checked = this.debugSettings.invertCameraStep;
    constellationsNode.checked = this.debugSettings.showConstellations;
    constellationLabelsNode.checked = this.debugSettings.showConstellationLabels;
    gravityWellsNode.checked = this.debugSettings.showGravityWells;

    flightAssistNode.addEventListener("change", () => {
      this.debugSettings.flightAssist = flightAssistNode.checked;
      this.persistDebugSettings();
    });
    invertCameraStepNode.addEventListener("change", () => {
      this.debugSettings.invertCameraStep = invertCameraStepNode.checked;
      this.persistDebugSettings();
    });
    constellationsNode.addEventListener("change", () => {
      this.debugSettings.showConstellations = constellationsNode.checked;
      this.persistDebugSettings();
    });
    constellationLabelsNode.addEventListener("change", () => {
      this.debugSettings.showConstellationLabels = constellationLabelsNode.checked;
      this.persistDebugSettings();
    });
    gravityWellsNode.addEventListener("change", () => {
      this.debugSettings.showGravityWells = gravityWellsNode.checked;
      this.persistDebugSettings();
    });

    this.uiEditEnabledNode.checked = this.uiEditEnabled;
    this.uiEditEnabledNode.addEventListener("change", () => {
      this.uiEditEnabled = this.uiEditEnabledNode.checked;
      this.applyUILayout();
    });
    for (const button of this.root.querySelectorAll("[data-ui-scope]")) {
      button.addEventListener("click", () => {
        this.uiEditScope = button.dataset.uiScope;
        this.applyUILayout();
      });
    }
    this.root.querySelector("[data-ui-save]").addEventListener("click", () => {
      this.saveUILayout();
    });
    this.root.querySelector("[data-ui-reset]").addEventListener("click", () => {
      this.resetUILayout();
    });

    this.uiScaleNode.value = this.uiLayout[this.selectedPanelId].scale;
    this.uiScaleNode.addEventListener("input", () => {
      this.uiLayout[this.selectedPanelId].scale = Number(this.uiScaleNode.value);
      this.applyUILayout();
    });
  }

  initializeEditableText() {
    this.root.addEventListener("dblclick", (event) => {
      const target = event.target.closest("[data-editable-key]");
      if (!target) {
        return;
      }
      target.setAttribute("contenteditable", "plaintext-only");
      target.classList.add("editing-text");
      target.focus();
      document.getSelection()?.selectAllChildren(target);
    });

    this.root.addEventListener("keydown", (event) => {
      const target = event.target.closest?.("[data-editable-key]");
      if (!target || target.getAttribute("contenteditable") !== "plaintext-only") {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        target.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const key = target.dataset.editableKey;
        target.textContent = this.textOverrides[key] ?? target.textContent;
        target.blur();
      }
    });

    this.root.addEventListener(
      "blur",
      (event) => {
        const target = event.target.closest?.("[data-editable-key]");
        if (!target || target.getAttribute("contenteditable") !== "plaintext-only") {
          return;
        }
        target.removeAttribute("contenteditable");
        target.classList.remove("editing-text");
        this.textOverrides[target.dataset.editableKey] = target.textContent.trim();
        this.saveStoredJSON(TEXT_STORAGE_KEY, this.textOverrides);
      },
      true
    );
  }

  applyTextOverrides() {
    for (const node of this.root.querySelectorAll("[data-editable-key]")) {
      const key = node.dataset.editableKey;
      if (this.textOverrides[key]) {
        node.textContent = this.textOverrides[key];
      }
    }
  }

  refreshKeymapList() {
    const list = this.root.querySelector("[data-keymap-list]");
    list.innerHTML = "";
    const entriesById = new Map(
      this.input.getBindingEntries().map((entry) => [entry.id, entry])
    );
    for (const group of KEYMAP_GROUPS) {
      const section = document.createElement("section");
      section.className = "keymap-group";
      section.innerHTML = `
        <div class="keymap-group-title">${group.label}</div>
        <div class="keymap-group-grid"></div>
      `;
      const grid = section.querySelector(".keymap-group-grid");
      for (const actionId of group.ids) {
        const entry = entriesById.get(actionId);
        if (!entry) {
          continue;
        }
        const row = document.createElement("div");
        row.className = "keymap-row";
        row.innerHTML = `
          <span class="keymap-label">${entry.label}</span>
          <button type="button" data-bind-action="${entry.id}">${entry.key}</button>
        `;
        const button = row.querySelector("button");
        button.addEventListener("click", () => {
          this.input.startRemap(entry.id);
          this.refreshKeymapList();
        });
        if (this.input.remapPendingAction === entry.id) {
          button.textContent = "Press key";
          row.classList.add("pending");
        }
        grid.appendChild(row);
      }
      list.appendChild(section);
    }
    this.lastRemapPendingAction = this.input.remapPendingAction;
  }

  updateZoneMap() {
    if (!this.zoneMapNode) {
      return;
    }
    for (const node of this.zoneMapNode.querySelectorAll("[data-zone-id]")) {
      node.classList.toggle("selected", node.dataset.zoneId === this.zoneSelection);
    }
  }

  openLesson(lessonId) {
    const lesson = EDUCATION_MODULES.find((item) => item.id === lessonId);
    if (!lesson) {
      return;
    }
    this.ensureAudio();
    this.activeLesson = lesson;
    this.activeLessonStep = 0;
    this.lessonSelectionIndex = 1;
    this.lessonOverlayNode.classList.remove("hidden");
    this.updateLessonContent();
    this.updateMenuFocus();
    this.playUiBlip(690, 0.08);
  }

  closeLesson() {
    if (!this.activeLesson) {
      return;
    }
    this.activeLesson = null;
    this.activeLessonStep = 0;
    this.lessonOverlayNode.classList.add("hidden");
    this.updateMenuFocus();
    this.playUiBlip(460, 0.08);
  }

  shiftLessonStep(direction) {
    if (!this.activeLesson) {
      return;
    }
    const maxIndex = this.activeLesson.slides.length - 1;
    this.activeLessonStep = THREE.MathUtils.clamp(
      this.activeLessonStep + direction,
      0,
      maxIndex
    );
    this.updateLessonContent();
    this.playUiBlip(direction > 0 ? 760 : 560, 0.05);
  }

  updateLessonContent() {
    if (!this.activeLesson) {
      return;
    }
    const slide = this.activeLesson.slides[this.activeLessonStep];
    this.lessonTitleNode.textContent = slide.title;
    this.lessonBodyNode.textContent = slide.body;
    this.lessonModuleNode.textContent = this.activeLesson.title;
    this.lessonStepNode.textContent = `${this.activeLessonStep + 1} / ${this.activeLesson.slides.length}`;
  }

  updateMenuFocus() {
    const lessonNodes = [
      this.root.querySelector("[data-lesson-prev]"),
      this.root.querySelector("[data-lesson-next]"),
      this.root.querySelector("[data-lesson-exit]")
    ].filter(Boolean);

    for (const node of [...this.pauseButtons, ...lessonNodes]) {
      node.classList.remove("menu-selected");
    }

    const activeNodes = this.activeLesson ? lessonNodes : this.pauseButtons;
    const selectedIndex = this.activeLesson
      ? this.lessonSelectionIndex
      : this.pauseSelectionIndex;
    activeNodes[selectedIndex]?.classList.add("menu-selected");
  }

  applyUILayout() {
    for (const panel of PANEL_ORDER) {
      const node = this.panelNodes.get(panel.id);
      const layout = this.uiLayout[panel.id];
      if (!node || !layout) {
        continue;
      }
      node.style.transform = `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`;
      const toolsVisible =
        this.debugVisible &&
        this.uiEditEnabled &&
        (this.uiEditScope === "all" || this.selectedPanelId === panel.id);
      node.classList.toggle("ui-edit-active", toolsVisible);
      node.classList.toggle(
        "ui-selected",
        this.debugVisible && this.uiEditEnabled && this.selectedPanelId === panel.id
      );
    }
    this.uiScaleNode.value = this.uiLayout[this.selectedPanelId].scale;
    this.uiEditEnabledNode.checked = this.uiEditEnabled;
    for (const button of this.root.querySelectorAll("[data-ui-scope]")) {
      button.classList.toggle("active", button.dataset.uiScope === this.uiEditScope);
    }
  }

  saveUILayout() {
    this.saveStoredJSON(UI_LAYOUT_STORAGE_KEY, this.uiLayout);
    this.uiEditStatusNode.textContent = "HUD layout saved to local storage.";
  }

  resetUILayout() {
    this.uiLayout = structuredClone(DEFAULT_UI_LAYOUT);
    this.applyUILayout();
    this.saveStoredJSON(UI_LAYOUT_STORAGE_KEY, this.uiLayout);
    this.uiEditStatusNode.textContent = "HUD layout reset to defaults.";
  }

  persistDebugSettings() {
    this.saveStoredJSON(DEBUG_STORAGE_KEY, this.debugSettings);
  }

  getDisplaySize() {
    const rect = this.displayStageNode?.getBoundingClientRect?.();
    return {
      width: Math.max(1, Math.round(rect?.width || window.innerWidth)),
      height: Math.max(1, Math.round(rect?.height || window.innerHeight))
    };
  }

  configureTexture(texture, { srgb = false, repeatS = false, repeatT = false } = {}) {
    if (!texture) {
      return texture;
    }
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  loadSurfaceTextures() {
    const loader = new THREE.TextureLoader();
    const texturePath = (fileName) => `${import.meta.env.BASE_URL}textures/${fileName}`;
    return {
      earthColor: this.configureTexture(loader.load(texturePath("earth_color_nasa.jpg")), {
        srgb: true
      }),
      earthHeight: this.configureTexture(loader.load(texturePath("earth_height_nasa.png"))),
      earthNormal: this.configureTexture(loader.load(texturePath("earth_normal_nasa.png"))),
      earthOceanMask: this.configureTexture(loader.load(texturePath("earth_ocean_mask_nasa.png"))),
      moonColor: this.configureTexture(loader.load(texturePath("moon_color_nasa.jpg")), {
        srgb: true
      }),
      moonHeight: this.configureTexture(loader.load(texturePath("moon_height_nasa.png"))),
      moonNormal: this.configureTexture(loader.load(texturePath("moon_normal_nasa.png"))),
      milkyway: this.configureTexture(loader.load(texturePath("milkyway_nasa_4k.jpg")), {
        srgb: true
      })
    };
  }

  setupThree() {
    const { width, height } = this.getDisplaySize();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020611, 0.00022);

    this.camera = new THREE.PerspectiveCamera(
      58,
      width / height,
      0.1,
      5000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.physicallyCorrectLights = true;
    this.surfaceTextures = this.loadSurfaceTextures();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this.debugSettings.bloomStrength,
      0.82,
      0.3
    );
    this.composer.addPass(this.bloomPass);

    window.addEventListener("resize", () => this.onResize());
  }

  createScene() {
    this.scene.add(new THREE.AmbientLight(0x8fb8ff, 0.12));

    const fillLight = new THREE.DirectionalLight(0x9bc5ff, 0.18);
    fillLight.position.set(-1, 0.4, 1).multiplyScalar(320);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x6fb7ff, 0.15);
    rimLight.position.set(1, -0.25, -1).multiplyScalar(260);
    this.scene.add(rimLight);

    this.solarRoot = new THREE.Group();
    this.scene.add(this.solarRoot);

    this.farStars = this.createStarfield(7800, 1800, 0xffffff, 1.15, 0.94);
    this.midStars = this.createStarfield(1200, 1500, 0x98c8ff, 2.5, 0.82);
    this.nebulaBand = this.createNebulaBand();
    this.galaxyVolume = this.createGalaxyVolume();
    this.scene.add(this.farStars);
    this.scene.add(this.midStars);
    this.scene.add(this.nebulaBand);
    this.scene.add(this.galaxyVolume);

    this.skyAnchor = new THREE.Group();
    this.scene.add(this.skyAnchor);
    this.milkyWayShell = this.createMilkyWayShell();
    this.skyAnchor.add(this.milkyWayShell);
    this.constellationGroup = this.createConstellationOverlay();
    this.skyAnchor.add(this.constellationGroup);

    this.sun = this.createSun();
    this.solarRoot.add(this.sun.group);
    this.solarRoot.add(this.sun.light);

    for (const bodyData of SOLAR_BODIES) {
      const body = this.createPlanet(bodyData);
      body.orbitTrail = this.createOrbitGuide(bodyData);
      this.worldBodies.push(body);
      this.solarRoot.add(body.group);
      this.solarRoot.add(body.orbitTrail.line);
    }

    const earthBody = this.worldBodies.find((body) => body.data.name === "Earth");
    this.moon = this.createPlanet(MOON_DATA, true);
    this.moon.orbitTrail = this.createOrbitGuide(MOON_DATA, true);
    earthBody.group.add(this.moon.group);
    this.worldBodies.push(this.moon);
    earthBody.group.add(this.moon.orbitTrail.line);

    this.artemisCurve = new THREE.CatmullRomCurve3([]);
    this.artemisLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x98f6ff,
        transparent: true,
        opacity: 0.82
      })
    );
    this.scene.add(this.artemisLine);

    this.specialLocations = SPECIAL_LOCATIONS.map((location) =>
      this.createSpecialLocation(location)
    );
    for (const location of this.specialLocations) {
      this.scene.add(location.group);
    }

    this.playerShip = this.createShip({
      hull: 0xffc66a,
      glow: 0xfff2b8,
      scale: 0.14
    });
    this.scene.add(this.playerShip.group);

    this.artemisShip = this.createShip({
      hull: 0x90f6ff,
      glow: 0xe9fdff,
      scale: 0.11
    });
    this.scene.add(this.artemisShip.group);

    this.exhibitStation = this.createExhibitStationModel();
    this.scene.add(this.exhibitStation);

    this.playerTrail = this.createTrail(0xffc66a, 0.58);
    this.artemisTrail = this.createTrail(0x98f6ff, 0.52);
    this.scene.add(this.playerTrail.line);
    this.scene.add(this.artemisTrail.line);

    this.spaceDust = this.createSpaceDust();
    this.scene.add(this.spaceDust.points);
    this.scannerCone = this.createScannerCone();
    this.scene.add(this.scannerCone);
    this.gravityFieldGroup = this.createGravityFieldGroup();
    this.scene.add(this.gravityFieldGroup);
    this.cockpitInterior = this.createCockpitInterior();
    this.camera.add(this.cockpitInterior);
    this.scene.add(this.camera);
  }

  getSolarRootOffsetAtTime(time) {
    return new THREE.Vector3(0, 0, 0);
  }

  getOrbitLocalPositionAtTime(data, time) {
    const angularVelocity =
      (Math.PI * 2) / Math.max(data.orbitPeriodSeconds ?? 240, 1);
    const angle = data.angle + time * angularVelocity;
    const eccentricity = data.eccentricity ?? 0;
    const a = data.orbitRadius;
    const b = a * Math.sqrt(Math.max(0.1, 1 - eccentricity * eccentricity));
    const local = new THREE.Vector3(
      a * (Math.cos(angle) - eccentricity),
      0,
      b * Math.sin(angle)
    );
    local.applyAxisAngle(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(data.inclinationDeg ?? 0)
    );
    return local;
  }

  getMoonLocalPositionAtTime(time) {
    const angularVelocity =
      (Math.PI * 2) / Math.max(MOON_DATA.orbitPeriodSeconds ?? 32, 1);
    const angle = MOON_DATA.angle + time * angularVelocity;
    const a = MOON_DATA.orbitRadius;
    const e = MOON_DATA.eccentricity ?? 0;
    const b = a * Math.sqrt(Math.max(0.1, 1 - e * e));
    const local = new THREE.Vector3(
      a * (Math.cos(angle) - e),
      0,
      b * Math.sin(angle)
    );
    local.applyAxisAngle(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(MOON_DATA.inclinationDeg ?? 5.1)
    );
    return local;
  }

  getBodyWorldPositionAtTime(body, time) {
    const solarOffset = this.getSolarRootOffsetAtTime(time);
    if (body.isMoon) {
      const earthPosition = this.getOrbitLocalPositionAtTime(
        SOLAR_BODIES.find((item) => item.name === "Earth"),
        time
      );
      return solarOffset.add(earthPosition).add(this.getMoonLocalPositionAtTime(time));
    }
    return solarOffset.add(this.getOrbitLocalPositionAtTime(body.data, time));
  }

  createSun() {
    const group = new THREE.Group();
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(18, 56, 56),
      new THREE.MeshBasicMaterial({ color: 0xffd06b })
    );
    group.add(sunMesh);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(24, 40, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd98a,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(glow);

    const light = new THREE.PointLight(0xffefb4, 2.3, 0, 1.35);
    light.position.set(0, 0, 0);
    return { group, light };
  }

  createPlanet(data, isMoon = false) {
    const group = new THREE.Group();
    const useEarthAssets = data.name === "Earth";
    const useMoonAssets = data.name === "Moon";
    const highRelief = useEarthAssets || useMoonAssets;
    const sphereGeometry = new THREE.SphereGeometry(
      data.radius,
      highRelief ? 192 : 52,
      highRelief ? 128 : 52
    );
    const surfaceMaterial = new THREE.MeshStandardMaterial({
      map: useEarthAssets
        ? this.surfaceTextures.earthColor
        : useMoonAssets
          ? this.surfaceTextures.moonColor
          : this.createPlanetTexture(data),
      normalMap: useEarthAssets
        ? this.surfaceTextures.earthNormal
        : useMoonAssets
          ? this.surfaceTextures.moonNormal
          : null,
      displacementMap: useEarthAssets
        ? this.surfaceTextures.earthHeight
        : useMoonAssets
          ? this.surfaceTextures.moonHeight
          : null,
      displacementScale: useEarthAssets ? 0.18 : useMoonAssets ? 0.34 : 0,
      displacementBias: useEarthAssets ? -0.09 : useMoonAssets ? -0.17 : 0,
      emissive:
        data.name === "Earth" ? new THREE.Color(0x17396b) : new THREE.Color(0x000000),
      emissiveIntensity: data.name === "Earth" ? 0.08 : 0,
      roughness: useEarthAssets ? 0.98 : useMoonAssets ? 0.95 : data.name === "Earth" ? 0.86 : 0.94,
      metalness: 0.02
    });
    if (surfaceMaterial.normalMap) {
      surfaceMaterial.normalScale = new THREE.Vector2(1.15, 1.15);
    }
    const sphere = new THREE.Mesh(
      sphereGeometry,
      surfaceMaterial
    );
    group.add(sphere);

    if (data.cloudColor) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * 1.03, highRelief ? 128 : 44, highRelief ? 96 : 44),
        new THREE.MeshStandardMaterial({
          map: this.createCloudTexture(data),
          transparent: true,
          opacity: data.name === "Earth" ? 0.74 : 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          roughness: 1
        })
      );
      clouds.userData.rotationSpeed = data.name === "Earth" ? 0.07 : 0.03;
      group.add(clouds);
      group.userData.clouds = clouds;
    }

    if (useEarthAssets) {
      const ocean = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * 1.013, 192, 128),
        this.createTidalOceanMaterial()
      );
      group.add(ocean);
      group.userData.ocean = ocean;
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius * (isMoon ? 1.01 : 1.11), highRelief ? 128 : 52, highRelief ? 96 : 52),
      this.createAtmosphereMaterial(data.glow)
    );
    group.add(atmosphere);
    group.userData.atmosphere = atmosphere;

    if (data.ringColor) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(data.radius * 1.35, data.radius * 2.18, 112),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(data.ringColor),
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = Math.PI / 2.85;
      ring.rotation.y = Math.PI / 6;
      group.add(ring);
    }

    const label = this.createLabelSprite(data.name, data.glow);
    label.position.set(0, data.radius * 1.95, 0);
    label.visible = false;
    group.add(label);

    return {
      data,
      group,
      sphere,
      label,
      isMoon,
      collisionRadius: data.radius + (useEarthAssets ? 0.36 : useMoonAssets ? 0.28 : 0.18)
    };
  }

  createAtmosphereMaterial(color) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        glowStrength: { value: 0.24 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPosition.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float glowStrength;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 3.1);
          gl_FragColor = vec4(glowColor, fresnel * glowStrength);
        }
      `
    });
  }

  createTidalOceanMaterial() {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x7bc0ff,
      alphaMap: this.surfaceTextures.earthOceanMask,
      transparent: true,
      opacity: 0.74,
      transmission: 0.12,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      depthWrite: false
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.moonDirection = { value: new THREE.Vector3(1, 0, 0) };
      shader.uniforms.time = { value: 0 };
      material.userData.shader = shader;
      shader.vertexShader =
        `
          uniform vec3 moonDirection;
          uniform float time;
        ` + shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
            float tideFront = pow(max(dot(normalize(objectNormal), normalize(moonDirection)), 0.0), 4.0);
            float tideBack = pow(max(dot(normalize(objectNormal), -normalize(moonDirection)), 0.0), 4.0);
            float ripple = sin((position.y + position.x * 0.6 + time * 0.35) * 12.0) * 0.004;
            transformed += normalize(objectNormal) * ((tideFront + tideBack) * 0.085 + ripple);
          `
        );
      shader.fragmentShader =
        `
          uniform vec3 moonDirection;
        ` + shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
            float fresnelOcean = pow(1.0 - max(dot(normalize(normal), normalize(-vViewPosition)), 0.0), 2.6);
            totalEmissiveRadiance += vec3(0.02, 0.09, 0.2) * fresnelOcean;
          `
        );
    };

    return material;
  }

  createOrbitRing(radius, color) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
    const points = curve.getPoints(200).map((point) => new THREE.Vector3(point.x, 0, point.y));
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.16
      })
    );
  }

  getParticleTexture() {
    if (this.particleTexture) {
      return this.particleTexture;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.24, "rgba(255,255,255,0.94)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.24)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.particleTexture = new THREE.CanvasTexture(canvas);
    this.particleTexture.colorSpace = THREE.SRGBColorSpace;
    return this.particleTexture;
  }

  createStarfield(count, radius, color, size, opacity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const r = radius * (0.25 + Math.random() * 0.75);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint = baseColor
        .clone()
        .offsetHSL(THREE.MathUtils.randFloatSpread(0.03), 0, Math.random() * 0.14);
      colors[i * 3 + 0] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.getParticleTexture(),
        size,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.02
      })
    );
  }

  createNebulaBand() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    for (let i = 0; i < 260; i += 1) {
      positions.push(
        THREE.MathUtils.randFloatSpread(1400),
        THREE.MathUtils.randFloatSpread(140),
        THREE.MathUtils.randFloatSpread(1400)
      );
      const color = new THREE.Color().setHSL(
        0.56 + Math.random() * 0.1,
        0.36,
        0.42 + Math.random() * 0.26
      );
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.getParticleTexture(),
        size: 20,
        vertexColors: true,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.02
      })
    );
  }

  createGalaxyVolume() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    for (let i = 0; i < 1800; i += 1) {
      const arm = i % 4;
      const radius = 180 + Math.random() * 1850;
      const armAngle = arm * (Math.PI / 2);
      const spiralTwist = radius * 0.0032;
      const angle = armAngle + spiralTwist + THREE.MathUtils.randFloatSpread(0.52);
      const spread = 40 + radius * 0.06;
      const x = Math.cos(angle) * radius + THREE.MathUtils.randFloatSpread(spread);
      const y = THREE.MathUtils.randFloatSpread(150) * (0.35 + radius / 2200);
      const z =
        Math.sin(angle) * radius * 0.56 + THREE.MathUtils.randFloatSpread(spread * 1.2);
      positions.push(x, y, z);

      const color = new THREE.Color().setHSL(
        0.56 + Math.random() * 0.14,
        0.42 + Math.random() * 0.16,
        0.42 + Math.random() * 0.3
      );
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.getParticleTexture(),
        size: 10,
        vertexColors: true,
        transparent: true,
        opacity: 0.046,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.02
      })
    );
    points.rotation.set(-0.24, 0.52, 0.16);
    return points;
  }

  createMilkyWayShell() {
    const material = new THREE.MeshBasicMaterial({
      map: this.surfaceTextures.milkyway,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.42
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(2400, 64, 40), material);
    shell.rotation.y = Math.PI * 0.82;
    shell.rotation.z = THREE.MathUtils.degToRad(26);
    return shell;
  }

  createCockpitInterior() {
    const group = new THREE.Group();
    group.visible = false;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d1119,
      roughness: 0.74,
      metalness: 0.46
    });
    const glassMaterial = new THREE.MeshBasicMaterial({
      color: 0x7fb6ff,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending
    });

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
      glassMaterial
    );
    canopy.scale.set(1.4, 0.82, 1.8);
    canopy.position.set(0, 0.18, -0.14);
    canopy.rotation.x = Math.PI / 2;
    group.add(canopy);

    const dashboard = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.32, 1.18),
      frameMaterial
    );
    dashboard.position.set(0, -0.58, -0.16);
    group.add(dashboard);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.36, 0.12),
        frameMaterial
      );
      strut.position.set(side * 0.68, -0.02, -0.08);
      strut.rotation.z = side * 0.42;
      group.add(strut);

      const console = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.26, 0.96),
        frameMaterial
      );
      console.position.set(side * 0.84, -0.46, 0.08);
      console.rotation.z = side * 0.18;
      group.add(console);
    }

    const topRib = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.04, 12, 40, Math.PI),
      frameMaterial
    );
    topRib.position.set(0, 0.18, -0.12);
    topRib.rotation.z = Math.PI;
    group.add(topRib);

    const hudGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0x8ac8ff,
        transparent: true,
        opacity: 0.22
      })
    );
    hudGlow.position.set(0, -0.42, -0.66);
    group.add(hudGlow);

    return group;
  }

  createConstellationOverlay() {
    const group = new THREE.Group();
    this.constellationStars = [];
    this.constellationLines = [];
    this.constellationLabels = [];

    for (const constellation of CONSTELLATIONS) {
      const radius = 920;
      const starMap = new Map();
      const linePoints = [];

      for (const star of constellation.stars) {
        const direction = new THREE.Vector3(...star.position).normalize();
        const position = direction.multiplyScalar(radius);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(star.size * 0.22, 16, 16),
          new THREE.MeshBasicMaterial({
            color: constellation.color,
            transparent: true,
            opacity: 0.95
          })
        );
        mesh.position.copy(position);
        group.add(mesh);
        starMap.set(star.id, position.clone());
        this.constellationStars.push(mesh);
      }

      for (const lane of constellation.lanes) {
        linePoints.push(starMap.get(lane[0]).clone(), starMap.get(lane[1]).clone());
      }

      const line = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(linePoints),
        new THREE.LineBasicMaterial({
          color: constellation.color,
          transparent: true,
          opacity: 0.35
        })
      );
      group.add(line);
      this.constellationLines.push(line);

      const label = this.createLabelSprite(constellation.name, constellation.color, 0.78);
      label.position.copy(linePoints[0]).multiplyScalar(0.92);
      group.add(label);
      this.constellationLabels.push(label);
    }

    return group;
  }

  createSpaceDust() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(180 * 3);
    const playerStart = this.playerState.position.clone();
    for (let i = 0; i < 180; i += 1) {
      const dust = {
        position: playerStart.clone().add(
          new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(48),
            THREE.MathUtils.randFloatSpread(22),
            THREE.MathUtils.randFloatSpread(48)
          )
        ),
        drift: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.22),
          THREE.MathUtils.randFloatSpread(0.12),
          THREE.MathUtils.randFloatSpread(0.22)
        ),
        caught: false
      };
      this.dustPositions.push(dust);
      positions[i * 3 + 0] = dust.position.x;
      positions[i * 3 + 1] = dust.position.y;
      positions[i * 3 + 2] = dust.position.z;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.getParticleTexture(),
        color: 0xd5e7ff,
        size: 0.22,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.02
      })
    );
    return { points, positions };
  }

  createOrbitStationModel() {
    const group = new THREE.Group();

    const moduleMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2eee3,
      emissive: new THREE.Color(0xf2eee3).multiplyScalar(0.08),
      roughness: 0.68,
      metalness: 0.18
    });
    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2925,
      roughness: 0.62,
      metalness: 0.3
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x47628f,
      emissive: new THREE.Color(0x7aa8ff).multiplyScalar(0.18),
      roughness: 0.42,
      metalness: 0.24
    });

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.78, 2.4, 18),
      moduleMaterial
    );
    core.rotation.z = Math.PI / 2;
    group.add(core);

    const cargo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.62, 1.8, 16),
      moduleMaterial
    );
    cargo.position.set(-1.5, -0.72, 0.2);
    group.add(cargo);

    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.16, 0.16),
      trussMaterial
    );
    truss.position.set(0.1, 1.1, 0);
    group.add(truss);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 0.12),
      trussMaterial
    );
    arm.position.set(1.1, 2.18, 0.18);
    arm.rotation.z = -0.6;
    group.add(arm);

    for (const side of [-1, 1]) {
      const mast = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.1, 0.18),
        trussMaterial
      );
      mast.position.set(side * 2.35, 1.1, 0);
      group.add(mast);

      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.05, 0.05),
        panelMaterial
      );
      panel.position.set(side * 3.7, 1.1, 0);
      group.add(panel);
    }

    const glow = new THREE.PointLight(0xf7f4ee, 0.45, 28, 2);
    glow.position.set(0, 0.5, 1.6);
    group.add(glow);

    group.rotation.set(-0.22, -0.74, 0.2);
    group.scale.setScalar(0.9);
    return group;
  }

  createExhibitStationModel() {
    const group = new THREE.Group();

    const moduleMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f0e7,
      emissive: new THREE.Color(0xf9f4ea).multiplyScalar(0.1),
      roughness: 0.58,
      metalness: 0.22
    });
    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x151413,
      roughness: 0.54,
      metalness: 0.38
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x638dd8,
      emissive: new THREE.Color(0x9dc5ff).multiplyScalar(0.24),
      roughness: 0.36,
      metalness: 0.3
    });

    const topSpan = new THREE.Mesh(
      new THREE.BoxGeometry(19.2, 1.05, 1.1),
      moduleMaterial
    );
    topSpan.position.set(0.2, 5.8, 0.12);
    group.add(topSpan);

    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(1.16, 1.16, 2.35, 24),
        moduleMaterial
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(side * 9.6, 5.78, 0.12);
      group.add(cap);
    }

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 11.6, 1.1),
      trussMaterial
    );
    spine.position.set(0.45, 0.05, 0);
    group.add(spine);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.58, 4.6, 24),
      moduleMaterial
    );
    core.position.set(1.55, 0.95, 0.2);
    group.add(core);

    const lowerHub = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.76, 3.7, 24),
      moduleMaterial
    );
    lowerHub.position.set(2.3, -4.7, 0.26);
    group.add(lowerHub);

    const lowerArm = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.3, 0.3),
      trussMaterial
    );
    lowerArm.position.set(5.5, -1.4, 0.6);
    lowerArm.rotation.z = -0.6;
    group.add(lowerArm);

    const panelWing = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 2.7, 0.08),
      panelMaterial
    );
    panelWing.position.set(-6.8, -0.45, -0.34);
    panelWing.rotation.z = -0.18;
    panelWing.rotation.y = -0.1;
    group.add(panelWing);

    const panelWingSupport = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.22, 0.22),
      trussMaterial
    );
    panelWingSupport.position.set(-2.75, 0.84, -0.18);
    panelWingSupport.rotation.z = -0.2;
    group.add(panelWingSupport);

    const robotArm = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.24, 0.24),
      trussMaterial
    );
    robotArm.position.set(7.7, -6.1, 0.6);
    robotArm.rotation.z = -0.48;
    group.add(robotArm);

    const beacon = new THREE.PointLight(0xf9f6ef, 0.9, 56, 2);
    beacon.position.set(0.8, 2.6, 4.4);
    group.add(beacon);

    group.rotation.set(-0.1, -0.38, 0.14);
    group.scale.setScalar(0.84);
    return group;
  }

  createSpecialLocation(data) {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 18),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(data.color)
      })
    );
    group.add(orb);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 18, 18),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(data.color),
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    group.add(halo);

    const label = this.createLabelSprite(data.name, data.color, 0.72);
    label.position.set(0, 2.2, 0);
    label.visible = false;
    group.add(label);

    if (data.name === "International Space Station") {
      const station = this.createOrbitStationModel();
      group.add(station);
      orb.visible = false;
      halo.visible = false;
    }

    return {
      ...data,
      offsetVector: new THREE.Vector3(...data.offset),
      group,
      label
    };
  }

  createShip({ hull, glow, scale }) {
    const group = new THREE.Group();
    const visualRoot = new THREE.Group();
    visualRoot.rotation.y = Math.PI / 2;
    group.add(visualRoot);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: hull,
      emissive: new THREE.Color(hull).multiplyScalar(0.16),
      roughness: 0.32,
      metalness: 0.58
    });
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(1.1 * scale, 1.95 * scale, 6, 18),
      bodyMaterial
    );
    body.rotation.z = Math.PI / 2;
    visualRoot.add(body);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.9 * scale, 18, 18),
      bodyMaterial
    );
    nose.position.set(-1.7 * scale, 0, 0);
    nose.scale.set(1.2, 1, 0.92);
    visualRoot.add(nose);

    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.78 * scale, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf6f0df,
        roughness: 0.54,
        metalness: 0.12
      })
    );
    belly.position.set(-0.3 * scale, -0.35 * scale, 0);
    belly.scale.set(1.5, 0.8, 1.05);
    visualRoot.add(belly);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(3.4 * scale, 0.1 * scale, 1.3 * scale),
      new THREE.MeshStandardMaterial({
        color: 0xdbe3f0,
        roughness: 0.35,
        metalness: 0.72
      })
    );
    wing.position.set(0.1 * scale, 0, 0);
    visualRoot.add(wing);

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.95 * scale, 0.5 * scale, 0.08 * scale),
        new THREE.MeshStandardMaterial({
          color: 0xffd57c,
          roughness: 0.42,
          metalness: 0.22
        })
      );
      fin.position.set(0.75 * scale, 0.48 * scale, side * 0.52 * scale);
      fin.rotation.z = side * 0.16;
      visualRoot.add(fin);
    }

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 * scale, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x86b8ff,
        transparent: true,
        opacity: 0.52,
        metalness: 0.55,
        roughness: 0.18
      })
    );
    canopy.scale.set(1.35, 0.9, 0.92);
    canopy.position.set(-0.95 * scale, 0.34 * scale, 0);
    visualRoot.add(canopy);

    const engineGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.52 * scale, 18, 18),
      new THREE.MeshBasicMaterial({
        color: glow,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      })
    );
    engineGlow.position.set(1.72 * scale, 0, 0);
    visualRoot.add(engineGlow);

    const tailRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58 * scale, 0.08 * scale, 12, 30),
      new THREE.MeshStandardMaterial({
        color: 0xfdf2c8,
        emissive: new THREE.Color(glow).multiplyScalar(0.28),
        roughness: 0.24,
        metalness: 0.34
      })
    );
    tailRing.rotation.y = Math.PI / 2;
    tailRing.position.copy(engineGlow.position);
    visualRoot.add(tailRing);

    const pointLight = new THREE.PointLight(glow, 0.95, 22, 2);
    pointLight.position.copy(engineGlow.position);
    visualRoot.add(pointLight);

    return { group, visualRoot, body, engineGlow, canopy };
  }

  createTrail(color, opacity) {
    return {
      line: new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({
          map: this.getParticleTexture(),
          color,
          vertexColors: true,
          size: 1.15,
          sizeAttenuation: true,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      ),
      points: [],
      color: new THREE.Color(color)
    };
  }

  createOrbitGuide(data, isMoon = false) {
    const points = [];
    const pointCount = isMoon ? 120 : 220;
    for (let i = 0; i <= pointCount; i += 1) {
      const t = (i / pointCount) * Math.PI * 2;
      const a = data.orbitRadius;
      const e = data.eccentricity ?? 0;
      const b = a * Math.sqrt(Math.max(0.1, 1 - e * e));
      const point = new THREE.Vector3(
        a * (Math.cos(t) - e),
        0,
        b * Math.sin(t)
      );
      point.applyAxisAngle(
        new THREE.Vector3(1, 0, 0),
        THREE.MathUtils.degToRad(data.inclinationDeg ?? 0)
      );
      points.push(point);
    }
    return {
      line: new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: new THREE.Color(data.glow),
          transparent: true,
          opacity: isMoon ? 0.28 : 0.18
        })
      ),
      points
    };
  }

  createScannerCone() {
    const material = new THREE.MeshBasicMaterial({
      color: 0xb99dff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 12, 32, 1, true),
      material
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    return mesh;
  }

  createGravityFieldGroup() {
    const group = new THREE.Group();
    for (const bodyData of [...SOLAR_BODIES, MOON_DATA]) {
      const shell = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const radius = bodyData.radius * (1.9 + i * 0.7);
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2)
              .getPoints(96)
              .map((point) => new THREE.Vector3(point.x, 0, point.y))
          ),
          new THREE.LineBasicMaterial({
            color: new THREE.Color(bodyData.glow),
            transparent: true,
            opacity: 0.12 + i * 0.04
          })
        );
        ring.rotation.x = Math.PI / 2;
        shell.add(ring);
      }
      shell.visible = false;
      shell.userData.bodyName = bodyData.name;
      group.add(shell);
    }
    return group;
  }

  createLabelSprite(text, color, opacity = 0.82) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 86;
    const ctx = canvas.getContext("2d");
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(12, 10, 296, 60, 24);
      ctx.fillStyle = `rgba(7, 11, 24, ${opacity})`;
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(7, 11, 24, ${opacity})`;
      ctx.fillRect(12, 10, 296, 60);
    }
    ctx.fillStyle = color;
    ctx.font = "600 30px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.scale.set(16, 4.4, 1);
    return sprite;
  }

  createPlanetTexture(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    if (data.name === "Earth") {
      const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      ocean.addColorStop(0, "#0b2f73");
      ocean.addColorStop(0.38, "#1450b8");
      ocean.addColorStop(0.7, "#1580d5");
      ocean.addColorStop(1, "#0d376a");
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawLand = (points, fill, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (const point of points.slice(1)) {
          ctx.lineTo(point[0], point[1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      drawLand(
        [
          [120, 120], [165, 92], [214, 104], [245, 148], [252, 186], [225, 216], [202, 243],
          [190, 282], [170, 320], [142, 298], [122, 264], [104, 224], [92, 180], [100, 142]
        ],
        "#3ea061"
      );
      drawLand(
        [
          [205, 292], [232, 308], [244, 340], [236, 380], [222, 430], [208, 470], [180, 498],
          [160, 470], [170, 418], [182, 370], [190, 330]
        ],
        "#3ca368"
      );
      drawLand(
        [
          [466, 108], [526, 88], [610, 98], [674, 120], [720, 154], [694, 186], [640, 184],
          [604, 200], [574, 222], [540, 214], [520, 186], [490, 182], [462, 162], [450, 132]
        ],
        "#488d57"
      );
      drawLand(
        [
          [510, 188], [544, 190], [582, 206], [616, 236], [626, 288], [614, 338], [594, 384],
          [568, 412], [546, 452], [520, 470], [498, 434], [490, 392], [476, 346], [470, 304],
          [474, 260], [490, 220]
        ],
        "#d9b86f",
        0.96
      );
      drawLand(
        [
          [690, 302], [724, 286], [756, 296], [782, 316], [796, 344], [782, 372], [754, 380],
          [726, 360], [700, 334]
        ],
        "#b4a35e"
      );
      drawLand(
        [
          [0, 458], [82, 438], [190, 430], [312, 434], [462, 438], [620, 446], [782, 454],
          [922, 460], [1024, 466], [1024, 512], [0, 512]
        ],
        "#f3f9ff",
        0.55
      );
      drawLand(
        [
          [0, 0], [1024, 0], [1024, 36], [930, 26], [812, 18], [684, 26], [530, 20], [340, 18],
          [180, 26], [0, 38]
        ],
        "#f4fbff",
        0.5
      );

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 24; i += 1) {
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          30 + Math.random() * 110,
          10 + Math.random() * 38,
          Math.random() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    } else {
      const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      base.addColorStop(0, data.colorA);
      base.addColorStop(1, data.colorB);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const addBands = (count, alpha) => {
        for (let i = 0; i < count; i += 1) {
          ctx.fillStyle = `rgba(255,255,255,${alpha * Math.random()})`;
          const y = Math.random() * canvas.height;
          const height = 10 + Math.random() * 40;
          ctx.fillRect(0, y, canvas.width, height);
        }
      };

      const addBlobs = (count, alpha, color) => {
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < count; i += 1) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const rx = 20 + Math.random() * 100;
          const ry = 12 + Math.random() * 70;
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };

      switch (data.name) {
        case "Mars":
          addBlobs(22, 0.35, "#5a1d10");
          addBlobs(10, 0.18, "#f0c4a9");
          break;
        case "Jupiter":
        case "Saturn":
          addBands(42, 0.16);
          addBlobs(12, 0.2, data.name === "Jupiter" ? "#c86f56" : "#e8d7b3");
          break;
        case "Neptune":
        case "Uranus":
          addBands(16, 0.08);
          break;
        default:
          addBlobs(28, 0.18, "#ffffff");
          break;
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  createCloudTexture(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const cloudCount = data.name === "Earth" ? 240 : 160;
    for (let i = 0; i < cloudCount; i += 1) {
      ctx.fillStyle = data.cloudColor || "rgba(255,255,255,0.4)";
      ctx.globalAlpha =
        data.name === "Earth" ? 0.03 + Math.random() * 0.16 : 0.03 + Math.random() * 0.1;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        30 + Math.random() * (data.name === "Earth" ? 220 : 160),
        12 + Math.random() * (data.name === "Earth" ? 72 : 50),
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (data.name === "Earth") {
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 18;
      for (let i = 0; i < 9; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-40, 64 + i * 48 + Math.random() * 16);
        for (let x = 0; x <= canvas.width + 40; x += 80) {
          ctx.bezierCurveTo(
            x + 20,
            64 + i * 48 + Math.random() * 36,
            x + 44,
            64 + i * 48 - Math.random() * 36,
            x + 80,
            64 + i * 48 + Math.random() * 16
          );
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  resetPlayerToEarth() {
    const earth = this.worldBodies.find((body) => body.data.name === "Earth");
    if (!earth) {
      return;
    }

    const earthWorld = earth.group.getWorldPosition(new THREE.Vector3());
    const moonWorld =
      this.moon?.group?.getWorldPosition(new THREE.Vector3()) ??
      earthWorld.clone().add(new THREE.Vector3(8, 2, 0));
    this.playerState.position.copy(earthWorld).add(START_OFFSET);
    this.playerState.velocity.set(0, 0, 0);

    const lookTarget = earthWorld.clone().lerp(moonWorld, 0.45);
    const lookMatrix = new THREE.Matrix4().lookAt(
      this.playerState.position,
      lookTarget,
      new THREE.Vector3(0, 1, 0)
    );
    this.playerState.quaternion.setFromRotationMatrix(lookMatrix);
    this.playerShip.group.position.copy(this.playerState.position);
    this.playerShip.group.quaternion.copy(this.playerState.quaternion);
  }

  getMuseumAttractFrame() {
    const earth = this.worldBodies.find((body) => body.data.name === "Earth");
    const earthCenter =
      earth?.group?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const cameraPosition = earthCenter
      .clone()
      .add(new THREE.Vector3(0.08, 7.25, 1.3));
    const lookTarget = cameraPosition.clone().add(new THREE.Vector3(0.15, -1.95, -18.2));
    const stationPosition = cameraPosition.clone().add(new THREE.Vector3(2.8, 3.55, -11.9));
    const stationLookTarget = earthCenter
      .clone()
      .add(new THREE.Vector3(1.4, 0.95, -6.1));

    return {
      cameraPosition,
      lookTarget,
      stationPosition,
      stationLookTarget,
      cameraUp: worldUp
    };
  }

  updatePresentationMode() {
    const attractMode = this.input.getSeatCount() === 0;
    this.displayStageNode.classList.toggle("attract-mode", attractMode);
    this.sun.group.visible = !attractMode;
    this.midStars.visible = !attractMode;
    this.nebulaBand.visible = !attractMode;
    this.galaxyVolume.visible = !attractMode;
    this.spaceDust.points.visible = !attractMode;

    for (const body of this.worldBodies) {
      const localBody = body.isMoon || body.data.name === "Earth";
      body.group.visible = attractMode ? localBody : true;
      if (body.orbitTrail?.line) {
        body.orbitTrail.line.visible = attractMode ? false : true;
      }
    }

    for (const location of this.specialLocations) {
      location.group.visible = !attractMode;
    }

    this.artemisLine.visible = !attractMode;
    this.artemisShip.group.visible = !attractMode;
    this.exhibitStation.visible = attractMode;
  }

  animate() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.accumulator += delta;
    while (this.accumulator >= TIME_STEP) {
      this.update(TIME_STEP);
      this.accumulator -= TIME_STEP;
    }
    this.render();
    requestAnimationFrame(this.boundAnimate);
  }

  advanceTime(ms) {
    const steps = Math.max(1, Math.round(ms / (TIME_STEP * 1000)));
    for (let i = 0; i < steps; i += 1) {
      this.update(TIME_STEP);
    }
    this.render();
  }

  update(dt) {
    const modalMode = this.activeLesson
      ? "lesson"
      : this.debugVisible
        ? "debug"
        : this.isPaused
          ? "pause"
          : "game";
    this.input.update({ mode: modalMode });

    if (this.input.justPressed.fullscreen) {
      this.toggleFullscreen();
    }

    if (this.debugVisible) {
      if (this.input.justPressed.pauseToggle || this.input.justPressed.debugToggle) {
        this.debugVisible = false;
        this.updateDebugVisibility();
      }
      if (this.input.justPressed.saveLayout) {
        this.saveUILayout();
      }
      if (this.input.justPressed.resetLayout) {
        this.resetUILayout();
      }
      this.handleScientistUiEdit(dt);
      this.updateMenuFocus();
      this.updateUi(dt);
      return;
    }

    if (this.isPaused) {
      if (this.activeLesson) {
        if (this.input.justPressed.pauseToggle || this.input.justPressed.menuCancel) {
          this.closeLesson();
          this.updateUi(dt);
          return;
        }
        this.handleLessonMenuInput();
        this.elapsed += dt;
        this.orbitTime += dt * ORBIT_TIME_SCALE;
        this.resourcePulse += dt;
        this.updateBodies(dt);
        this.updateSpecialLocations();
        this.updateArtemisPath();
        this.updateArtemisShip();
        this.updatePresentationMode();
        this.updateLessonVisualization(dt);
        this.updateSkyAnchor();
        this.updateGravityFields(dt);
        this.updateUi(dt);
        return;
      }
      if (this.input.justPressed.pauseToggle) {
        this.resumeFromPause();
      }
      if (this.input.justPressed.menuCancel) {
        this.resumeFromPause();
      }
      if (this.input.justPressed.debugToggle) {
        this.debugVisible = true;
        this.updateDebugVisibility();
      }
      this.handlePauseMenuInput();
      this.updateMenuFocus();
      this.updateUi(dt);
      return;
    }

    if (this.input.justPressed.pauseToggle) {
      this.isPaused = true;
      this.playUiBlip(420, 0.08);
      this.updatePauseVisibility();
      this.updateMenuFocus();
      this.updateUi(dt);
      return;
    }

    if (this.input.justPressed.debugToggle) {
      this.debugVisible = true;
      this.updateDebugVisibility();
      this.updateUi(dt);
      return;
    }

    if (this.input.justPressed.constellationToggle) {
      this.debugSettings.showConstellations = !this.debugSettings.showConstellations;
      this.persistDebugSettings();
    }

    if (this.input.justPressed.saveLayout) {
      this.saveUILayout();
    }

    if (this.input.justPressed.resetLayout) {
      this.resetUILayout();
    }

    if (this.input.justPressed.communicatorSecondary) {
      this.debugSettings.showConstellations = !this.debugSettings.showConstellations;
      this.persistDebugSettings();
    }

    if (this.input.justPressed.communicatorTertiary) {
      this.cycleInterestingTarget();
    }

    if (this.input.getSeatCount() > 0) {
      this.inactivityTime = 0;
      this.introNode.classList.add("hidden");
    } else {
      this.inactivityTime += dt;
    }

    this.elapsed += dt;
    this.orbitTime += dt * ORBIT_TIME_SCALE;
    this.resourcePulse += dt;
    this.bloomPass.strength = this.debugSettings.bloomStrength;
    this.updateBodies(dt);
    this.updateSpecialLocations();
    this.updateExhibitStation();
    this.updateArtemisPath();
    this.updateArtemisShip();
    this.updatePresentationMode();
    this.updateLifeSupport(dt);
    this.handleScientistUiEdit(dt);
    this.updatePlayerShip(dt);
    this.updateScienceScanner(dt);
    this.updateCamera(dt);
    this.updateDust(dt);
    this.updateTrails();
    this.updateSkyAnchor();
    this.updateGravityFields(dt);
    this.updateAudio(dt);

    if (this.input.justPressed.communicatorAction) {
      this.scanCurrentTarget();
    }

    this.updateUi(dt);
  }

  updateBodies(dt) {
    this.solarRoot.position.set(0, 0, 0);

    this.farStars.rotation.y += dt * 0.00018;
    this.farStars.rotation.z = Math.sin(this.elapsed * 0.005) * 0.01;
    this.midStars.rotation.y += dt * 0.0008;
    this.midStars.rotation.x = Math.cos(this.elapsed * 0.006) * 0.016;
    this.nebulaBand.rotation.y += dt * 0.0002;
    this.nebulaBand.rotation.x = Math.sin(this.elapsed * 0.01) * 0.02;
    this.galaxyVolume.rotation.y += dt * 0.00012;
    this.galaxyVolume.rotation.z = 0.16 + Math.sin(this.elapsed * 0.006) * 0.008;
    this.milkyWayShell.rotation.y += dt * 0.00008;

    for (const body of this.worldBodies) {
      if (body.isMoon) {
        body.group.position.copy(this.getMoonLocalPositionAtTime(this.orbitTime));
        body.group.rotation.y += dt * (body.data.spinSpeed ?? 0.002);
      } else {
        body.group.position.copy(
          this.getOrbitLocalPositionAtTime(body.data, this.orbitTime)
        );
        body.group.rotation.y += dt * (body.data.spinSpeed ?? 0.04);
      }

      if (body.group.userData.clouds) {
        body.group.userData.clouds.rotation.y +=
          dt * body.group.userData.clouds.userData.rotationSpeed;
      }

      if (body.group.userData.ocean?.material?.userData?.shader) {
        const shader = body.group.userData.ocean.material.userData.shader;
        const moonLocalDirection = this.getMoonLocalPositionAtTime(this.orbitTime)
          .clone()
          .normalize();
        shader.uniforms.moonDirection.value.copy(moonLocalDirection);
        shader.uniforms.time.value = this.elapsed;
      }

      if (body.data.name === "Moon" && body.group.userData.atmosphere) {
        const moonWorld = body.group.getWorldPosition(new THREE.Vector3());
        const sunDir = this.sun.group.position.clone().sub(moonWorld).normalize();
        const cameraDir = this.camera.position.clone().sub(moonWorld).normalize();
        const phase = Math.max(0, sunDir.dot(cameraDir));
        body.group.userData.atmosphere.material.uniforms.glowStrength.value =
          0.16 + phase * 0.45;
      }
    }
  }

  updateSpecialLocations() {
    for (const location of this.specialLocations) {
      const anchorBody =
        location.anchor === "Sun"
          ? null
          : this.worldBodies.find((body) => body.data.name === location.anchor);
      const anchorPosition = anchorBody
        ? anchorBody.group.getWorldPosition(new THREE.Vector3())
        : new THREE.Vector3(0, 0, 0);
      location.group.position.copy(anchorPosition).add(location.offsetVector);
    }
  }

  updateExhibitStation() {
    if (!this.exhibitStation) {
      return;
    }
    const frame = this.getMuseumAttractFrame();
    const stationPosition = frame.stationPosition;
    this.exhibitStation.position.copy(stationPosition);
    this.exhibitStation.rotation.set(-0.22, -0.7, 0.18);
  }

  updateArtemisPath() {
    const earth = this.worldBodies.find((body) => body.data.name === "Earth");
    const earthPos = earth.group.getWorldPosition(new THREE.Vector3());
    const moonWorld = this.moon.group.getWorldPosition(new THREE.Vector3());

    const points = [
      earthPos.clone().add(new THREE.Vector3(0, 4, 20)),
      earthPos.clone().add(new THREE.Vector3(18, 8, 28)),
      earthPos.clone().add(new THREE.Vector3(34, 12, 12)),
      moonWorld.clone().add(new THREE.Vector3(-5, 3, 12)),
      moonWorld.clone().add(new THREE.Vector3(0, 6, -16)),
      moonWorld.clone().add(new THREE.Vector3(10, -1, -4)),
      earthPos.clone().add(new THREE.Vector3(-36, -8, -18)),
      earthPos.clone().add(new THREE.Vector3(-14, -4, 18)),
      earthPos.clone().add(new THREE.Vector3(0, 4, 20))
    ];

    this.artemisCurve.points = points;
    const sampled = this.artemisCurve.getPoints(180);
    this.artemisLine.geometry.dispose();
    this.artemisLine.geometry = new THREE.BufferGeometry().setFromPoints(sampled);
  }

  updateArtemisShip() {
    const t = (this.elapsed % ARTEMIS_LOOP_SECONDS) / ARTEMIS_LOOP_SECONDS;
    const position = this.artemisCurve.getPointAt(t);
    const forwardPoint = this.artemisCurve.getPointAt((t + 0.002) % 1);
    this.artemisShip.group.position.copy(position);
    this.artemisShip.group.lookAt(forwardPoint);
    this.artemisShip.group.rotateY(Math.PI / 2);
  }

  handlePauseMenuInput() {
    if (this.input.justPressed.menuUp || this.input.justPressed.menuLeft) {
      this.pauseSelectionIndex =
        (this.pauseSelectionIndex - 1 + this.pauseButtons.length) %
        this.pauseButtons.length;
      this.updateMenuFocus();
      this.playUiBlip(480, 0.04);
    }
    if (this.input.justPressed.menuDown || this.input.justPressed.menuRight) {
      this.pauseSelectionIndex =
        (this.pauseSelectionIndex + 1) % this.pauseButtons.length;
      this.updateMenuFocus();
      this.playUiBlip(560, 0.04);
    }
    if (this.input.justPressed.menuConfirm) {
      this.pauseButtons[this.pauseSelectionIndex]?.click();
    }
  }

  handleLessonMenuInput() {
    if (!this.activeLesson) {
      return;
    }
    if (this.input.justPressed.menuLeft) {
      this.shiftLessonStep(-1);
      this.lessonSelectionIndex = 0;
      this.updateMenuFocus();
    }
    if (this.input.justPressed.menuRight) {
      this.shiftLessonStep(1);
      this.lessonSelectionIndex = 1;
      this.updateMenuFocus();
    }
    if (this.input.justPressed.menuUp || this.input.justPressed.menuDown) {
      this.lessonSelectionIndex =
        (this.lessonSelectionIndex + 1) % 3;
      this.updateMenuFocus();
      this.playUiBlip(540, 0.04);
    }
    if (this.input.justPressed.menuConfirm) {
      const lessonButtons = [
        this.root.querySelector("[data-lesson-prev]"),
        this.root.querySelector("[data-lesson-next]"),
        this.root.querySelector("[data-lesson-exit]")
      ];
      lessonButtons[this.lessonSelectionIndex]?.click();
    }
  }

  updateLessonVisualization(dt) {
    if (!this.activeLesson) {
      return;
    }
    const slide = this.activeLesson.slides[this.activeLessonStep];
    this.debugSettings.showGravityWells = Boolean(slide.showGravity);
    const earth = this.worldBodies.find((body) => body.data.name === "Earth");
    const moon = this.worldBodies.find((body) => body.data.name === "Moon");
    const jupiter = this.worldBodies.find((body) => body.data.name === "Jupiter");
    const cameraFrames = {
      museumWindow: this.getMuseumAttractFrame(),
      solarWide: {
        cameraPosition: new THREE.Vector3(0, 180, 360),
        lookTarget: new THREE.Vector3(0, 0, 0),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      innerPlanets: {
        cameraPosition: new THREE.Vector3(0, 76, 148),
        lookTarget: new THREE.Vector3(0, 0, 0),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      gravityWide: {
        cameraPosition: new THREE.Vector3(0, 110, 210),
        lookTarget: new THREE.Vector3(0, 0, 0),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      earthSun: {
        cameraPosition: earth.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-12, 8, 18)),
        lookTarget: earth.group.getWorldPosition(new THREE.Vector3()),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      moonGlow: {
        cameraPosition: moon.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(6, 2.8, 8)),
        lookTarget: moon.group.getWorldPosition(new THREE.Vector3()),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      earthMoon: {
        cameraPosition: earth.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-6, 6, 26)),
        lookTarget: moon.group.getWorldPosition(new THREE.Vector3()),
        cameraUp: new THREE.Vector3(0, 1, 0)
      },
      jupiterAssist: {
        cameraPosition: jupiter.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-24, 12, 32)),
        lookTarget: jupiter.group.getWorldPosition(new THREE.Vector3()),
        cameraUp: new THREE.Vector3(0, 1, 0)
      }
    };
    const frame = cameraFrames[slide.camera] ?? cameraFrames.solarWide;
    this.camera.position.lerp(frame.cameraPosition, 1 - Math.exp(-dt * 2.2));
    this.camera.up.copy(frame.cameraUp);
    this.camera.lookAt(frame.lookTarget);
  }

  updateLifeSupport(dt) {
    const state = this.lifeSupportState;
    const boostHeat = this.input.pilotBoost * dt * 0.28;
    const cruiseHeat = this.playerState.velocity.length() * dt * 0.0024;
    state.engineTemp += boostHeat + cruiseHeat;
    state.engineTemp -= dt * 0.028;
    state.oxygen = THREE.MathUtils.clamp(state.oxygen - dt * 0.0014, 0, 1);
    state.water = THREE.MathUtils.clamp(state.water - dt * 0.0009, 0, 1);

    if (this.input.justPressed.lifeSupportCool) {
      state.engineTemp -= 0.09;
      this.playUiBlip(410, 0.05);
    }

    state.engineTemp = THREE.MathUtils.clamp(state.engineTemp, 0, 1);
    state.engineFrozen = state.engineTemp < 0.12;
    state.engineOverheated = state.engineTemp > 0.86;

    if (state.engineFrozen) {
      state.engineTemp += dt * 0.04;
    }
    if (state.engineOverheated) {
      state.engineTemp -= dt * 0.018;
    }
  }

  updateScienceScanner(dt) {
    const inputVector = new THREE.Vector2(
      this.input.axes.scientist.x,
      this.input.axes.scientist.y
    );
    const magnitude = inputVector.length();
    const active =
      this.input.seatActive.scientist &&
      magnitude > 0.16 &&
      !this.debugVisible &&
      !this.isPaused;

    this.scannerCone.visible = active;
    if (!active) {
      this.scannerStatusText = this.input.seatActive.scientist
        ? "Waiting For Aim"
        : "Idle";
      this.gravityTargetName = this.debugSettings.showGravityWells ? this.gravityTargetName : "Off";
      return;
    }

    const shipForward = this.forward
      .clone()
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const coneDir = shipForward
      .clone()
      .add(shipRight.clone().multiplyScalar(inputVector.x * 0.8))
      .add(shipUp.clone().multiplyScalar(-inputVector.y * 0.55))
      .normalize();
    const coneOrigin = this.playerState.position
      .clone()
      .add(shipForward.clone().multiplyScalar(0.8))
      .add(shipUp.clone().multiplyScalar(0.15));
    this.scannerCone.position.copy(coneOrigin).add(coneDir.clone().multiplyScalar(6));
    this.scannerCone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      coneDir
    );
    this.scannerCone.scale.set(1.2, 1, 1.2 + magnitude * 0.8);

    let dustCaught = 0;
    let bestTarget = null;
    let bestScore = 0.93;
    for (const dust of this.dustPositions) {
      const toDust = dust.position.clone().sub(coneOrigin);
      const distance = toDust.length();
      if (distance > 18) {
        continue;
      }
      const alignment = toDust.normalize().dot(coneDir);
      if (alignment > 0.92) {
        dust.caught = true;
        dust.position.lerp(this.playerState.position, 1 - Math.exp(-dt * 5.6));
        dustCaught += 1;
        if (dust.position.distanceTo(this.playerState.position) < 0.45) {
          this.scienceDustCollected += 1;
          this.playCollectChime();
          this.respawnDustParticle(dust);
        }
      } else {
        dust.caught = false;
      }
    }

    for (const body of this.worldBodies) {
      const toBody = body.group.getWorldPosition(new THREE.Vector3()).sub(coneOrigin).normalize();
      const score = toBody.dot(coneDir);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = body.data.name;
      }
    }

    if (bestTarget) {
      this.gravityTargetName = bestTarget;
      this.lockedTarget = {
        name: bestTarget,
        description: "Science scanner tracking a gravitational source.",
        poi: ["Mass", "Orbit", "Sunlight"]
      };
    } else if (!this.debugSettings.showGravityWells) {
      this.gravityTargetName = "Off";
    }

    this.scannerStatusText = dustCaught > 0 ? `Collecting ${dustCaught}` : "Scanning";
  }

  respawnDustParticle(dust) {
    dust.position.copy(this.playerState.position).add(
      new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(36),
        THREE.MathUtils.randFloatSpread(18),
        -12 - Math.random() * 26
      )
    );
    dust.drift.set(
      THREE.MathUtils.randFloatSpread(0.22),
      THREE.MathUtils.randFloatSpread(0.12),
      THREE.MathUtils.randFloatSpread(0.22)
    );
    dust.caught = false;
  }

  updateGravityFields(dt) {
    const showAll = this.debugSettings.showGravityWells;
    const targetName =
      this.input.seatActive.scientist && this.gravityTargetName !== "Off"
        ? this.gravityTargetName
        : null;
    for (const shell of this.gravityFieldGroup.children) {
      const bodyName = shell.userData.bodyName;
      shell.visible = showAll || targetName === bodyName;
      if (!shell.visible) {
        continue;
      }
      const body =
        this.worldBodies.find((item) => item.data.name === bodyName) ??
        this.moon;
      body.group.getWorldPosition(shell.position);
      shell.rotation.y += dt * 0.22;
      const pulse = 1 + Math.sin(this.elapsed * 1.8 + body.data.radius) * 0.04;
      shell.scale.setScalar(pulse);
    }
  }

  handleEngineerCameraInput(dt) {
    const stepDirection = this.debugSettings.invertCameraStep ? 1 : -1;
    if (this.input.engineerPulse.up) {
      this.debugSettings.cameraModeIndex = THREE.MathUtils.clamp(
        this.debugSettings.cameraModeIndex + stepDirection,
        0,
        CAMERA_MODES.length - 1
      );
      this.persistDebugSettings();
    }
    if (this.input.engineerPulse.down) {
      this.debugSettings.cameraModeIndex = THREE.MathUtils.clamp(
        this.debugSettings.cameraModeIndex - stepDirection,
        0,
        CAMERA_MODES.length - 1
      );
      this.persistDebugSettings();
    }

    const minAngle = THREE.MathUtils.degToRad(this.debugSettings.cameraPanMinDeg);
    const maxAngle = THREE.MathUtils.degToRad(this.debugSettings.cameraPanMaxDeg);
    if (this.input.engineerHold.left && !this.input.engineerHold.right) {
      this.cameraPanTarget = minAngle;
    } else if (this.input.engineerHold.right && !this.input.engineerHold.left) {
      this.cameraPanTarget = maxAngle;
    } else {
      this.cameraPanTarget = 0;
    }

    this.cameraPan = THREE.MathUtils.damp(
      this.cameraPan,
      this.cameraPanTarget,
      this.debugSettings.cameraRecenterSpeed,
      dt
    );
    this.cameraPan = THREE.MathUtils.clamp(this.cameraPan, minAngle, maxAngle);
  }

  handleScientistUiEdit(dt) {
    if (!this.debugVisible || !this.uiEditEnabled || !this.input.seatActive.scientist) {
      return;
    }

    const layout = this.uiLayout[this.selectedPanelId];
    if (!layout) {
      return;
    }

    if (this.input.uiScaleModifier) {
      layout.scale = THREE.MathUtils.clamp(
        layout.scale - this.input.axes.scientist.y * dt * 0.45,
        0.7,
        1.5
      );
    } else {
      layout.x += this.input.axes.scientist.x * dt * 240;
      layout.y += this.input.axes.scientist.y * dt * 240;
    }

    this.applyUILayout();
  }

  resolvePlanetCollisions() {
    this.lastCollisionName = null;
    for (const body of this.worldBodies) {
      const center = body.group.getWorldPosition(this.tmpVectorB.clone());
      const safeRadius = body.collisionRadius + this.shipCollisionRadius;
      this.tmpVectorC.copy(this.playerState.position).sub(center);
      const distance = this.tmpVectorC.length();
      if (distance >= safeRadius) {
        continue;
      }

      const normal =
        distance > 0.0001
          ? this.tmpVectorC.normalize()
          : new THREE.Vector3(0, 1, 0);
      this.playerState.position.copy(center).addScaledVector(normal, safeRadius);

      const inwardVelocity = this.playerState.velocity.dot(normal);
      if (inwardVelocity < 0) {
        this.playerState.velocity.addScaledVector(normal, -inwardVelocity * 1.02);
      }
      this.playerState.velocity.multiplyScalar(0.84);
      this.lastCollisionName = body.data.name;
    }
  }

  updatePlayerShip(dt) {
    const pilotActive = this.input.seatActive.pilot;
    const attractMode = this.input.getSeatCount() === 0;
    const earth = this.worldBodies.find((body) => body.data.name === "Earth");
    const earthCenter = earth.group.getWorldPosition(new THREE.Vector3());

    if (!pilotActive) {
      const orbitAngle = this.elapsed * 0.18;
      const orbitTarget = earthCenter.clone().add(
        new THREE.Vector3(
          Math.cos(orbitAngle) * 30,
          8 + Math.sin(orbitAngle * 0.65) * 4,
          Math.sin(orbitAngle) * 30
        )
      );
      this.tmpVector.copy(orbitTarget).sub(this.playerState.position);
      const orbitDistance = this.tmpVector.length();
      const desiredVelocity = this.tmpVector.normalize().multiplyScalar(
        orbitDistance > 12 ? 14 : 8
      );
      this.playerState.velocity.lerp(desiredVelocity, 0.024);

      const lookMatrix = new THREE.Matrix4().lookAt(
        this.playerState.position,
        earthCenter,
        new THREE.Vector3(0, 1, 0)
      );
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
      this.playerState.quaternion.slerp(targetQuat, 1 - Math.exp(-dt * 2.4));
      this.flightModeLabel = attractMode ? "Museum Attract View" : "Earth Orbit Hold";
    } else {
      const pilot = this.input.axes.pilot;
      const yaw = -pilot.x * dt * 1.36;
      const pitch = -pilot.y * dt * 0.96;
      const deltaQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pitch, yaw, 0, "YXZ")
      );
      this.playerState.quaternion.multiply(deltaQuat).normalize();

      const forward = this.forward
        .clone()
        .applyQuaternion(this.playerState.quaternion)
        .normalize();
      const canBoost =
        !this.lifeSupportState.engineFrozen && !this.lifeSupportState.engineOverheated;
      const boostMultiplier = canBoost ? 1 + this.input.pilotBoost * 1.55 : 1;
      const brakeMultiplier = this.input.pilotBrake ? 0.38 : 1;
      const targetSpeed = this.debugSettings.cruiseSpeed * boostMultiplier * brakeMultiplier;
      const desiredVelocity = forward.multiplyScalar(targetSpeed);
      const steering = desiredVelocity
        .sub(this.playerState.velocity)
        .multiplyScalar(Math.min(1, dt * (this.input.pilotBrake ? 2.8 : 1.8)));
      this.playerState.velocity.add(steering);

      if (this.debugSettings.flightAssist) {
        const t = (this.elapsed % ARTEMIS_LOOP_SECONDS) / ARTEMIS_LOOP_SECONDS;
        const followPoint = this.artemisCurve.getPointAt((t + 0.985) % 1);
        this.tmpVector.copy(followPoint).sub(this.playerState.position);
        this.playerState.velocity.add(this.tmpVector.multiplyScalar(0.011));
        this.flightModeLabel = "Artemis Assist";
      } else {
        this.flightModeLabel = "Free Flight";
      }
    }

    this.playerState.velocity.multiplyScalar(Math.exp(-dt * 0.3));
    this.playerState.position.addScaledVector(this.playerState.velocity, dt);
    this.resolvePlanetCollisions();
    this.playerShip.group.position.copy(this.playerState.position);
    this.playerShip.group.quaternion.copy(this.playerState.quaternion);
  }

  updateCamera(dt) {
    const attractMode = this.input.getSeatCount() === 0;
    this.playerShip.group.visible = !attractMode;
    this.playerTrail.line.visible = !attractMode;
    this.playerShip.visualRoot.visible = true;
    this.cockpitInterior.visible = false;
    if (attractMode) {
      const { cameraPosition, lookTarget, cameraUp } = this.getMuseumAttractFrame();
      this.cameraProfileCurrent.fov = THREE.MathUtils.damp(
        this.cameraProfileCurrent.fov,
        80,
        this.debugSettings.cameraSmooth,
        dt
      );
      this.camera.fov = this.cameraProfileCurrent.fov;
      this.camera.updateProjectionMatrix();
      this.camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * 2.3));
      this.camera.up.copy(cameraUp);
      this.camera.lookAt(lookTarget);
      this.cockpitOverlayNode.classList.add("hidden");
      return;
    }

    this.playerShip.group.visible = true;
    this.playerTrail.line.visible = true;
    this.camera.up.set(0, 1, 0);
    const targetProfile = CAMERA_MODES[this.debugSettings.cameraModeIndex];
    this.cameraProfileCurrent.distance = THREE.MathUtils.damp(
      this.cameraProfileCurrent.distance,
      targetProfile.distance,
      this.debugSettings.cameraSmooth,
      dt
    );
    this.cameraProfileCurrent.height = THREE.MathUtils.damp(
      this.cameraProfileCurrent.height,
      targetProfile.height,
      this.debugSettings.cameraSmooth,
      dt
    );
    this.cameraProfileCurrent.lookAhead = THREE.MathUtils.damp(
      this.cameraProfileCurrent.lookAhead,
      targetProfile.lookAhead,
      this.debugSettings.cameraSmooth,
      dt
    );
    this.cameraProfileCurrent.fov = THREE.MathUtils.damp(
      this.cameraProfileCurrent.fov,
      targetProfile.fov,
      this.debugSettings.cameraSmooth,
      dt
    );
    this.camera.fov = this.cameraProfileCurrent.fov;
    this.camera.updateProjectionMatrix();

    const shipForward = this.forward
      .clone()
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const panQuat = new THREE.Quaternion().setFromAxisAngle(shipUp, this.cameraPan);
    const panForward = shipForward.clone().applyQuaternion(panQuat);
    const panRight = shipRight.clone().applyQuaternion(panQuat);

    let desiredPosition;
    let lookTarget;
    if (this.debugSettings.cameraModeIndex === 0) {
      desiredPosition = this.playerState.position
        .clone()
        .add(shipForward.clone().multiplyScalar(0.72))
        .add(shipUp.clone().multiplyScalar(0.36));
      lookTarget = desiredPosition
        .clone()
        .add(panForward.clone().multiplyScalar(this.cameraProfileCurrent.lookAhead))
        .add(panRight.clone().multiplyScalar(7 * Math.sin(this.cameraPan)));
      this.cockpitOverlayNode.classList.remove("hidden");
      this.cockpitInterior.visible = true;
      this.playerShip.visualRoot.visible = false;
    } else {
      desiredPosition = this.playerState.position
        .clone()
        .sub(panForward.clone().multiplyScalar(this.cameraProfileCurrent.distance))
        .add(shipUp.clone().multiplyScalar(this.cameraProfileCurrent.height));
      lookTarget = this.playerState.position
        .clone()
        .add(shipForward.clone().multiplyScalar(this.cameraProfileCurrent.lookAhead))
        .add(panRight.clone().multiplyScalar(8 * Math.sin(this.cameraPan)));
      this.cockpitOverlayNode.classList.add("hidden");
    }

    this.camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * 2.6));
    this.camera.lookAt(lookTarget);
  }

  updateDust(dt) {
    const speed = Math.max(this.playerState.velocity.length(), this.debugSettings.cruiseSpeed);
    const shipForward = this.forward
      .clone()
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const shipUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(this.playerState.quaternion)
      .normalize();
    const positions = this.spaceDust.points.geometry.attributes.position.array;
    for (let i = 0; i < this.dustPositions.length; i += 1) {
      const particle = this.dustPositions[i];
      if (!particle.caught) {
        particle.position.addScaledVector(particle.drift, dt * 12);
        particle.position.addScaledVector(shipForward, -dt * (2 + speed * 0.08));
      }
      if (particle.position.distanceTo(this.playerState.position) > 42) {
        particle.position.copy(this.playerState.position)
          .add(shipForward.clone().multiplyScalar(-12 - Math.random() * 18))
          .add(shipRight.clone().multiplyScalar(THREE.MathUtils.randFloatSpread(28)))
          .add(shipUp.clone().multiplyScalar(THREE.MathUtils.randFloatSpread(12)));
        particle.caught = false;
      }
      positions[i * 3 + 0] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;
    }
    this.spaceDust.points.geometry.attributes.position.needsUpdate = true;
  }

  updateTrails() {
    this.pushTrailPoint(this.playerTrail, this.playerShip.group.position, 42, 0.12);
    this.pushTrailPoint(this.artemisTrail, this.artemisShip.group.position, 42, 0.12);
  }

  updateOrbitTrails() {
    // Orbit guides are static line loops now, so no per-frame rebuilding is needed.
  }

  pushTrailPoint(trail, position, maxPoints, minDistance = 1.5) {
    const points = trail.points;
    if (
      points.length === 0 ||
      points[points.length - 1].distanceToSquared(position) > minDistance * minDistance
    ) {
      points.push(position.clone());
    }
    while (points.length > maxPoints) {
      points.shift();
    }
    this.rebuildTrailGeometry(trail, points);
  }

  rebuildTrailGeometry(trail, points) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const fade = 0.12 + (i / Math.max(points.length - 1, 1)) * 0.88;
      positions[i * 3 + 0] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      colors[i * 3 + 0] = trail.color.r * fade;
      colors[i * 3 + 1] = trail.color.g * fade;
      colors[i * 3 + 2] = trail.color.b * fade;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    trail.line.geometry.dispose();
    trail.line.geometry = geometry;
  }

  updateSkyAnchor() {
    this.skyAnchor.position.copy(this.camera.position);
    const attractMode = this.input.getSeatCount() === 0;
    this.constellationGroup.visible =
      !attractMode && this.debugSettings.showConstellations;
    for (const label of this.constellationLabels) {
      label.visible =
        !attractMode && this.debugSettings.showConstellationLabels;
    }
  }

  scanCurrentTarget() {
    const target = this.findLookTarget();
    if (!target) {
      this.lockedTarget = null;
      this.targetInfo =
        "No scan lock. Aim at a world, Artemis, or a mission marker and try again.";
      return;
    }
    this.lockedTarget = target;
    this.targetInfo = `${target.name}: ${target.description} POIs: ${target.poi.join(", ")}.`;
  }

  findLookTarget() {
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    let best = null;
    let bestScore = 0.92;

    const candidates = [
      ...this.worldBodies.map((body) => ({
        name: body.data.name,
        description: body.data.description,
        poi: body.data.poi,
        position: body.group.getWorldPosition(new THREE.Vector3())
      })),
      ...this.specialLocations.map((location) => ({
        name: location.name,
        description: location.description,
        poi: location.poi,
        position: location.group.position.clone()
      })),
      {
        name: SHIP_FACTS.artemis.name,
        description: SHIP_FACTS.artemis.description,
        poi: SHIP_FACTS.artemis.poi,
        position: this.artemisShip.group.position.clone()
      }
    ];

    for (const candidate of candidates) {
      const toTarget = candidate.position.clone().sub(this.camera.position).normalize();
      const score = toTarget.dot(direction);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  getNearestTarget() {
    const candidates = [
      ...this.worldBodies.map((body) => ({
        name: body.data.name,
        position: body.group.getWorldPosition(new THREE.Vector3())
      })),
      ...this.specialLocations.map((location) => ({
        name: location.name,
        position: location.group.position.clone()
      })),
      {
        name: "Artemis II",
        position: this.artemisShip.group.position.clone()
      }
    ];

    let nearest = candidates[0];
    let nearestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = candidate.position.distanceTo(this.playerState.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    }
    return { ...nearest, distance: nearestDistance };
  }

  updateControllerVisual() {
    const connected = this.input.rawGamepad.connected;
    this.controllerStatusNode.textContent = connected
      ? "Controller connected and updating live."
      : "No controller detected. Keyboard fallback is active.";

    for (const button of this.root.querySelectorAll("[data-gp-button]")) {
      const index = Number(button.dataset.gpButton);
      button.classList.toggle(
        "active",
        Boolean(this.input.rawGamepad.buttons[index]?.pressed)
      );
    }

    const leftStick = this.root.querySelector('[data-stick="left"] .controller-thumb');
    const rightStick = this.root.querySelector('[data-stick="right"] .controller-thumb');
    const axes = this.input.rawGamepad.axes;
    const setStick = (node, x = 0, y = 0) => {
      node.style.transform = `translate(${x * 12}px, ${y * 12}px)`;
    };
    setStick(leftStick, axes[0] ?? 0, axes[1] ?? 0);
    setStick(rightStick, axes[2] ?? 0, axes[3] ?? 0);
  }

  setMeter(key, value) {
    const fill = this.meterFillNodes[key];
    const label = this.meterValueNodes[key];
    if (!fill || !label) {
      return;
    }
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    fill.style.width = `${clamped * 100}%`;
    label.textContent = `${Math.round(clamped * 100)}%`;
  }

  getBoostStateLabel() {
    if (this.lifeSupportState.engineFrozen) {
      return "Frozen";
    }
    if (this.lifeSupportState.engineOverheated) {
      return "Hot Lock";
    }
    if (this.input.pilotBrake) {
      return "Braking";
    }
    if (this.input.pilotBoost > 0.2) {
      return "Boosting";
    }
    return "Nominal";
  }

  updateUi(dt) {
    const nearest = this.getNearestTarget();
    const cameraMode = CAMERA_MODES[this.debugSettings.cameraModeIndex];
    const attractMode = this.input.getSeatCount() === 0;
    this.cameraModeNode.textContent = attractMode ? "Museum" : cameraMode.label;
    this.nearestNode.textContent = nearest.name;
    this.targetNode.textContent = this.lockedTarget?.name ?? "None";
    this.boostStateNode.textContent = this.getBoostStateLabel();
    this.dustCountNode.textContent = String(this.scienceDustCollected);
    this.scannerStatusNode.textContent = this.scannerStatusText;
    this.gravityStatusNode.textContent =
      this.debugSettings.showGravityWells || this.gravityTargetName !== "Off"
        ? this.gravityTargetName
        : "Off";

    this.setMeter("oxygen", this.lifeSupportState.oxygen);
    this.setMeter("water", this.lifeSupportState.water);
    this.setMeter("engine", this.lifeSupportState.engineTemp);

    for (const role of ROLE_ORDER) {
      this.seatNodes[role].classList.toggle("occupied", this.input.seatActive[role]);
      this.seatNodes[role].classList.toggle("held", this.input.rawSeatHold[role]);
      this.seatNodes[role].setAttribute(
        "aria-pressed",
        String(this.input.seatActive[role])
      );
    }

    this.panelNodes.get("supportPrimary")?.classList.toggle(
      "panel-live",
      this.input.seatActive.engineer
    );
    this.panelNodes.get("supportSecondary")?.classList.toggle(
      "panel-live",
      this.input.seatActive.engineer
    );
    this.panelNodes.get("science")?.classList.toggle(
      "panel-live",
      this.input.seatActive.scientist
    );
    this.panelNodes.get("supportPrimary")?.classList.toggle(
      "hidden-panel",
      !this.input.seatActive.engineer && !this.activeLesson
    );
    this.panelNodes.get("supportSecondary")?.classList.toggle(
      "hidden-panel",
      !this.input.seatActive.engineer && !this.activeLesson
    );
    this.panelNodes.get("science")?.classList.toggle(
      "hidden-panel",
      !this.input.seatActive.scientist && !this.activeLesson
    );

    this.seatModeNode.textContent = this.input.toggleMode
      ? "Testing toggle mode is ON"
      : "Testing hold mode is ON";
    this.uiEditStatusNode.textContent = this.uiEditEnabled
      ? `UI edit is ON for ${this.uiEditScope === "all" ? "all HUD panels" : PANEL_ORDER.find((panel) => panel.id === this.selectedPanelId)?.label}. Drag the Move or Scale handles, or use the Scientist stick. Hold Shift or RB to scale.`
      : "UI edit is OFF. Enable it to reveal move and scale handles on the HUD.";

    this.applyUILayout();
    this.updateControllerVisual();
    if (this.lastRemapPendingAction !== this.input.remapPendingAction) {
      this.refreshKeymapList();
    }

    this.debugReadoutNode.textContent = JSON.stringify(
      {
        paused: this.isPaused,
        activeLesson: this.activeLesson?.id ?? null,
        debugVisible: this.debugVisible,
        cameraMode: cameraMode.id,
        invertCameraStep: this.debugSettings.invertCameraStep,
        cameraPanDeg: Number(THREE.MathUtils.radToDeg(this.cameraPan).toFixed(2)),
        attractMode,
        seats: this.input.seatActive,
        uiEditEnabled: this.uiEditEnabled,
        uiEditScope: this.uiEditScope,
        selectedPanel: this.selectedPanelId,
        nearest: nearest.name,
        lockedTarget: this.lockedTarget?.name ?? null,
        collision: this.lastCollisionName,
        lifeSupport: this.lifeSupportState,
        dustCollected: this.scienceDustCollected,
        gravityTarget: this.gravityTargetName,
        player: {
          x: Number(this.playerState.position.x.toFixed(2)),
          y: Number(this.playerState.position.y.toFixed(2)),
          z: Number(this.playerState.position.z.toFixed(2))
        },
        solarRoot: {
          x: Number(this.solarRoot.position.x.toFixed(2)),
          y: Number(this.solarRoot.position.y.toFixed(2)),
          z: Number(this.solarRoot.position.z.toFixed(2))
        },
        velocity: Number(this.playerState.velocity.length().toFixed(2)),
        boost: Number(this.input.pilotBoost.toFixed(2)),
        brake: this.input.pilotBrake,
        controllerConnected: this.input.rawGamepad.connected,
        fpsApprox: Math.round(1 / Math.max(dt, 0.0001))
      },
      null,
      2
    );
  }

  cycleInterestingTarget() {
    const candidates = [
      ...this.specialLocations.map((location) => ({
        name: location.name,
        description: location.description,
        poi: location.poi,
        position: location.group.position.clone()
      })),
      {
        name: SHIP_FACTS.artemis.name,
        description: SHIP_FACTS.artemis.description,
        poi: SHIP_FACTS.artemis.poi,
        position: this.artemisShip.group.position.clone()
      }
    ];

    if (candidates.length === 0) {
      return;
    }

    const currentIndex = candidates.findIndex(
      (candidate) => candidate.name === this.lockedTarget?.name
    );
    const next = candidates[(currentIndex + 1 + candidates.length) % candidates.length];
    this.lockedTarget = next;
    this.targetInfo = `${next.name}: ${next.description} POIs: ${next.poi.join(", ")}.`;
  }

  resumeFromPause() {
    this.isPaused = false;
    this.closeLesson();
    this.updatePauseVisibility();
  }

  updatePauseVisibility() {
    this.pauseNode.classList.toggle(
      "hidden",
      !this.isPaused || this.debugVisible || Boolean(this.activeLesson)
    );
  }

  updateDebugVisibility() {
    this.debugNode.classList.toggle("hidden", !this.debugVisible);
    this.updatePauseVisibility();
    this.applyUILayout();
    this.updateMenuFocus();
  }

  ensureAudio() {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return;
      }
      this.audioContext = new AudioCtor();
      this.audioMaster = this.audioContext.createGain();
      this.audioMaster.gain.value = 0.08;
      this.audioMaster.connect(this.audioContext.destination);

      this.engineOscillator = this.audioContext.createOscillator();
      this.engineOscillator.type = "sawtooth";
      this.engineOscillator.frequency.value = 120;
      this.engineGain = this.audioContext.createGain();
      this.engineGain.gain.value = 0;
      this.engineOscillator.connect(this.engineGain);
      this.engineGain.connect(this.audioMaster);
      this.engineOscillator.start();
    } catch {
      this.audioContext = null;
    }
  }

  playUiBlip(frequency = 620, duration = 0.06) {
    this.ensureAudio();
    if (!this.audioContext || !this.audioMaster) {
      return;
    }
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.audioMaster);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playCollectChime() {
    this.playUiBlip(880, 0.08);
    this.playUiBlip(1120, 0.1);
  }

  updateAudio(dt) {
    if (!this.audioContext || !this.engineOscillator || !this.engineGain) {
      return;
    }
    const speed = this.playerState.velocity.length();
    const targetGain =
      this.isPaused || this.debugVisible || this.activeLesson
        ? 0.0001
        : 0.018 + speed * 0.0012 + this.input.pilotBoost * 0.03;
    const targetFreq = 110 + speed * 8 + this.input.pilotBoost * 80;
    this.engineGain.gain.value = THREE.MathUtils.damp(
      this.engineGain.gain.value,
      targetGain,
      6,
      dt
    );
    this.engineOscillator.frequency.value = THREE.MathUtils.damp(
      this.engineOscillator.frequency.value,
      targetFreq,
      6,
      dt
    );
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  render() {
    this.composer.render();
  }

  onResize() {
    const { width, height } = this.getDisplaySize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  renderGameToText() {
    const nearest = this.getNearestTarget();
    return JSON.stringify(
      {
        coordinateSystem: {
          origin: "Sun at world origin",
          axes: "+X right, +Y up, +Z toward screen-right depth"
        },
        paused: this.isPaused,
        activeLesson: this.activeLesson?.id ?? null,
        debugVisible: this.debugVisible,
        cameraMode: CAMERA_MODES[this.debugSettings.cameraModeIndex].id,
        invertCameraStep: this.debugSettings.invertCameraStep,
        flightMode: this.flightModeLabel,
        attractMode: this.input.getSeatCount() === 0,
        seats: this.input.seatActive,
        toggleMode: this.input.toggleMode,
        flightAssist: this.debugSettings.flightAssist,
        nearest: nearest.name,
        lockedTarget: this.lockedTarget?.name ?? null,
        collision: this.lastCollisionName,
        scienceDustCollected: this.scienceDustCollected,
        scannerStatus: this.scannerStatusText,
        gravityTarget: this.gravityTargetName,
        lifeSupport: this.lifeSupportState,
        selectedPanel: this.selectedPanelId,
        uiEditEnabled: this.uiEditEnabled,
        uiEditScope: this.uiEditScope,
        shipVisible: this.playerShip.visualRoot.visible,
        cockpitVisible: this.cockpitInterior.visible,
        player: {
          x: Number(this.playerState.position.x.toFixed(2)),
          y: Number(this.playerState.position.y.toFixed(2)),
          z: Number(this.playerState.position.z.toFixed(2))
        },
        solarRoot: {
          x: Number(this.solarRoot.position.x.toFixed(2)),
          y: Number(this.solarRoot.position.y.toFixed(2)),
          z: Number(this.solarRoot.position.z.toFixed(2))
        },
        artemis: {
          x: Number(this.artemisShip.group.position.x.toFixed(2)),
          y: Number(this.artemisShip.group.position.y.toFixed(2)),
          z: Number(this.artemisShip.group.position.z.toFixed(2)),
          loopSeconds: ARTEMIS_LOOP_SECONDS
        }
      },
      null,
      2
    );
  }
}
