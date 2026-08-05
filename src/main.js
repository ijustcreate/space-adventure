import "./style.css";
import { SpaceAdventureApp } from "./game/SpaceAdventureApp.js";

const root = document.querySelector("#app");
const app = new SpaceAdventureApp(root);

window.spaceAdventure = app;
window.render_game_to_text = () => app.renderGameToText();
window.advanceTime = (ms) => app.advanceTime(ms);
