import candyPreview from "../assets/snake-skins/candy.png";
import cyberPreview from "../assets/snake-skins/cyber.png";
import frostPreview from "../assets/snake-skins/frost.png";
import galaxyPreview from "../assets/snake-skins/galaxy.png";
import ghostPreview from "../assets/snake-skins/ghost.png";
import jadePreview from "../assets/snake-skins/jade.png";
import junglePreview from "../assets/snake-skins/jungle.png";
import lavaPreview from "../assets/snake-skins/lava.png";
import royalPreview from "../assets/snake-skins/royal.png";
import tigerPreview from "../assets/snake-skins/tiger.png";

export const SNAKE_SKINS = [
  {
    id: "cyber",
    name: "霓虹赛博",
    subtitle: "电路光鳞",
    preview: cyberPreview,
    body: "#53f3ff",
    bodyAlt: "#ff4fd8",
    head: "#b8fff7",
    glow: "#53f3ff",
    eye: "#020611",
    pattern: "circuits",
  },
  {
    id: "lava",
    name: "熔岩裂隙",
    subtitle: "炽热岩纹",
    preview: lavaPreview,
    body: "#ff6b35",
    bodyAlt: "#ffd166",
    head: "#ffb347",
    glow: "#ff2e63",
    eye: "#fff3c4",
    pattern: "cracks",
  },
  {
    id: "frost",
    name: "冰霜极光",
    subtitle: "冷焰雪点",
    preview: frostPreview,
    body: "#b7f7ff",
    bodyAlt: "#6bbcff",
    head: "#ecfeff",
    glow: "#dffcff",
    eye: "#0c2742",
    pattern: "snow",
  },
  {
    id: "jungle",
    name: "雨林毒藤",
    subtitle: "荧绿叶斑",
    preview: junglePreview,
    body: "#7dff6f",
    bodyAlt: "#2dd36f",
    head: "#d4ff75",
    glow: "#7dff6f",
    eye: "#07120c",
    pattern: "leaves",
  },
  {
    id: "royal",
    name: "紫金王冠",
    subtitle: "宝石鳞片",
    preview: royalPreview,
    body: "#9b5cff",
    bodyAlt: "#ffd166",
    head: "#f6e7ff",
    glow: "#c084fc",
    eye: "#fff7c4",
    pattern: "gems",
  },
  {
    id: "candy",
    name: "糖果脉冲",
    subtitle: "粉蓝条纹",
    preview: candyPreview,
    body: "#ff7ad9",
    bodyAlt: "#53f3ff",
    head: "#fff1a8",
    glow: "#ff7ad9",
    eye: "#40132f",
    pattern: "stripes",
  },
  {
    id: "galaxy",
    name: "星河漫游",
    subtitle: "深空星点",
    preview: galaxyPreview,
    body: "#6d5dfc",
    bodyAlt: "#ff4fd8",
    head: "#f8fbff",
    glow: "#8b5cf6",
    eye: "#ffffff",
    pattern: "stars",
  },
  {
    id: "jade",
    name: "青玉龙鳞",
    subtitle: "玉质鳞光",
    preview: jadePreview,
    body: "#22d3a6",
    bodyAlt: "#b6f7d1",
    head: "#eafff5",
    glow: "#5eead4",
    eye: "#06221b",
    pattern: "scales",
  },
  {
    id: "tiger",
    name: "电光虎纹",
    subtitle: "金黑斑纹",
    preview: tigerPreview,
    body: "#ffd166",
    bodyAlt: "#111827",
    head: "#fff7c4",
    glow: "#53f3ff",
    eye: "#ffffff",
    pattern: "tiger",
  },
  {
    id: "ghost",
    name: "月白幽灵",
    subtitle: "雾化残影",
    preview: ghostPreview,
    body: "#edf6ff",
    bodyAlt: "#9bd8ff",
    head: "#ffffff",
    glow: "#dffcff",
    eye: "#53f3ff",
    pattern: "mist",
  },
];

export function getSnakeSkinById(id) {
  return SNAKE_SKINS.find((skin) => skin.id === id) || SNAKE_SKINS[0];
}
