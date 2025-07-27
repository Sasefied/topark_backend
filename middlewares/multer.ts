import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // This storage needs uploads folder in the root directory
    // Else it will throw an error saying cannot find path uploads
    cb(null, "./uploads");
  },
  // Store file in a .png/.jpeg/.jpg format instead of binary
  filename: function (req, file, cb) {
    let fileExtension = "";
    if (file.originalname.split(".").length > 1) {
      fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf(".")
      );
    }
    const filenameWithoutExtension = file.originalname
      .toLowerCase()
      .split(" ")
      .join("-")
      ?.split(".")[0];
    cb(
      null,
      filenameWithoutExtension +
        Date.now() +
        Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
        fileExtension
    );
  },
});

// Middleware responsible to read form data and upload the File object to the mentioned path
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1000 * 1000, // 5MB
  },
});

export default upload;
