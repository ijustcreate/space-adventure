import { ROLE_ORDER } from "./content.js";

const DEAD_ZONE = 0.18;
const STORAGE_KEY = "space-adventure-keybindings-v3";

export const REMAPPABLE_ACTIONS = [
  { id: "seat_pilot", label: "Pilot Seat Toggle" },
  { id: "seat_engineer", label: "Life Support Seat Toggle" },
  { id: "seat_scientist", label: "Science Seat Hold" },
  { id: "seat_communicator", label: "Mission Ops Seat Toggle" },
  { id: "pilot_left", label: "Pilot Left" },
  { id: "pilot_right", label: "Pilot Right" },
  { id: "pilot_up", label: "Pilot Up" },
  { id: "pilot_down", label: "Pilot Down" },
  { id: "pilot_boost", label: "Pilot Boost" },
  { id: "pilot_brake", label: "Pilot Brake" },
  { id: "life_support_up", label: "Life Support Up" },
  { id: "life_support_down", label: "Life Support Down" },
  { id: "life_support_left", label: "Life Support Left" },
  { id: "life_support_right", label: "Life Support Right" },
  { id: "scientist_left", label: "Science Left" },
  { id: "scientist_right", label: "Science Right" },
  { id: "scientist_up", label: "Science Up" },
  { id: "scientist_down", label: "Science Down" },
  { id: "scientist_scale_modifier", label: "UI Edit Scale Modifier" },
  { id: "communicator_action", label: "Mission Ops Action" },
  { id: "debug_toggle", label: "Debug Overlay" },
  { id: "fullscreen", label: "Fullscreen" },
  { id: "toggle_mode", label: "Toggle/Hold Seat Mode" },
  { id: "constellation_toggle", label: "Constellation Overlay" },
  { id: "save_layout", label: "Save UI Layout" },
  { id: "reset_layout", label: "Reset UI Layout" }
];

export const DEFAULT_KEY_BINDINGS = {
  seat_pilot: "Digit1",
  seat_engineer: "Digit2",
  seat_scientist: "Digit3",
  seat_communicator: "Digit4",
  pilot_left: "KeyA",
  pilot_right: "KeyD",
  pilot_up: "KeyW",
  pilot_down: "KeyS",
  pilot_boost: "ShiftLeft",
  pilot_brake: "ControlLeft",
  life_support_up: "ArrowUp",
  life_support_down: "ArrowDown",
  life_support_left: "ArrowLeft",
  life_support_right: "ArrowRight",
  scientist_left: "KeyJ",
  scientist_right: "KeyL",
  scientist_up: "KeyI",
  scientist_down: "KeyK",
  scientist_scale_modifier: "KeyU",
  communicator_action: "Space",
  debug_toggle: "F1",
  fullscreen: "KeyF",
  toggle_mode: "KeyT",
  constellation_toggle: "KeyC",
  save_layout: "KeyP",
  reset_layout: "KeyR"
};

export class InputManager {
  constructor() {
    this.toggleMode = true;
    this.keyBindings = this.loadBindings();
    this.remapPendingAction = null;
    this.keyboard = new Set();
    this.prevKeyboard = new Set();
    this.prevGamepadButtons = [];
    this.seatActive = {
      pilot: false,
      engineer: false,
      scientist: false,
      communicator: false
    };
    this.justPressed = {
      communicatorAction: false,
      communicatorSecondary: false,
      communicatorTertiary: false,
      debugToggle: false,
      pauseToggle: false,
      fullscreen: false,
      constellationToggle: false,
      saveLayout: false,
      resetLayout: false,
      lifeSupportCool: false,
      menuUp: false,
      menuDown: false,
      menuLeft: false,
      menuRight: false,
      menuConfirm: false,
      menuCancel: false
    };
    this.lifeSupportHold = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    this.axes = {
      pilot: { x: 0, y: 0 },
      scientist: { x: 0, y: 0 }
    };
    this.rawSeatHold = {
      pilot: false,
      engineer: false,
      scientist: false,
      communicator: false
    };
    this.uiSeatOverrides = {
      pilot: false,
      engineer: false,
      scientist: false,
      communicator: false
    };
    this.rawGamepad = {
      connected: false,
      axes: [],
      buttons: []
    };
    this.uiScaleModifier = false;
    this.pilotBoost = 0;
    this.pilotBrake = false;

    window.addEventListener("keydown", (event) => {
      if (this.remapPendingAction) {
        event.preventDefault();
        this.keyBindings[this.remapPendingAction] = event.code;
        this.saveBindings();
        this.remapPendingAction = null;
        return;
      }

      this.keyboard.add(event.code);
      if (
        [
          this.keyBindings.life_support_up,
          this.keyBindings.life_support_down,
          this.keyBindings.life_support_left,
          this.keyBindings.life_support_right,
          this.keyBindings.communicator_action
        ].includes(event.code)
      ) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keyboard.delete(event.code);
    });
  }

