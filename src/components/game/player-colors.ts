// Distinct shades derived from the Arriscai mint, lilac and gold palette.
export const playerColors = [
  "#79F5CB",
  "#A99CFC",
  "#FFCF65",
  "#35B994",
  "#8876D3",
  "#DE9D32",
  "#B3F8E2",
  "#CDC4FF",
  "#FFE5AD",
  "#56D4B6",
  "#9181E7",
  "#E9B84D",
  "#8BC6B1",
  "#B695D6",
];
export function playerColor(index: number) {
  return playerColors[index % playerColors.length];
}
