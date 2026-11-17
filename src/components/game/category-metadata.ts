import type { Icon } from "./game-icon";

export const categoryMeta: Record<
  string,
  { hint: string; icon: Parameters<typeof Icon>[0]["name"] }
> = {
  "Conhecimentos gerais": { hint: "De tudo um pouco", icon: "bulb" },
  "Filmes e séries": { hint: "Telonas e maratonas", icon: "clapper" },
  Música: { hint: "Ritmos, bandas e hits", icon: "music" },
  Esportes: { hint: "Recordes e campeões", icon: "ball" },
  Geografia: { hint: "Mapas e lugares", icon: "globe" },
  História: { hint: "Fatias do tempo", icon: "column" },
  "Ciência e tecnologia": { hint: "Descobertas e futuro", icon: "atom" },
  "Cultura pop": { hint: "Games, heróis e redes", icon: "gamepad" },
};
