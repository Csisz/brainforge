/**
 * A rendered landing-gallery item. Kept out of the "use server" actions file so
 * that module exports only async functions; imported by both the gallery actions
 * and the marketing gallery component.
 */
export type GalleryItem = { generatorId: string; seed: string; svg: string };
