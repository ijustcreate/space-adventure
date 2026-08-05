# Space Adventure
## Children's Museum Exhibit GDD and Technical Design Brief

Version: 1.0
Date: April 9, 2026
Document Owner: Creative Direction + Engineering

## 1. Project Summary

**Space Adventure** is a NASA-inspired, cooperative museum exhibit in which up to four children sit at four simple stations and collaboratively fly a spacecraft through a stylized version of our solar system. The experience is designed for a children's museum, so it should feel welcoming, fast to understand, highly responsive, visually spectacular, and educational without feeling like a classroom lesson.

The simulation should present the solar system as a readable, explorable 3D space that prioritizes wonder and clarity over strict scientific scale. Distances and travel speeds should be compressed for fun, but the experience should still preserve recognizable planetary order, orbital relationships, and the feeling of real movement through space. The spacecraft begins near Earth, includes Artemis-inspired mission content, and provides points of interest on Earth, the Moon, and other planets.

This project is intended to be built **from scratch for desktop**, not in Unity or Unreal, and should launch from a single double-click entry point suitable for kiosk deployment.

## 2. Experience Goals

The exhibit should:

- Make children feel like a real crew, with every seat contributing something meaningful.
- Support 1 to 4 players gracefully, without breaking if some seats are empty.
- Be understandable within seconds, even for children who have never played a game before.
- Feel premium and "AAA-polished" through smooth motion, dramatic lighting, rich audio, and immediate feedback.
- Teach a few real ideas naturally: planets, orbital paths, Artemis, the Moon, gravity, flybys, and exploration.
- Reset itself elegantly when a group leaves.

## 3. Audience and Museum Context

- Primary audience: children roughly ages 5-12.
- Secondary audience: parents, teachers, and museum staff observing nearby.
- Environment: public museum floor, moderate noise, short dwell time, frequent turnover, minimal onboarding.
- Interaction model: seated, cooperative, high-visibility front screen, simple physical controls, repeatable 3-8 minute sessions.

## 4. High-Level Exhibit Format

- Four seats face one large main screen.
- Each seat has one simple physical control and one presence/engagement button.
- The main screen shows the interior view and forward window view of a spacecraft traveling through the solar system.
- A crew HUD shows which seats are occupied.
- If no one is controlling the ship, the system smoothly returns the vehicle to a default start area near Earth.
- The experience can operate with any subset of seats occupied.

## 5. Core Fantasy

Children should feel like:

- "I am flying the ship."
- "My seat matters."
- "We are going somewhere together."
- "Space is huge, beautiful, and full of places to discover."

The tone should sit between NASA inspiration and cinematic sci-fi optimism. It should feel grounded enough to echo real space exploration, but stylized enough to stay playful, readable, and exciting.

## 6. Session Flow

### Attract Mode

- The ship idles near Earth.
- Artemis route lines, planet labels, and occasional callouts animate softly.
- Empty-seat icons invite players to join.
- The spacecraft may slowly drift or auto-orbit to keep the screen alive.

### Join and Launch

- Children sit down and press/hold their seat activation buttons.
- Seat indicators fill as roles become occupied.
- Once at least one role is active, the ship becomes fully controllable.
- A short welcome line or sound cue acknowledges the crew.

### Free Exploration

- Players move through the solar system.
- POIs, mission prompts, and guided splines gently encourage exploration.
- The ship can approach planets, moons, and Artemis-related markers.

### Guided Moments

- Optional prompts suggest actions such as following the Artemis path, scanning the Moon, visiting Mars, or using a gravity assist.
- Facts, effects, and small interactive moments trigger near notable locations.

### Reset

- If all players leave or all station buttons release for a timeout period, the game enters return-to-home autopilot.
- The vehicle glides back to the Earth start area.
- UI resets to attract mode.

## 7. Roles and Station Design

Each role must be simple enough for a child to understand quickly, but meaningful enough that the seat feels important.

| Role | Physical Exhibit Control | Core Function | Design Intent |
| --- | --- | --- | --- |
| Pilot | Joystick | Steer spacecraft heading and directional intent | Gives a child the clearest feeling of "I fly the ship" |
| Engineer | Directional pad, lever, or back/forth input | Manage speed, boost, braking, and travel mode selection | Gives pacing control and assists the pilot |
| Scientist | Secondary joystick, tilt, or selector | Highlight POIs, aim scans, pick destinations, explore local targets | Creates discovery and learning interaction |
| Communicator | Single large button | Trigger interactions, mission callouts, confirmations, or helper actions | Gives the simplest but highest-confidence role |

