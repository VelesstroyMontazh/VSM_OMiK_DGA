import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: hash, displayName: 'Администратор', role: 'admin', workspace: 'default' },
  });
  const hash2 = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { username: 'user1' },
    update: {},
    create: { username: 'user1', passwordHash: hash2, displayName: 'Оператор ВСП', role: 'user', workspace: 'vsm' },
  });
  console.log('Seed done');
}
main().catch(console.error).finally(() => prisma.$disconnect());