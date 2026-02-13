// backend/services/uploadService.js
/**
 * Service: Photo upload handling
 *
 * Exports:
 * - createUpload(data, verifiedAddress, signature): Promise<string>
 *   Signed body:
 *     {
 *       name: string,
 *       description: string,
 *       imageData: string,  // base64 encoded image
 *       nftId: string       // NFT to pay with
 *     }
 * - getUploadsForAddress(address: string)
 * - getPendingUploads()  // For admin
 *
 * Notes:
 * - Uploads reserve 1 part from uploader by setting `listing: uploadId`.
 * - On confirmation: transfer part to admin, create UPLOAD transaction, upload to Arweave/ArDrive
 * - Status: PENDING, CONFIRMED, CANCELED
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import { hashObject, hashableTransaction } from "../utils/hash.js";
import { getNextTransactionInfo, uploadTransactionToArweave, uploadImageToArweave } from "./arweaveService.js";
import { TX_TYPES } from "../utils/transactionTypes.js";
import { createTransactionDoc } from "../utils/transactionBuilder.js";
import { createPartialTransactionDoc } from "../utils/partialTransactionBuilder.js";
import { logInfo } from "../utils/logger.js";
import { UPLOAD_STATUS, PROFILE_STATUS } from "../utils/statusConstants.js";
import { getProfileStatus } from "./profileService.js";
import { sanitizeText, sanitizeDescription } from "../utils/sanitize.js";
import { processImage, verifyJpegMagicBytes } from "../utils/imageProcessing.js";

/**
 * Create a new upload request
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.description
 * @param {string} data.imageData  // base64 encoded
 * @param {string} data.nftId
 * @param {string} verifiedAddress - Address verified via signature
 * @param {string} signature - Signature from frontend
 * @returns {Promise<string>} uploadId
 */
export async function createUpload(data, verifiedAddress, signature) {
  const { name, description, imageData, nftId } = data;

  if (!name || !description || !imageData || !nftId) {
    throw new Error("Missing required upload fields");
  }
  
  // Validate image data format
  if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    throw new Error("Invalid image data format");
  }
  
  // Check if it's a JPG file by MIME type
  if (!imageData.startsWith('data:image/jpeg') && !imageData.startsWith('data:image/jpg')) {
    throw new Error("Only JPG files are allowed");
  }
  
  // Extract base64 data for magic bytes check
  const base64Match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }
  
  const base64Data = base64Match[1];
  
  // Verify it's a JPEG by magic bytes (security: prevents file extension spoofing)
  if (!verifyJpegMagicBytes(base64Data)) {
    throw new Error("File is not a valid JPEG image (magic bytes check failed)");
  }
  
  // Estimate base64 size (base64 is ~33% larger than binary)
  const estimatedSize = (base64Data.length * 3) / 4;
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (estimatedSize > maxSize) {
    throw new Error(`Image size exceeds 10MB limit (estimated: ${(estimatedSize / (1024 * 1024)).toFixed(2)}MB)`);
  }
  
  // Strip metadata from image (removes EXIF, IPTC, etc.)
  // This ensures no metadata ends up on Arweave or in the database
  let processedImageData;
  try {
    const originalSize = estimatedSize;
    processedImageData = await processImage(imageData, 10);
    
    // Calculate processed size
    const processedBase64Match = processedImageData.match(/^data:image\/[^;]+;base64,(.+)$/);
    const processedBase64Data = processedBase64Match ? processedBase64Match[1] : '';
    const processedSize = processedBase64Data ? (processedBase64Data.length * 3) / 4 : originalSize;
    
    logInfo(`[createUpload] Image metadata stripped. Original: ${(originalSize / (1024 * 1024)).toFixed(2)}MB, Processed: ${(processedSize / (1024 * 1024)).toFixed(2)}MB`);
  } catch (error) {
    logInfo(`[createUpload] Warning: Failed to strip metadata: ${error.message}. Using original image.`);
    // If metadata stripping fails, we can still proceed with the original
    // but log the warning - magic bytes check already passed above
    processedImageData = imageData;
  }
  
  // Address verification is handled by verifySignature middleware

  const db = await connectDB();
  const partsCol = db.collection("parts");
  const uploadsCol = db.collection("uploads");
  const nftsCol = db.collection("nfts");
  const profilesCol = db.collection("profiles");

  // Check if user has started verification
  const profile = await profilesCol.findOne({
    address: verifiedAddress.toLowerCase(),
  });
  
  if (!profile || !profile.status || profile.status === PROFILE_STATUS.NONE) {
    throw new Error("You must start verification and enter profile information before uploading");
  }

  // Verify NFT exists and user owns available parts
  const nft = await nftsCol.findOne({ _id: nftId });
  if (!nft) {
    throw new Error("NFT not found");
  }

  // Check available parts for this NFT
  const availableParts = await partsCol.countDocuments({
    owner: verifiedAddress.toLowerCase(),
    parent_hash: String(nftId),
    listing: null,
    reservation: { $exists: false }
  });

  if (availableParts < 1) {
    throw new Error("You don't have any available parts from this NFT to use for payment");
  }

  const uploadId = new ObjectId();
  
  // Get admin address (confirmer) - will be set when admin confirms
  // For now, we'll use a placeholder or get from env
  const adminAddress = process.env.SUPERADMIN_ADDRESS || null;

  const uploadDoc = {
    _id: uploadId,
    name: sanitizeText(String(name), 200),
    description: sanitizeDescription(String(description), 1000),
    imageData: String(processedImageData), // base64 encoded image (metadata stripped)
    uploader: String(verifiedAddress).toLowerCase(),
    confirmer: adminAddress ? String(adminAddress).toLowerCase() : null,
    nftId: String(nftId),
    price: 1, // Always 1 part for upload payment (like gift)
    quantity: 1, // Always 1 part
    status: UPLOAD_STATUS.PENDING,
    time_created: new Date(),
    time_updated: new Date(),
  };

  await uploadsCol.insertOne(uploadDoc);
  logInfo(`[createUpload] Created upload: ${uploadId.toString()}`);

  // Reserve 1 part from the selected NFT (similar to gift)
  const freeParts = await partsCol
    .find({
      owner: verifiedAddress.toLowerCase(),
      parent_hash: String(nftId),
      listing: null,
      reservation: { $exists: false }
    })
    .limit(1)
    .project({ _id: 1 })
    .toArray();

  if (freeParts.length < 1) {
    throw new Error("Could not find available part to reserve for payment");
  }

  const partId = freeParts[0]._id;
  await partsCol.updateOne(
    { _id: partId },
    { $set: { listing: uploadId.toString() } }
  );
  
  logInfo(`[createUpload] Reserved part ${partId} for upload ${uploadId.toString()}`);

  return uploadId.toString();
}

