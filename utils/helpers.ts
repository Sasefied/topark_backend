import { Request } from "express";
import fs from "fs";

/**
 * Returns the URL of a static file, given the request and the file name
 * @param {Request} req The request
 * @param {string} fileName The name of the file
 * @returns {string} The URL of the static file
 */
const getStaticFilePath = (req: Request, fileName: string): string => {
  return `${req.protocol}://${req.get("host")}/${fileName}`;
};

/**
 * Returns the local path of a static file, given the file name
 * @param {string} fileName The name of the file
 * @returns {string} The local path of the static file
 */
const getLocalPath = (fileName: string): string => {
  return `uploads/${fileName}`;
};

/**
 * Removes a file from the local filesystem.
 * @param {string} localPath The path to the file to be removed
 * @returns {void}
 */
const removeLocalFile = (localPath: string): void => {
  fs.unlink(localPath, (err) => {
    if (err) {
      console.error(`Error removing file ${localPath}:`, err);
    } else {
      console.log(`File ${localPath} removed successfully.`);
    }
  });
};

/**
 * Removes unused multer image files from the local filesystem, after an error has occurred.
 * This is called in the catch block of the controller, to clean up any files that were
 * uploaded but not used.
 * @param {Request} req The request
 * @returns {void}
 */
const removeUnusedMulterImageFilesOnError = (req: Request): void => {
  try {
    const multerFile = req.file;
    const multerFiles = req.files;

    if (multerFile) {
      removeLocalFile(multerFile.path);
    }

    if (multerFiles) {
      const filesValueArray: Express.Multer.File[][] =
        Object.values(multerFiles);
      filesValueArray.map((fileFields) => {
        fileFields.map((fileObject) => {
          removeLocalFile(fileObject.path);
        });
      });
    }
  } catch (error) {
    console.error("Error removing unused multer image files:", error);
  }
};

export {
  getStaticFilePath,
  getLocalPath,
  removeLocalFile,
  removeUnusedMulterImageFilesOnError,
};