import { randomBytes, scrypt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// N/r/p/dkLen match @better-auth/utils password.node so sign-in can verify this hash.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, key) => {
        if (err) reject(err);
        else resolve(`${salt}:${key.toString("hex")}`);
      },
    );
  });
}

const prisma = new PrismaClient();

try {
  const username = (process.env.SEED_ADMIN_USERNAME || "superadmin").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const supers = await prisma.user.count({ where: { role: "SUPERADMIN" } });
  if (supers > 0) {
    console.log("A superadmin already exists.");
  } else {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.log(`Username ${username} already exists.`);
    } else {
      const passwordHash = await hashPassword(password);
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: "Super Admin",
            email: `${username}@users.csp.local`,
            emailVerified: true,
            firstName: "Super",
            lastName: "Admin",
            username,
            role: "SUPERADMIN",
          },
        });
        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      });
      console.log(`Created superadmin ${username}.`);
    }
  }
} finally {
  await prisma.$disconnect();
}
