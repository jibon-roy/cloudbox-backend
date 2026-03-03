import { Role } from '@prisma/client';

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export const initiateAdmin = async () => {
  const payload = {
    name: 'Super Admin',
    email: 'superadmin@gmail.com',
    password: '12345678',
    role: Role.ADMIN,
  };

  const existingAdmin = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingAdmin) {
    return;
  }

  await prisma.$transaction(async (TransactionClient) => {
    const hashedPassword: string = await bcrypt.hash(payload.password, 12);
    await TransactionClient.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        role: payload.role,
      },
    });
  });
};
