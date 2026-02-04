import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import crypto from "crypto";

/* ==================== CONFIG ==================== */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ==================== UTILITY ==================== */
const generateHexId = () => crypto.randomBytes(12).toString("hex");

// Determine resource type based on file extension
const getResourceType = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    // PDFs can use 'image' type for inline viewing, or keep as 'raw' with special URL handling
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf'];
    return imageTypes.includes(ext) ? "image" : "raw";
};

// Check if file is PDF
const isPDF = (fileName) => {
    return fileName.toLowerCase().endsWith('.pdf');
};

/* ==================== UPLOAD FILE ==================== */
export const uploadFile = async (fileBuffer, originalName, folder = "documents") => {
    return new Promise((resolve, reject) => {
        try {
            const publicId = `${folder}/${generateHexId()}`;
            const resourceType = getResourceType(originalName);

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    public_id: publicId,
                    resource_type: resourceType,
                    overwrite: true,
                    // For PDFs, this allows inline display
                    flags: isPDF(originalName) ? "attachment:false" : undefined,
                },
                (error, result) => {
                    if (error) return reject(error);

                    // Generate proper URL based on file type
                    let url = result.secure_url;

                    // For raw files (non-PDF docs), we need to modify URL to force inline
                    if (resourceType === "raw" && !isPDF(originalName)) {
                        // Raw files often need explicit inline handling
                        url = cloudinary.url(result.public_id, {
                            resource_type: "raw",
                            secure: true,
                            flags: "attachment:false"
                        });
                    }

                    resolve({
                        url: url,
                        publicId: result.public_id,
                        folder: result.folder,
                        originalName: originalName,
                        resourceType: resourceType
                    });
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(uploadStream);
        } catch (err) {
            reject(err);
        }
    });
};

/* ==================== DELETE FILE ==================== */
export const deleteFile = async (publicId, resourceType = "raw") => {
    if (!publicId) throw new Error("publicId required for deletion.");
    try {
        // Try both image and raw if type unknown
        let result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

        // If not found, try other resource type
        if (result.result === "not found" && resourceType === "raw") {
            result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        } else if (result.result === "not found" && resourceType === "image") {
            result = await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
        }

        if (result.result !== "ok") throw new Error(`Deletion failed: ${result.result}`);
        return result;
    } catch (err) {
        console.error("Cloudinary delete failed:", err);
        throw new Error("File deletion failed.");
    }
};

/* ==================== RENAME FILE ==================== */
export const renameFile = async (publicId, newName, folder = null, resourceType = "auto") => {
    if (!publicId || !newName) throw new Error("publicId and newName required for renaming.");

    try {
        const newPublicId = folder
            ? `${folder}/${generateHexId()}`
            : `${publicId.split("/")[0]}/${generateHexId()}`;

        // Auto-detect resource type from publicId if not provided
        const actualResourceType = resourceType === "auto"
            ? (publicId.includes('/raw/') ? "raw" : "image")
            : resourceType;

        const result = await cloudinary.uploader.rename(publicId, newPublicId, {
            resource_type: actualResourceType,
            overwrite: true,
        });

        // Generate URL with proper resource type
        const url = cloudinary.url(result.public_id, {
            resource_type: actualResourceType,
            secure: true,
            flags: "attachment:false" // Force inline viewing
        });

        return {
            url,
            publicId: result.public_id,
            folder: result.folder,
            originalName: newName,
            resourceType: actualResourceType
        };
    } catch (err) {
        console.error("Cloudinary rename failed:", err);
        throw new Error("File rename failed.");
    }
};

/* ==================== GET INLINE URL ==================== */
// Utility to convert any Cloudinary URL to inline-viewable URL
export const getInlineUrl = (publicId, resourceType = "raw") => {
    return cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        flags: "attachment:false"
    });
};