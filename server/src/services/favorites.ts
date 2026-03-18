import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

const MAX_FAVORITES = 5;

export async function list(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function add(
  userId: string,
  data: { name: string; admin1?: string; country: string; latitude: number; longitude: number },
) {
  const count = await prisma.favorite.count({ where: { userId } });
  if (count >= MAX_FAVORITES) {
    throw new AppError(400, "LIMIT_REACHED", "Maximum of 5 favorites reached");
  }

  try {
    return await prisma.favorite.create({
      data: { userId, ...data },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Location already in favorites");
    }
    throw err;
  }
}

export async function remove(userId: string, favoriteId: string) {
  const favorite = await prisma.favorite.findFirst({
    where: { id: favoriteId, userId },
  });
  if (!favorite) {
    throw new AppError(404, "NOT_FOUND", "Favorite not found");
  }

  await prisma.favorite.delete({ where: { id: favoriteId } });
}