/**
 * Get active uploads (PENDING) for an address
 * @param {string} address - Uploader's address
 * @param {number} skip - Number of uploads to skip
 * @param {number} limit - Maximum number of uploads to return
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getActiveUploadsForAddress(address, skip = 0, limit = 20) {
  const db = await connectDB();
  const addressLower = String(address).toLowerCase();
  const uploadsCol = db.collection("uploads");
  
  const query = {
    uploader: addressLower,
    status: UPLOAD_STATUS.PENDING
  };
  
  const [uploads, total] = await Promise.all([
    uploadsCol
      .find(query)
      .sort({ time_created: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    uploadsCol.countDocuments(query)
  ]);
  
  logInfo(`[getActiveUploadsForAddress] Found ${uploads.length} active uploads for ${addressLower}`);
  return { items: uploads, total };
}

/**
 * Get confirmed uploads (gallery) for an address
 * @param {string} address - Uploader's address
 * @param {number} skip - Number of uploads to skip
 * @param {number} limit - Maximum number of uploads to return
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getConfirmedUploadsForAddress(address, skip = 0, limit = 50) {
  const db = await connectDB();
  const addressLower = String(address).toLowerCase();
  const uploadsCol = db.collection("uploads");
  
  const query = {
    uploader: addressLower,
    status: UPLOAD_STATUS.CONFIRMED
  };
  
  const [uploads, total] = await Promise.all([
    uploadsCol
      .find(query)
      .sort({ time_created: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    uploadsCol.countDocuments(query)
  ]);
  
  logInfo(`[getConfirmedUploadsForAddress] Found ${uploads.length} confirmed uploads for ${addressLower}`);
  return { items: uploads, total };
}

/**
 * Get completed uploads (CONFIRMED or CANCELED) for an address
 * @param {string} address - Uploader's address
 * @param {number} skip - Number of uploads to skip
 * @param {number} limit - Maximum number of uploads to return
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getCompletedUploadsForAddress(address, skip = 0, limit = 20) {
  const db = await connectDB();
  const addressLower = String(address).toLowerCase();
  const uploadsCol = db.collection("uploads");
  const txCol = db.collection("transactions");
  
  const query = {
    uploader: addressLower,
    status: { $in: [UPLOAD_STATUS.CONFIRMED, UPLOAD_STATUS.CANCELED, UPLOAD_STATUS.REFUSED] }
  };
  
  const [uploads, total] = await Promise.all([
    uploadsCol
      .find(query)
      .sort({ time_created: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    uploadsCol.countDocuments(query)
  ]);
  
  // Attach transaction info for CONFIRMED uploads
  const uploadsWithTx = await Promise.all(
    uploads.map(async (upload) => {
      let tx = null;
      if (upload.status === UPLOAD_STATUS.CONFIRMED) {
        tx = await txCol.findOne({
          type: TX_TYPES.UPLOAD,
          uploadId: upload._id.toString(),
        });
      }
      return {
        ...upload,
        transaction: tx ? { _id: tx._id, arweaveTxId: tx.arweaveTxId } : null,
      };
    })
  );
  
  logInfo(`[getCompletedUploadsForAddress] Found ${uploads.length} completed uploads for ${addressLower}`);
  return { items: uploadsWithTx, total };
}

/**
 * Get upload details by ID (for image detail page)
 * @param {string} uploadId - Upload ID
 * @returns {Promise<object|null>} Upload with transaction info and uploader profile
 */
