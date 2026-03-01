import { prisma } from "../../../lib/prisma";

export const StorageService = {
  getUserStorage: async (userId: string) => {
    const usage = await prisma.storageUsage.findUnique({ where: { userId } });
    if (!usage) {
      return {
        userId,
        total_storage_bytes: BigInt(0),
        total_files: 0,
        total_folders: 0,
      };
    }
    return usage;
  },

  getAllStorageAggregate: async () => {
    const sum = await prisma.storageUsage.aggregate({
      _sum: {
        total_storage_bytes: true,
        total_files: true,
        total_folders: true,
      },
    });
    const users = await prisma.storageUsage.count();
    return {
      users,
      total_storage_bytes: sum._sum.total_storage_bytes ?? BigInt(0),
      total_files: sum._sum.total_files ?? 0,
      total_folders: sum._sum.total_folders ?? 0,
    };
  },
};

export default StorageService;
