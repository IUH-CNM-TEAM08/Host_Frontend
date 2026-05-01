import { ImageSourcePropType } from "react-native";

export const STICKER_PACKS = {
  pets: {
    adopt: require("@/resources/assets/stickers/pets/adopt.png"),
    bath: require("@/resources/assets/stickers/pets/bath.png"),
    cat: require("@/resources/assets/stickers/pets/cat.png"),
    dog: require("@/resources/assets/stickers/pets/dog.png"),
    pet_food: require("@/resources/assets/stickers/pets/pet_food.png"),
    good_morning: require("@/resources/assets/stickers/pets/good_morning.png"),
    have_a_nice_day: require("@/resources/assets/stickers/pets/have_a_nice_day.png"),
  },
  christmas: {
    bear: require("@/resources/assets/stickers/christmas/bear.png"),
    fox: require("@/resources/assets/stickers/christmas/fox.png"),
    pig: require("@/resources/assets/stickers/christmas/pig.png"),
    reindeer: require("@/resources/assets/stickers/christmas/reindeer.png"),
    santa_claus: require("@/resources/assets/stickers/christmas/santa-claus.png"),
  },
  home: {
    coffee_mug: require("@/resources/assets/stickers/home/coffee-mug.png"),
    reading_book: require("@/resources/assets/stickers/home/reading-book.png"),
    reading: require("@/resources/assets/stickers/home/reading.png"),
    stay_home: require("@/resources/assets/stickers/home/stay-home.png"),
    stretching: require("@/resources/assets/stickers/home/stretching.png"),
  },
} as const;

const FLAT_STICKER_MAP: Record<string, ImageSourcePropType> = Object.values(
  STICKER_PACKS,
).reduce((acc, pack) => {
  Object.entries(pack).forEach(([key, source]) => {
    acc[key] = source;
  });
  return acc;
}, {} as Record<string, ImageSourcePropType>);

export function getStickerSourceByKey(
  key: string,
): ImageSourcePropType | undefined {
  return FLAT_STICKER_MAP[key];
}

export function extractStickerKeyFromMessage(content?: string): string | null {
  const normalized = String(content ?? "").trim();
  const match = normalized.match(/^\[sticker:([a-zA-Z0-9_-]+)\]$/);
  return match?.[1] ?? null;
}
