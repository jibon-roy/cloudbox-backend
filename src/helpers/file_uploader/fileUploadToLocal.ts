import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileFilter } from './fileFilter';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads');
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (err) {
      // ignore mkdir errors
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter for validation
export const upload = multer({ storage: storage, fileFilter: fileFilter });

// ! Example usages:
// const uploadSingle = upload.single("carImage");

// const uploadMultiple = upload.fields([
//   { name: "singleImage", maxCount: 10 },
//   { name: "galleryImage", maxCount: 10 },
// ]);