## 8. Final Development Control Mapping

During development, the four physical stations will be simulated on a single Xbox controller. This mapping should be treated as a **development-time abstraction layer**, not a one-off hack. The game should think in terms of logical stations and actions, while the controller is just one input provider.

### Occupancy Rule

Every station has a button that means "a child is here and using this station."

- If the station activation button is held, that role is considered occupied.
- If toggle mode is enabled for testing, one press can latch the role on and another press can latch it off.
- If the role is not occupied, inputs from that role's control are ignored.
- The HUD must always show whether each seat is empty or filled.

### Xbox Mapping

| Station | Occupancy Button | Active Control While Occupied | Behavior |
| --- | --- | --- | --- |
| Station 1: Pilot | `X` | Left stick | Left stick only drives ship steering while `X` is held or toggled on |
| Station 2: Engineer | `A` | D-pad | D-pad only affects speed/travel selections while `A` is held or toggled on |
| Station 3: Scientist | `B` | Right stick | Right stick only affects targeting/selection while `B` is held or toggled on |
| Station 4: Communicator | `Y` | Select / Back button | Select / Back only triggers communicator action while `Y` is held or toggled on |
| Debug | `Start / Menu` | Opens development overlay | Available to developers regardless of seat occupancy |

### Required Developer Testing Options

- Toggle mode on/off per station.
- Global "treat button as hold" emulation.
- Visual readout showing raw controller state and interpreted logical state.
- Optional keyboard/mouse input injection for desks without a controller.

## 9. Seat Presence and HUD

The occupancy display is critical because it teaches children that the system understands who is participating.

Required behavior:

- Show four role icons at all times.
- Each icon has at least two states: empty and occupied.
- Occupied state should visibly "fill" and feel celebratory.
- Empty state should still look inviting, not disabled or broken.
- If all four are active, show a stronger "full crew" treatment.
- Seat UI should react instantly when buttons change state.

Recommended visual language:

- Empty seat: outline silhouette, dim glow, gentle pulse.
- Occupied seat: solid icon, brighter color, role badge, subtle animation.
- Full crew: coordinated color sweep, audio sting, or cockpit indicator pulse.

## 10. Single-Player and Partial-Crew Fallback

The exhibit must never require four children to be fun.

Rules:

- One child can play alone and still meaningfully explore.
- Empty roles should not stall progress.
- Missing-role functions should be assisted by automation, soft AI, or shared fallback behaviors.
- The system should always prioritize responsiveness over realism.

Recommended fallback behaviors:

- If Pilot is absent, ship follows guided rails or current autopilot target.
- If Engineer is absent, cruising speed is automatically managed.
- If Scientist is absent, nearby POIs auto-highlight.
- If Communicator is absent, contextual interactions auto-confirm after a short delay.

This allows the full exhibit to work with 1, 2, 3, or 4 participants without creating dead stations.

## 11. Auto-Return and Home State

The default home state should be near Earth, with Earth, the Moon, and Artemis points immediately readable.

Auto-return behavior:

- Trigger after a configurable inactivity timeout.
- Shift control authority from player input to guided autopilot.
- Use a smooth cinematic return path, not a hard teleport.
- Fade auxiliary UI back into attract mode.
- Reset prompts, mission state, and seat occupancy display.

The home area should include:

- Earth as the anchor location.
- The Moon nearby with lunar POIs.
- Artemis trajectory spline or mission markers.
- A visually strong "start here" composition.

## 12. Solar System Presentation Strategy

This exhibit should use a **museum-friendly compressed scale**, not literal astronomical scale. Literal scale would make the exhibit unreadable and boring. The correct solution is a layered scale model:

- Preserve correct planet order.
- Preserve broad relative size relationships.
- Compress interplanetary distances aggressively.
- Inflate planet radii slightly for readability and emotional impact.
- Use travel assists and cinematic transitions so kids can visit multiple major bodies in one session.

Recommended scale strategy:

- Inner solar system kept relatively close for frequent visits.
- Outer planets represented as farther "destinations," but still reachable in-session with boosts, guided lanes, or mission jumps.
- Local-space detail increases as the ship approaches a planet.
- Far-space view emphasizes silhouettes, orbit lines, labels, and atmosphere glows.

