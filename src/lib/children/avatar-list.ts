import { Cat, Dog, Rabbit, Bird, Fish, Turtle, type LucideIcon } from "lucide-react";

export type AvatarId = "cat" | "dog" | "rabbit" | "bird" | "fish" | "turtle";

export const AVATARS: ReadonlyArray<{ id: AvatarId; icon: LucideIcon }> = [
  { id: "cat", icon: Cat },
  { id: "dog", icon: Dog },
  { id: "rabbit", icon: Rabbit },
  { id: "bird", icon: Bird },
  { id: "fish", icon: Fish },
  { id: "turtle", icon: Turtle },
];
