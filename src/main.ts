import Phaser from "phaser";
import "./style.css";
import { BootScene } from "./scenes/BootScene";
import { IslandScene } from "./scenes/IslandScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#78c7e8",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, IslandScene],
};

new Phaser.Game(config);