## 13. Points of Interest

### Earth POIs

- International Space Station
- Artemis launch point marker
- Night lights / continents callout
- Oceans and cloud systems
- Optional museum-specific "You are here" marker

### Moon POIs

- Artemis-related route marker
- Apollo landing region callout
- Far-side photography zone
- Crater and mare labels

### Other Planet Examples

- Mars: Olympus Mons, Valles Marineris, polar caps
- Jupiter: Great Red Spot, Galilean moon callouts
- Saturn: ring plane pass, Titan callout
- Neptune: high-wind storm marker

POIs should be short, visual, and rewarding. They should not interrupt flow with dense reading.

## 14. Artemis Integration

### Current Mission Reference

As of **April 9, 2026**, NASA's **Artemis II** mission has already launched. NASA states that:

- Artemis II lifted off on **April 1, 2026 at 6:35 p.m. EDT**.
- The mission duration is approximately **10 days**.
- Orion first enters Earth orbit, then transitions into a **high Earth orbit**.
- NASA describes that high Earth orbit as approximately **44,525 x 115 statute miles**.
- A translunar injection burn sends Orion outbound toward the Moon.
- NASA describes the mission path as a **figure-eight** style route extending more than **230,000 miles from Earth**.
- The crew travels about **4,600 miles beyond the far side of the Moon**.
- The return leg uses a **free-return trajectory**, allowing the Earth-Moon gravity system to naturally guide Orion back toward Earth.

For this exhibit, Artemis should be presented as an inspiration and educational layer, not as the only activity.

### How to Show Artemis in 3D

The best visualization approach is a three-layer system:

1. **Mission spline layer**
   Render a bright, elegant path line that shows the Artemis route from Earth, through high Earth orbit, into translunar transit, around the Moon, and back home.

2. **Mission marker layer**
   Place labeled milestone nodes such as Launch, High Earth Orbit, Translunar Injection, Lunar Flyby, Far Side, Free Return, and Splashdown.

3. **Live or reference trajectory layer**
   Use NASA ephemeris/state-vector data when possible for the accurate path, then smooth it visually with a curve representation that remains readable to children.

### Recommended Display Treatment

- Artemis path uses a unique color family, distinct from orbit guides.
- Milestones animate when the crew nears them.
- Kids can optionally "follow the Artemis trail."
- A ghost ship or pulse can move along the line to indicate timing and direction.
- The Moon flyby moment should be staged as a hero beat.

### Engineering Note

Do not hard-code Artemis as a hand-drawn curve if accuracy matters. Instead:

- Import NASA ephemeris or state-vector data.
- Convert coordinates into the simulation's compressed exhibit space.
- Use spline fitting for display only.
- Keep the source data and display geometry separate.

This preserves both scientific grounding and visual clarity.

## 15. Gravity and Teaching Moments

The exhibit should communicate gravity visually and intuitively, not with equations on screen.

Programmatic gravity teaching ideas:

- Show soft curvature lines around planets to suggest local gravitational influence.
- Bend predicted trajectory arcs when the ship approaches a major body.
- Use color-shifted flow lines or ribbon trails to show a slingshot/gravity-assist effect.
- Make gravity more visible when the Scientist role is active.
- Briefly visualize "pull strength" as concentric distortions or field ripples.

Rules for readability:

- These effects must be attractive, not cluttered.
- Gravity indicators should appear contextually near important bodies.
- Use them as a teaching overlay, not as permanent noise.

## 16. Vehicle Controls and Feel

The spacecraft should feel responsive first, believable second. This is a children's museum exhibit, so fun and readability outrank simulation purity.

Control design principles:

- Fast input-to-feedback response.
- Gentle inertia, never sluggishness.
- Assisted steering so children feel successful immediately.
- Strong contextual aim assistance near POIs and route lines.
- Smooth camera behavior without sudden spins or disorienting roll.

Recommended movement model:

- Pilot controls desired heading, not raw thruster physics.
- Engineer controls travel mode, speed bands, boost, and braking.
- Autopilot assists in stabilizing motion.
- Near planets, switch to a local navigation mode with reduced speed and better framing.

The ship should feel like:

- Stable at rest
- Exciting when boosting
- Graceful during planet approaches
- Safe and legible at all times

