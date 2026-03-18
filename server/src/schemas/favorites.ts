import { z } from "zod";

export const addFavoriteSchema = z.object({
  name: z.string().min(1).max(200),
  admin1: z.string().max(200).optional(),
  country: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
