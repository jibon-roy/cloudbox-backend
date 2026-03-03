import { prisma } from '../../lib/prisma';

// Map standard MIME types to FileMime enum values
const mimeTypeMap: Record<string, string> = {
  'image/jpeg': 'IMAGE_JPEG',
  'image/png': 'IMAGE_PNG',
  'image/gif': 'IMAGE_GIF',
  'image/bmp': 'IMAGE_BMP',
  'image/tiff': 'IMAGE_TIFF',
  'image/webp': 'IMAGE_WEBP',
  'image/svg+xml': 'IMAGE_SVG',
  'audio/mpeg': 'AUDIO_MPEG',
  'audio/wav': 'AUDIO_WAV',
  'audio/ogg': 'AUDIO_OGG',
  'video/mp4': 'VIDEO_MP4',
  'video/quicktime': 'VIDEO_QUICKTIME',
  'video/webm': 'VIDEO_WEBM',
  'video/x-msvideo': 'VIDEO_X_MSVIDEO',
  'application/pdf': 'APPLICATION_PDF',
  'application/zip': 'APPLICATION_ZIP',
  'application/x-7z-compressed': 'APPLICATION_7Z',
  'application/x-rar-compressed': 'APPLICATION_RAR',
  'application/msword': 'APPLICATION_DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'APPLICATION_DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'APPLICATION_XLSX',
  'text/csv': 'TEXT_CSV',
  'application/vnd.ms-excel': 'APPLICATION_XLS',
};

const globalAllowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
  'audio/mpeg',
  'video/mp4',
  'video/quicktime',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-excel',
];

export const fileFilter = (req: any, file: any, cb: any) => {
  // If authenticated user exists, try to validate against their package allowed types
  const user = req && req.user;
  if (user && user.id) {
    (async () => {
      try {
        // Get the latest active subscription for the user
        const active = await prisma.userSubscription.findFirst({
          where: {
            userId: user.id,
            is_active: true,
            ended_at: null, // Ensure subscription hasn't ended
          },
          orderBy: { created_at: 'desc' }, // Get the latest subscription
          include: { package: true },
        });

        if (!active) {
          // No active subscription; fall back to global list
          if (globalAllowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
          }
          return cb(
            new Error(`Invalid file type. Only ${globalAllowedMimeTypes.join(', ')} are allowed`),
            false
          );
        }

        // Get allowed file types for this subscription package
        const allowedRows = await prisma.packageAllowedFileType.findMany({
          where: { subscriptionPackageId: active.packageId },
        });

        // If package has specific allowed types, enforce them
        if (allowedRows && allowedRows.length > 0) {
          const enumMimeType = mimeTypeMap[file.mimetype];
          const isAllowed = allowedRows.some((r) => r.mime_type === enumMimeType);
          if (isAllowed) {
            return cb(null, true);
          }
          return cb(new Error('Invalid file type for your subscription'), false);
        }

        // No package-level restrictions; fall back to global list
        if (globalAllowedMimeTypes.includes(file.mimetype)) {
          return cb(null, true);
        }
        return cb(
          new Error(`Invalid file type. Only ${globalAllowedMimeTypes.join(', ')} are allowed`),
          false
        );
      } catch (error) {
        console.error('File filter error:', error);
        // On errors while checking subscription, fall back to global policy
        if (globalAllowedMimeTypes.includes(file.mimetype)) {
          return cb(null, true);
        }
        return cb(
          new Error(`Invalid file type. Only ${globalAllowedMimeTypes.join(', ')} are allowed`),
          false
        );
      }
    })();

    return;
  }

  // No authenticated user — enforce global allowed list
  if (globalAllowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Only ${globalAllowedMimeTypes.join(', ')} are allowed`),
      false
    );
  }
};