## 17. Additional Ideas to Improve the Exhibit

These are the requested **13 additional ideas** to elevate the museum experience:

1. **Crew badges per session**
   Assign each run a mission patch generated from the crew's visited locations.

2. **Planet stamp collection**
   Visiting a planet unlocks a visible stamp on the crew HUD for that session.

3. **Gravity-assist challenge gates**
   Let kids swing near planets to earn a short speed bonus.

4. **Constellation interludes**
   During quiet moments, nearby star patterns can briefly connect into recognizable constellations.

5. **Mission Control voice prompts**
   Use short, encouraging callouts that reinforce team roles.

6. **Photo moment near major destinations**
   Trigger a stylized crew snapshot screen near Earth, the Moon, Mars, or Saturn.

7. **Discovery scan pulse**
   The Scientist can reveal hidden facts, moon labels, or atmosphere layers with a scan effect.

8. **Emergency teamwork moments**
   Introduce light cooperative events such as shield activation or navigation correction.

9. **Museum-branded destination marker**
   Include a custom marker tying the experience to the host museum.

10. **Orbit time-lapse mode**
   A temporary visualization can accelerate orbital motion so kids see planets moving around the Sun.

11. **Friendly AI companion**
   A simple ship computer can guide solo players and celebrate discoveries.

12. **Accessible language mode**
   Support short-form multilingual facts and icon-first prompts.

13. **End-of-session recap**
   Summarize where the crew traveled, what they found, and which roles were active.

## 18. Art Direction

The exhibit should aim for a premium cinematic look without drifting into gritty realism or hard sci-fi darkness. It should feel bright, awe-filled, and readable for children standing in a museum.

### Visual Pillars

- NASA-inspired credibility
- Clean cockpit framing
- Bold silhouettes
- Rich atmosphere and glow
- High readability at a distance
- Spectacle without chaos

### Planet Look

- Use stylized but believable color palettes.
- Favor clean large-scale forms over noisy texture detail.
- Keep planets spherical and iconic.
- Increase local detail as the player gets closer.
- Atmospheres should feel luminous and layered, especially for Earth, Venus, Jupiter, Saturn, Uranus, and Neptune.

### Cloud and Atmosphere Ideas

When approaching planets, add procedural or shader-driven local effects:

- Earth: layered cloud shell with scrolling weather textures and soft day-night terminator.
- Venus: thick glowing haze, soft occlusion, amber scattering.
- Mars: dusty horizon tint, subtle atmospheric rim.
- Jupiter and Saturn: banded storm sheets, animated vortex masks, soft volumetric edge haze.
- Gas giant moons: thinner rim lights and surface-driven dust/frost tones.

Use a multi-shell approach where appropriate:

- Solid planet body
- Cloud layer shell
- Atmosphere scattering shell
- Optional storm/lightning layer for hero planets

## 19. Rendering and "AAA Polish" Guidance

This project needs to feel dramatically better than a typical kiosk app. The fastest way to lose that feeling is inconsistent frame pacing, muddy composition, or over-designed effects. The rendering should be clean, selective, and confident.

### Recommended Graphics Stack

- Language: C++20
- Platform: Windows desktop kiosk build
- Graphics API: Direct3D 12 on Windows
- Input: XInput or GameInput abstraction
- Audio: XAudio2 or similar low-latency API
- UI: custom runtime UI with optional dev overlay framework

### Visual Features Worth Implementing

- HDR-style lighting pipeline, even if final display is SDR
- Physically inspired but art-directed tone mapping
- Bloom tuned for stars, the Sun, atmosphere rims, engine glow, and UI highlights
- Motion trails or ribbon trails during boost
- Screen-space or local-space glow cards for bright celestial bodies
- Temporal anti-aliasing or similarly stable anti-flicker solution
- Shadowed cockpit interior framing to improve depth
- Gradient-based color grading by region or destination

### Bloom Advice

Bloom should support wonder, not blur the entire image.

- Threshold bright regions aggressively.
- Use multi-scale blur rather than one wide blur.
- Keep planet edges crisp beneath glow.
- Allow art tuning by object category: Sun, stars, engine, UI, atmosphere.

### Motion Trail Advice

- Use trails only during meaningful acceleration, boost, or autopilot transitions.
- Favor thin ribbon trails, engine streaks, or star-stretch layers over full-screen smear.
- Avoid anything that makes children feel motion sick.

