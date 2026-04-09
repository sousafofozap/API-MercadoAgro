import * as argon2 from 'argon2';
import { ListingStatus, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const PUBLIC_USER_ROLE = 'USER' as UserRole;

const passwordOptions: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

async function main() {
  const [adminPasswordHash, userPasswordHash] = await Promise.all([
    argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456', passwordOptions),
    argon2.hash(process.env.SEED_USER_PASSWORD ?? 'User@123456', passwordOptions),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mercadoagro.local' },
    update: {
      fullName: 'Administrador MercadoAgro',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: 'admin@mercadoagro.local',
      fullName: 'Administrador MercadoAgro',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@mercadoagro.local' },
    update: {
      fullName: 'Usuario Exemplo',
      role: PUBLIC_USER_ROLE,
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      phone: '+55 99 99999-9999',
    },
    create: {
      email: 'user@mercadoagro.local',
      fullName: 'Usuario Exemplo',
      role: PUBLIC_USER_ROLE,
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      phone: '+55 99 99999-9999',
    },
  });

  const existingListing = await prisma.listing.findFirst({
    where: { sellerId: user.id, title: 'Trator John Deere 5078E' },
  });

  if (!existingListing) {
    await prisma.listing.create({
      data: {
        title: 'Trator John Deere 5078E',
        description:
          'Trator revisado, pronto para uso, ideal para pequenas e medias propriedades.',
        category: 'maquinas',
        price: 185000,
        locationCity: 'Balsas',
        locationState: 'MA',
        imageUrl: 'https://images.example.com/john-deere-5078e.jpg',
        status: ListingStatus.PUBLISHED,
        sellerId: user.id,
      },
    });
  }

  console.log('Seed concluido com sucesso.');
  console.log(`Admin ID: ${admin.id}`);
  console.log(`User ID: ${user.id}`);
  console.log('Credenciais seed:');
  console.log('- admin@mercadoagro.local / valor de SEED_ADMIN_PASSWORD ou padrao local');
  console.log('- user@mercadoagro.local / valor de SEED_USER_PASSWORD ou padrao local');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
