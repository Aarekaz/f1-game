import Phaser from "phaser";
import "./styles.css";
import { RaceScene } from "./scenes/RaceScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#080a08",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [RaceScene]
};

new Phaser.Game(config);
