import { prisma } from '../../../lib/prisma';

export const StorageService = {
  getUserStorage: async (userId: string) => {
    const usage = await prisma.storageUsage.findUnique({ where: { userId } });

    // Get active subscription details
    const activeSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        is_active: true,
        OR: [{ ended_at: null }, { ended_at: { gt: new Date() } }],
      },
      include: {
        package: true,
      },
    });

    // determine used storage (from StorageUsage) and package limits (from SubscriptionPackage)
    const usedStorageBytes: bigint = usage ? usage.total_storage_bytes : BigInt(0);
    const usedStorageMbNumber = Number(usedStorageBytes) / (1024 * 1024);

    let subscription = null as null | {
      packageId: string;
      packageName: string;
      max_storage_bytes: bigint | null;
      used_storage_bytes: bigint;
      remaining_storage_bytes: bigint | null;
      max_storage_mb?: number | null;
      used_storage_mb?: number;
      remaining_storage_mb?: number | null;
      used_percentage?: number | null;
    };

    if (activeSubscription && activeSubscription.package) {
      const pkg = activeSubscription.package;

      const maxStorageBytes: bigint | null =
        pkg.max_storage_mb != null ? BigInt(pkg.max_storage_mb) * BigInt(1024 * 1024) : null;

      const maxStorageMb: number | null = pkg.max_storage_mb != null ? pkg.max_storage_mb : null;

      let remainingMb: number | null = null;
      if (maxStorageMb != null) {
        remainingMb = maxStorageMb - usedStorageMbNumber;
        if (remainingMb < 0) remainingMb = 0;
      }

      const usedPercentage: number | null =
        maxStorageMb != null
          ? Number(((usedStorageMbNumber / maxStorageMb) * 100).toFixed(2))
          : null;

      subscription = {
        packageId: pkg.id,
        packageName: pkg.name,
        max_storage_bytes: maxStorageBytes,
        used_storage_bytes: usedStorageBytes,
        remaining_storage_bytes:
          maxStorageBytes != null
            ? (BigInt(Math.round((remainingMb ?? 0) * 1024 * 1024)) as bigint)
            : null,
        max_storage_mb: maxStorageMb,
        used_storage_mb: Number(usedStorageMbNumber.toFixed(2)),
        remaining_storage_mb: remainingMb != null ? Number(remainingMb.toFixed(2)) : null,
        used_percentage: usedPercentage,
      };
    }

    if (!usage) {
      return {
        userId,
        total_storage_mb: 0,
        total_files: 0,
        total_folders: 0,
        subscription,
      };
    }

    return {
      userId: usage.userId,
      total_storage_mb: Number((Number(usage.total_storage_bytes) / (1024 * 1024)).toFixed(2)),
      total_files: usage.total_files,
      total_folders: usage.total_folders,
      subscription,
    };
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
