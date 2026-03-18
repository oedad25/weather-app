import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";

export async function createTestUser(
  email = "test@example.com",
  password = "testpassword123",
) {
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.user.create({
    data: { email, passwordHash },
  });
}
