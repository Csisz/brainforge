import { Cat, Dog, Rabbit, Bird, Fish, Turtle, PawPrint, type LucideIcon } from "lucide-react";

export type AvatarId = "cat" | "dog" | "rabbit" | "bird" | "fish" | "turtle";

export const AVATARS: ReadonlyArray<{ id: AvatarId; icon: LucideIcon }> = [
  { id: "cat", icon: Cat },
  { id: "dog", icon: Dog },
  { id: "rabbit", icon: Rabbit },
  { id: "bird", icon: Bird },
  { id: "fish", icon: Fish },
  { id: "turtle", icon: Turtle },
];

/** Falls back to a generic paw print for any legacy/unknown avatar value stored in the DB. */
export function getAvatarIcon(id: string): LucideIcon {
  return AVATARS.find((a) => a.id === id)?.icon ?? PawPrint;
}
