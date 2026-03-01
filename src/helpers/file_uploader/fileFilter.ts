import { prisma } from "../../lib/prisma";

export const fileFilter = (req: any, file: any, cb: any) => {
  const globalAllowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/webp",
    "audio/mpeg",
    "video/mp4",
    "video/quicktime", // Support for MOV files
    // xlsx and csv
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.ms-excel",
  ];

  // If authenticated user exists, try to validate against their package allowed types
  const user = req && req.user;
  if (user && user.id) {
    prisma.userSubscription
      .findFirst({ where: { userId: user.id, is_active: true } })
      .then((active) => {
        if (!active) return null;
        return prisma.packageAllowedFileType.findMany({
          where: { subscriptionPackageId: active.packageId },
        });
      })
      .then((allowedRows: any[] | null) => {
        if (allowedRows && allowedRows.length > 0) {
          const ok = allowedRows.some((r) => r.mime_type === file.mimetype);
          if (ok) return cb(null, true);
          return cb(
            new Error("Invalid file type for your subscription"),
            false,
          );
        }

        // No package-level restrictions found; fall back to global list
        if (globalAllowedMimeTypes.includes(file.mimetype)) cb(null, true);
        else
          cb(
            new Error(
              `Invalid file type. Only ${globalAllowedMimeTypes.join(
                ", ",
              )} are allowed`,
            ),
            false,
          );
      })
      .catch(() => {
        // On errors while checking subscription, fall back to global policy
        if (globalAllowedMimeTypes.includes(file.mimetype)) cb(null, true);
        else
          cb(
            new Error(
              `Invalid file type. Only ${globalAllowedMimeTypes.join(
                ", ",
              )} are allowed`,
            ),
            false,
          );
      });

    return;
  }

  // No authenticated user — enforce global allowed list
  if (globalAllowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only ${globalAllowedMimeTypes.join(", ")} are allowed`,
      ),
      false,
    );
  }
};