### Particle and Sky Generation

Stars and space particles should be layered, not random noise:

- Far starfield layer: high-count, static, low-parallax stars.
- Mid sparkle layer: fewer, brighter stars with mild intensity variation.
- Dust or nebula accent layer: sparse and stylized, only where composition benefits.
- Local flythrough particles: tiny drifting specks visible mainly during speed moments.

Recommended implementation:

- Generate far stars procedurally from seeded distributions so the sky is stable across builds.
- Separate stars by brightness class and color temperature.
- Use billboards or point sprites for most stars.
- Add occasional twinkle through low-frequency luminance modulation, not rapid blinking.
- Avoid overcrowding the sky; black space is part of the beauty.

### Camera Polish

- Keep horizon stability high.
- Use soft spring damping, not loose floatiness.
- Frame planets cinematically during approaches.
- Slightly widen field of view during boost.
- Use subtle camera vibration only for specific events.

## 20. Engine and Architecture Guidance

Because this is a custom desktop build, architecture discipline matters more than usual. The codebase must be modular, data-driven, and built for replacement of development inputs with exhibit hardware later.

### Core Architectural Principles

- Separate gameplay logic from rendering.
- Separate logical station input from physical device input.
- Keep educational content data-driven, not hard-coded in gameplay classes.
- Build deterministic update loops where practical.
- Design for kiosk reliability before feature sprawl.

### Recommended Runtime Layers

- Platform layer
- Core engine layer
- Renderer
- Audio
- Input abstraction
- Simulation and celestial systems
- Gameplay and mission systems
- UI and attract mode systems
- Tools and debug systems

### Input Architecture

Use a logical action map such as:

- `SeatPilotOccupied`
- `PilotSteer`
- `SeatEngineerOccupied`
- `EngineerAdjust`
- `SeatScientistOccupied`
- `ScientistAim`
- `SeatCommunicatorOccupied`
- `CommunicatorAction`
- `OpenDebugMenu`

Then bind Xbox input, keyboard debug input, and later physical museum hardware to those logical actions through adapters. This prevents later hardware integration from breaking game logic.

### State Model

Use explicit states for:

- Attract
- Join
- Exploration
- PlanetApproach
- ArtemisGuide
- EventMoment
- IdleReturn
- DebugPause or DebugOverlay

A clear state machine will make the exhibit easier to stabilize and easier for a team to extend safely.

## 21. Performance and Reliability Targets

The exhibit should feel exceptionally smooth.

Target technical goals:

- Stable 60 FPS minimum on museum hardware
- Consistent frame pacing
- Input latency low enough to feel instant
- No noticeable hitching during planet transitions
- Fast boot to attract mode
- Recovery from transient input disconnects without crashing

### Performance Strategy

- Use aggressive LODs for planets and local effects.
- Stream high-detail assets only when approaching a destination.
- Keep draw-call counts predictable.
- Batch particles by material and blend mode.
- Avoid expensive full-resolution post effects when half-resolution works.
- Precompute or cache orbit guides, label anchors, and route geometry.

### Museum Reliability Strategy

- Watchdog logging and crash capture
- Automatic return to attract mode after errors
- Configurable kiosk mode
- Hidden operator shortcuts
- Safe fallback content if data loads fail

## 22. Debug Menu Requirements

The `Start / Menu` button opens a development debug overlay on top of the simulation.

The first version should include empty expandable panels or placeholders for:

- Input state
- Seat occupancy
- Travel mode
- Current target / POI
- Autopilot status
- Artemis visualization toggles
- Performance metrics
- Camera tuning
- Bloom / post-process tuning
- Planet scale and distance tuning
- Event forcing and reset tools

The debug menu should:

- Pause or not pause simulation based on a toggle
- Never crash if data is missing
- Be easy for developers to extend
- Be visually distinct from the public-facing UI

## 23. Content Pipeline Advice

The project should mix procedural systems with curated content:

- Procedural for orbits, star distribution, atmosphere animation, trails, and many visual overlays
- Curated for POIs, mission beats, voice lines, labels, and camera moments

Keep most exhibit content in external data files:

- Planet display definitions
- Orbit and scale tuning
- POI data
- Artemis mission data
- Localization strings
- UI layout tuning
- Role behavior tuning

