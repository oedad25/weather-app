import { z } from "zod";

export const searchSchema = z.object({
  city: z.string().min(1).max(100),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

export const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

export const historySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
