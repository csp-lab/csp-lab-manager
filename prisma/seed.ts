import { prisma } from "../lib/prisma";
import { provisionUser } from "../lib/provision";

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "superadmin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (password.length < 8) {
    throw new Error("Set SEED_ADMIN_PASSWORD to at least 8 characters.");
  }
  const supers = await prisma.user.count({ where: { role: "SUPERADMIN" } });
  if (supers > 0) {
    console.log("A superadmin already exists.");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (existing) {
    console.log(`Username ${username.toLowerCase()} already exists.`);
    return;
  }
  await provisionUser({
    firstName: "Super",
    lastName: "Admin",
    username,
    password,
    role: "SUPERADMIN",
  });
  console.log(`Created superadmin ${username.toLowerCase()}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