export async function getUploadById(uploadId) {
  const db = await connectDB();
  const uploadsCol = db.collection("uploads");
  const txCol = db.collection("transactions");
  const profilesCol = db.collection("profiles");
  
  const upload = await uploadsCol.findOne({ _id: new ObjectId(uploadId) });
  if (!upload) {
    return null;
  }
  
  // Get UPLOAD transaction for this upload
  let transaction = null;
  if (upload.status === UPLOAD_STATUS.CONFIRMED) {
    transaction = await txCol.findOne({
      type: TX_TYPES.UPLOAD,
      uploadId: uploadId.toString(),
    });
  }
  
  // Get uploader's profile (for username and address)
  let uploaderProfile = null;
  if (upload.uploader) {
    uploaderProfile = await profilesCol.findOne({
      address: upload.uploader.toLowerCase(),
      status: UPLOAD_STATUS.CONFIRMED, // Only return if profile is confirmed
    });
  }
  
  // Extract Arweave transaction ID from imageUrl if present
  // imageUrl format: https://arweave.net/{txId}
  let imageArweaveTxId = null;
  if (upload.imageUrl) {
    // Match the transaction ID from the URL
    const match = upload.imageUrl.match(/arweave\.net\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      imageArweaveTxId = match[1];
    }
  }
  
  return {
    ...upload,
    transaction: transaction ? {
      _id: transaction._id,
      arweaveTxId: transaction.arweaveTxId,
    } : null,
    imageArweaveTxId: imageArweaveTxId,
    uploaderProfile: uploaderProfile ? {
      username: uploaderProfile.username,
      address: uploaderProfile.address, // ETH address
    } : null,
  };
}

/**
 * Get uploads for an address (legacy - kept for backward compatibility)
 * @param {string} address - Uploader's address
 * @returns {Promise<Array>}
 */
export async function getUploadsForAddress(address) {
  const db = await connectDB();
  const addressLower = String(address).toLowerCase();
  logInfo(`[getUploadsForAddress] Fetching uploads for address: ${addressLower}`);
  const uploads = await db.collection("uploads")
    .find({ uploader: addressLower })
    .sort({ time_created: -1 })
    .toArray();
  logInfo(`[getUploadsForAddress] Found ${uploads.length} uploads for ${addressLower}`);
  return uploads;
}

/**
 * Get pending uploads (for admin)
 * @returns {Promise<Array>}
 */
export async function getPendingUploads() {
  const db = await connectDB();
  return db.collection("uploads")
    .find({ status: UPLOAD_STATUS.PENDING })
    .sort({ time_created: -1 })
    .toArray();
}

/**
 * Cancel/delete an upload
 * @param {string} uploadId - Upload ID
 * @param {string} verifiedAddress - Address verified via signature
 * @returns {Promise<void>}
 */
export async function cancelUpload(uploadId, verifiedAddress) {
  const db = await connectDB();
  const uploadsCol = db.collection("uploads");
  const partsCol = db.collection("parts");

  const upload = await uploadsCol.findOne({ _id: new ObjectId(uploadId) });
  if (!upload) {
    throw new Error("Upload not found");
  }

  if (upload.uploader.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new Error("You can only cancel your own uploads");
  }

  if (upload.status !== UPLOAD_STATUS.PENDING) {
    throw new Error("Can only cancel pending uploads");
  }

  // Update upload status
  await uploadsCol.updateOne(
    { _id: upload._id },
    { 
      $set: { 
        status: UPLOAD_STATUS.CANCELED,
        time_updated: new Date()
      } 
    }
  );

  // Release reserved part
  await partsCol.updateMany(
    { listing: uploadId },
    { 
      $set: { listing: null },
      $unset: { reservation: "" }
    }
  );

  logInfo(`[cancelUpload] Canceled upload ${uploadId} and released reserved part`);
}

