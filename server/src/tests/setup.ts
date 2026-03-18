import { prisma } from "../lib/prisma.js";
import { beforeEach, afterAll } from "vitest";

beforeEach(async () => {
  await prisma.searchHistory.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.weatherCache.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