  loadBindings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_KEY_BINDINGS };
      }
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_KEY_BINDINGS,
        ...parsed
      };
    } catch {
      return { ...DEFAULT_KEY_BINDINGS };
    }
  }

  saveBindings() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.keyBindings));
  }

  resetBindings() {
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.saveBindings();
  }

  startRemap(actionId) {
    this.remapPendingAction = actionId;
  }

  cancelRemap() {
    this.remapPendingAction = null;
  }

  getBindingEntries() {
    return REMAPPABLE_ACTIONS.map((item) => ({
      ...item,
      key: this.keyBindings[item.id]
    }));
  }

  update(options = {}) {
    const mode = options.mode ?? "game";
    const allowSeatUpdates = mode === "game";
    const allowGameplayInput = mode === "game";
    const allowUiEditingInput = mode === "debug";
    const allowMenuInput = mode === "pause" || mode === "debug" || mode === "lesson";

    for (const key of Object.keys(this.justPressed)) {
      this.justPressed[key] = false;
    }
    this.lifeSupportHold.up = false;
    this.lifeSupportHold.down = false;
    this.lifeSupportHold.left = false;
    this.lifeSupportHold.right = false;
    this.pilotBoost = 0;
    this.pilotBrake = false;

    const gamepad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    this.rawGamepad.connected = Boolean(gamepad);
    this.rawGamepad.axes = gamepad?.axes ? [...gamepad.axes] : [];
    this.rawGamepad.buttons = gamepad?.buttons
      ? gamepad.buttons.map((button) => ({
          pressed: Boolean(button.pressed),
          value: Number(button.value ?? 0)
        }))
      : [];

    const buttonDown = (index) => Boolean(gamepad?.buttons?.[index]?.pressed);
    const buttonValue = (index) => Number(gamepad?.buttons?.[index]?.value ?? 0);
    const buttonPressed = (actionId) => this.keyboard.has(this.keyBindings[actionId]);
    const pressedEdge = (actionId) =>
      buttonPressed(actionId) && !this.prevKeyboard.has(this.keyBindings[actionId]);
    const gamepadEdge = (index) => buttonDown(index) && !this.prevGamepadButtons[index];
    const escapeEdge = this.keyboard.has("Escape") && !this.prevKeyboard.has("Escape");

    const seatSources = {
      pilot: { action: "seat_pilot", button: 2, holdOnly: false },
      engineer: { action: "seat_engineer", button: 0, holdOnly: false },
      scientist: { action: "seat_scientist", button: 1, holdOnly: true },
      communicator: { action: "seat_communicator", button: 3, holdOnly: false }
    };

    for (const role of ROLE_ORDER) {
      const source = seatSources[role];
      const hold = buttonPressed(source.action) || buttonDown(source.button);
      const edge = pressedEdge(source.action) || gamepadEdge(source.button);
      this.rawSeatHold[role] = hold;

      if (allowSeatUpdates) {
        if (source.holdOnly) {
          this.seatActive[role] = hold;
        } else if (this.toggleMode) {
          if (edge) {
            this.seatActive[role] = !this.seatActive[role];
          }
        } else {
          this.seatActive[role] = hold;
        }
      }

      if (this.uiSeatOverrides[role]) {
        this.seatActive[role] = true;
      }
    }

    const pilotX = this.readAxis(
      gamepad?.axes?.[0] ?? 0,
      "pilot_left",
      "pilot_right"
    );
    const pilotY = this.readAxis(
      gamepad?.axes?.[1] ?? 0,
      "pilot_up",
      "pilot_down"
    );
    const scientistX = this.readAxis(
      gamepad?.axes?.[2] ?? 0,
      "scientist_left",
      "scientist_right"
    );
    const scientistY = this.readAxis(
      gamepad?.axes?.[3] ?? 0,
      "scientist_up",
      "scientist_down"
    );

    this.axes.pilot.x = allowGameplayInput && this.seatActive.pilot ? pilotX : 0;
    this.axes.pilot.y = allowGameplayInput && this.seatActive.pilot ? pilotY : 0;
    this.axes.scientist.x =
      (allowGameplayInput || allowUiEditingInput) && this.seatActive.scientist
        ? scientistX
        : 0;
    this.axes.scientist.y =
      (allowGameplayInput || allowUiEditingInput) && this.seatActive.scientist
        ? scientistY
        : 0;

    const dpadUp = buttonPressed("life_support_up") || buttonDown(12);
    const dpadDown = buttonPressed("life_support_down") || buttonDown(13);
    const dpadLeft = buttonPressed("life_support_left") || buttonDown(14);
    const dpadRight = buttonPressed("life_support_right") || buttonDown(15);

    if (allowGameplayInput && this.seatActive.engineer) {
      this.lifeSupportHold.up = dpadUp;
      this.lifeSupportHold.down = dpadDown;
      this.lifeSupportHold.left = dpadLeft;
      this.lifeSupportHold.right = dpadRight;
      this.justPressed.lifeSupportCool =
        dpadDown &&
        !(
          this.prevKeyboard.has(this.keyBindings.life_support_down) ||
          this.prevGamepadButtons[13]
        );
    }

    if (allowMenuInput) {
      this.justPressed.menuUp =
        (pressedEdge("life_support_up") || gamepadEdge(12)) ||
        this.axisCrossed(gamepad?.axes?.[1] ?? 0, "up");
      this.justPressed.menuDown =
        (pressedEdge("life_support_down") || gamepadEdge(13)) ||
        this.axisCrossed(gamepad?.axes?.[1] ?? 0, "down");
      this.justPressed.menuLeft =
        (pressedEdge("life_support_left") || gamepadEdge(14)) ||
        this.axisCrossed(gamepad?.axes?.[0] ?? 0, "left");
      this.justPressed.menuRight =
        (pressedEdge("life_support_right") || gamepadEdge(15)) ||
        this.axisCrossed(gamepad?.axes?.[0] ?? 0, "right");
      this.justPressed.menuConfirm =
        pressedEdge("communicator_action") || gamepadEdge(0) || gamepadEdge(2);
      this.justPressed.menuCancel = escapeEdge || gamepadEdge(1) || gamepadEdge(9);
    }

    this.uiScaleModifier =
      (buttonPressed("scientist_scale_modifier") || buttonDown(5)) &&
      allowUiEditingInput &&
      this.seatActive.scientist;

    if (allowGameplayInput && this.seatActive.pilot) {
      this.pilotBrake =
        buttonPressed("pilot_brake") || buttonDown(4);
      this.pilotBoost = Math.max(
        buttonPressed("pilot_boost") ? 1 : 0,
        buttonValue(6)
      );
    }

    this.justPressed.communicatorAction =
      allowGameplayInput &&
      this.seatActive.communicator &&
      (pressedEdge("communicator_action") || gamepadEdge(8));
    this.justPressed.communicatorSecondary =
      allowGameplayInput && this.seatActive.communicator && gamepadEdge(5);
    this.justPressed.communicatorTertiary =
      allowGameplayInput && this.seatActive.communicator && gamepadEdge(7);

    if (pressedEdge("debug_toggle")) {
      this.justPressed.debugToggle = true;
    }

    if (escapeEdge || gamepadEdge(9)) {
      this.justPressed.pauseToggle = true;
    }

    if (pressedEdge("fullscreen")) {
      this.justPressed.fullscreen = true;
    }

    if (pressedEdge("toggle_mode")) {
      this.toggleMode = !this.toggleMode;
    }

    if (pressedEdge("constellation_toggle")) {
      this.justPressed.constellationToggle = true;
    }

    if (pressedEdge("save_layout")) {
      this.justPressed.saveLayout = true;
    }

    if (pressedEdge("reset_layout")) {
      this.justPressed.resetLayout = true;
    }

    this.prevKeyboard = new Set(this.keyboard);
    this.prevGamepadButtons =
      gamepad?.buttons?.map((button) => Boolean(button.pressed)) ?? [];
    this.prevMenuAxes = {
      x: gamepad?.axes?.[0] ?? 0,
      y: gamepad?.axes?.[1] ?? 0
    };
  }

  axisCrossed(value, direction) {
    const prev = this.prevMenuAxes ?? { x: 0, y: 0 };
    if (direction === "up") {
      return value < -0.6 && prev.y >= -0.6;
    }
    if (direction === "down") {
      return value > 0.6 && prev.y <= 0.6;
    }
    if (direction === "left") {
      return value < -0.6 && prev.x >= -0.6;
    }
    return value > 0.6 && prev.x <= 0.6;
  }

  readAxis(gamepadAxis, negativeAction, positiveAction) {
    const keyboardValue =
      (this.keyboard.has(this.keyBindings[positiveAction]) ? 1 : 0) -
      (this.keyboard.has(this.keyBindings[negativeAction]) ? 1 : 0);
    if (Math.abs(keyboardValue) > 0) {
      return keyboardValue;
    }
    return Math.abs(gamepadAxis) >= DEAD_ZONE ? gamepadAxis : 0;
  }

  getSeatCount() {
    return Object.values(this.seatActive).filter(Boolean).length;
  }

  toggleSeatOverride(role) {
    if (!(role in this.uiSeatOverrides)) {
      return;
    }
    this.uiSeatOverrides[role] = !this.uiSeatOverrides[role];
    this.seatActive[role] = this.uiSeatOverrides[role];
  }
}