/**
 * Accept an upload (admin only)
 * - Uploads image to ArDrive/Arweave
 * - Transfers reserved part to admin
 * - Creates UPLOAD transaction
 * - Updates upload status to CONFIRMED
 * - If first upload, marks profile as CONFIRMED
 * 
 * @param {string} uploadId - Upload ID
 * @param {string} verifiedAddress - Admin address verified via signature
 * @param {string} signature - Signature from frontend
 * @returns {Promise<string>} Transaction ID
 */
export async function acceptUpload(uploadId, verifiedAddress, signature) {
  const db = await connectDB();
  const uploadsCol = db.collection("uploads");
  const partsCol = db.collection("parts");
  const profilesCol = db.collection("profiles");
  const txCollection = db.collection("transactions");
  const ptxCollection = db.collection("partialtransactions");
  const nftsCol = db.collection("nfts");
  
  // Verify superadmin (only superadmin can accept uploads)
  const superAdminAddress = process.env.SUPERADMIN_ADDRESS;
  if (!superAdminAddress || verifiedAddress.toLowerCase() !== superAdminAddress.toLowerCase()) {
    throw new Error("Only superadmin can accept uploads");
  }
  
  // Get upload
  const upload = await uploadsCol.findOne({ _id: new ObjectId(uploadId) });
  if (!upload) {
    throw new Error("Upload not found");
  }
  
  if (upload.status !== UPLOAD_STATUS.PENDING) {
    throw new Error("Can only accept pending uploads");
  }
  
  // Get uploader's profile
  const profile = await profilesCol.findOne({
    address: upload.uploader.toLowerCase(),
  });
  
  if (!profile) {
    throw new Error("Uploader profile not found");
  }
  
  // Check if this is the first upload (user is unconfirmed)
  const isFirstUpload = profile.status === PROFILE_STATUS.UNCONFIRMED;
  
  // Convert base64 image to buffer
  // Note: imageData should already be metadata-stripped from createUpload
  // but we verify magic bytes again for security
  let imageBuffer;
  let contentType = "image/jpeg"; // default
  try {
    // Remove data URL prefix if present
    let base64Data = upload.imageData;
    if (base64Data.includes(",")) {
      const parts = base64Data.split(",");
      const mimeMatch = parts[0].match(/data:([^;]+)/);
      if (mimeMatch) {
        contentType = mimeMatch[1];
      }
      base64Data = parts[1];
    }
    
    // Verify magic bytes (security check - prevents spoofed files)
    if (!verifyJpegMagicBytes(base64Data)) {
      throw new Error("Image data failed magic bytes verification - not a valid JPEG");
    }
    
    imageBuffer = Buffer.from(base64Data, "base64");
  } catch (e) {
    throw new Error(`Failed to decode image: ${e.message}`);
  }
  
  // Upload image to Arweave/ArDrive
  let imageUrl;
  try {
    imageUrl = await uploadImageToArweave(imageBuffer, contentType, upload.name);
    logInfo(`[acceptUpload] Image uploaded to Arweave: ${imageUrl}`);
  } catch (error) {
    logInfo(`[acceptUpload] Failed to upload image: ${error.message}`);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get reserved part
  const reservedPart = await partsCol.findOne({
    listing: uploadId.toString(),
  });
  
  if (!reservedPart) {
    throw new Error("Reserved part not found");
  }
  
  // Transfer part to admin
  await partsCol.updateOne(
    { _id: reservedPart._id },
    {
      $set: {
        owner: superAdminAddress.toLowerCase(),
        listing: null,
      },
      $unset: { reservation: "" },
    }
  );
  
  logInfo(`[acceptUpload] Transferred part ${reservedPart._id} to admin`);
  
  // Get NFT for transaction
  const nft = await nftsCol.findOne({ _id: upload.nftId });
  if (!nft) {
    throw new Error("NFT not found");
  }
  
  // Get next transaction number and previous Arweave transaction ID
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
  
  // Build UPLOAD transaction doc
  const txDoc = createTransactionDoc({
    type: TX_TYPES.UPLOAD,
    transaction_number: transactionNumber,
    signer: verifiedAddress,
    signature: signature,
    overrides: {
      uploadId: uploadId.toString(),
      nftId: String(upload.nftId),
      quantity: 1,
      // Upload-specific fields (normalize empty strings to null)
      uploadedimageurl: imageUrl,
      uploadedimagedescription: sanitizeDescription(upload.description, 1000),
      uploadedimagename: sanitizeText(upload.name, 200),
      // Verification fields (if first upload)
      isVerificationConfirmation: isFirstUpload ? true : null,
      verifiedUserUsername: isFirstUpload ? profile.username : null,
      verifiedUserBio: isFirstUpload ? profile.biography : null,
      verifiedUserEmail: isFirstUpload ? profile.email : null,
      verifiedUserFullName: isFirstUpload ? profile.fullName : null,
      verifiedUserCountry: isFirstUpload ? profile.country : null,
      verifiedUserCity: isFirstUpload ? profile.city : null,
      verifiedUserPhysicalAddress: isFirstUpload ? profile.physicalAddress : null,
    },
  });
  
  // Generate hash-based ID
  const insertedTxId = hashObject(hashableTransaction(txDoc));
  txDoc._id = insertedTxId;
  
  // Insert transaction to database
  await txCollection.insertOne(txDoc);
  logInfo(`[acceptUpload] Created UPLOAD transaction: ${insertedTxId}`);
  
  // Upload transaction to Arweave
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(txDoc, transactionNumber, previousArweaveTxId, nft.imageurl);
    
    // Update transaction with Arweave ID
    await txCollection.updateOne(
      { _id: insertedTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    
    logInfo(`[acceptUpload] UPLOAD transaction uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[acceptUpload] Warning: Failed to upload transaction to Arweave: ${error.message}`);
    // Continue even if Arweave upload fails - transaction is still valid
  }
  
  // Create partial transaction for the part transfer (from uploader to admin)
  const partial = createPartialTransactionDoc({
    part: reservedPart._id,
    transaction: insertedTxId,
    from: upload.uploader,
    to: superAdminAddress,
    nftId: upload.nftId,
    chainTx: null,
    currency: null,
    amount: null,
    timestamp: new Date(),
  });
  await ptxCollection.insertOne(partial);
  logInfo(`[acceptUpload] Created partial transaction for part ${reservedPart._id}`);
  
  // Update upload status
  await uploadsCol.updateOne(
    { _id: upload._id },
    {
      $set: {
        status: UPLOAD_STATUS.CONFIRMED,
        time_updated: new Date(),
        imageUrl: imageUrl, // Store the Arweave URL
      },
    }
  );
  
  // If first upload, mark profile as CONFIRMED
  if (isFirstUpload) {
    await profilesCol.updateOne(
      { address: upload.uploader.toLowerCase() },
      {
        $set: {
          status: UPLOAD_STATUS.CONFIRMED,
          time_updated: new Date(),
        },
      }
    );
    logInfo(`[acceptUpload] Marked profile as CONFIRMED for ${upload.uploader}`);
  }
  
  logInfo(`[acceptUpload] Upload ${uploadId} accepted successfully`);
  return insertedTxId;
}

/**
 * Refuse an upload (admin only)
 * - Releases reserved part back to uploader
 * - Updates upload status to REFUSED
 * 
 * @param {string} uploadId - Upload ID
 * @param {string} verifiedAddress - Admin address verified via signature
 * @returns {Promise<void>}
 */
export async function refuseUpload(uploadId, verifiedAddress) {
  const db = await connectDB();
  const uploadsCol = db.collection("uploads");
  const partsCol = db.collection("parts");
  
  // Verify superadmin (only superadmin can refuse uploads)
  const superAdminAddress = process.env.SUPERADMIN_ADDRESS;
  if (!superAdminAddress || verifiedAddress.toLowerCase() !== superAdminAddress.toLowerCase()) {
    throw new Error("Only superadmin can refuse uploads");
  }
  
  // Get upload
  const upload = await uploadsCol.findOne({ _id: new ObjectId(uploadId) });
  if (!upload) {
    throw new Error("Upload not found");
  }
  
  if (upload.status !== UPLOAD_STATUS.PENDING) {
    throw new Error("Can only refuse pending uploads");
  }
  
  // Release reserved part back to uploader
  await partsCol.updateMany(
    { listing: uploadId.toString() },
    {
      $set: {
        listing: null,
      },
      $unset: { reservation: "" },
    }
  );
  
  // Update upload status
  await uploadsCol.updateOne(
    { _id: upload._id },
    {
      $set: {
        status: UPLOAD_STATUS.REFUSED,
        time_updated: new Date(),
      },
    }
  );
  
  logInfo(`[refuseUpload] Upload ${uploadId} refused and part released`);
}