This keeps the experience editable by designers, technical artists, and programmers without constant code changes.

## 24. Recommended Project Folder Setup

Below is a team-friendly structure intended to feel like a professional game or simulation project maintained by multiple humans at once.

```text
SpaceAdventure/
  README.md
  LICENSE/
  docs/
    GDD/
      Space_Adventure_GDD.md
    TDD/
      Engine_Architecture.md
      Rendering_Pipeline.md
      Input_Integration.md
    Art/
      Art_Bible.md
      UI_Guidelines.md
    Production/
      Milestones.md
      Task_Board_Conventions.md
      Build_and_Release.md
  config/
    dev/
    museum/
    release/
  data/
    solar_system/
      planets.json
      moons.json
      orbit_scale.json
      poi_catalog.json
    missions/
      artemis_ii.json
      attract_mode_routes.json
    ui/
      hud_layout.json
      seat_icons.json
    localization/
      en-US.json
      es-US.json
  assets/
    audio/
      music/
      sfx/
      voice/
    fonts/
    textures/
      planets/
      ui/
      fx/
    materials/
    meshes/
      cockpit/
      planets/
      props/
    video/
  shaders/
    common/
    post/
    planet/
    atmosphere/
    particles/
    ui/
  src/
    app/
    core/
    platform/
    math/
    engine/
    render/
    audio/
    input/
    simulation/
      celestial/
      routes/
      physics/
    gameplay/
      roles/
      poi/
      events/
      session/
    ui/
      hud/
      menus/
      debug/
    tools/
    third_party/
  tests/
    unit/
    integration/
    playback/
  tools/
    asset_build/
    data_validation/
    trajectory_import/
    localization/
    profiling/
  build/
    scripts/
    packaging/
  dist/
    museum/
```

### Folder Intent

- `docs/` is the human-facing knowledge base.
- `config/` holds environment-specific settings.
- `data/` holds design-tunable content and mission definitions.
- `assets/` holds authored source assets.
- `shaders/` holds rendering programs by feature area.
- `src/` holds runtime code, clearly split by responsibility.
- `tests/` holds automated verification.
- `tools/` holds offline helpers and importers.
- `dist/` is the packaged deliverable.

### Collaboration Advice

- Keep runtime code and authored data separated.
- Never bury planet facts or POIs inside gameplay source files.
- Use naming conventions and ownership boundaries per folder.
- Prefer small, reviewable feature branches.
- Require code review for renderer, input, and gameplay-state changes.
- Keep build scripts deterministic so museum deployments are repeatable.
- Maintain a living `Art_Bible.md` and `Engine_Architecture.md`.

## 25. Packaging and Delivery

This project should ship as a kiosk-friendly Windows build with one obvious launch path.

Recommended release packaging:

- `SpaceAdventure.exe`
- `Content.pak` or equivalent packed data archive
- `config/release/`
- optional logs folder created at runtime

From the museum operator perspective, it should still be "double-click one thing and it runs." Internally, using a packed content archive is cleaner and more maintainable than trying to force every asset into the executable binary.

## 26. Final Creative and Engineering Advice

If the team wants this to feel truly premium, the priorities should be:

- ultra-stable performance
- strong composition
- immediate input feedback
- beautiful planet approaches
- disciplined UI clarity
- a clean input abstraction that cleanly swaps Xbox testing for final museum hardware

The biggest quality jump will not come from adding dozens of extra features. It will come from making a smaller set of systems feel finished:

- great steering feel
- beautiful Earth and Moon presentation
- strong Artemis route visualization
- elegant seat occupancy feedback
- polished camera and atmosphere rendering
- frictionless attract mode and reset flow

That is the difference between a clever prototype and a museum-quality flagship exhibit.

## 27. Reference Notes

NASA references used for Artemis section and implementation guidance:

- NASA Artemis mission hub: https://www.nasa.gov/artemis
- Artemis II mission page: https://www.nasa.gov/artemis-ii
- Artemis II launch event page: https://www.nasa.gov/event/artemis-ii-launch/
- Artemis II press kit / mission overview: https://www.nasa.gov/artemis-ii-press-kit/
- Artemis II launch news release: https://www.nasa.gov/news-release/liftoff-nasa-launches-astronauts-on-historic-artemis-moon-mission/
- Artemis real-time orbit and ephemeris article: https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
