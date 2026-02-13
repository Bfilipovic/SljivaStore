import connectDB from "../db.js";
import { sanitizeText, sanitizeDescription, sanitizeEmail, sanitizeUsername } from "../utils/sanitize.js";
import { ObjectId } from "mongodb";

/**
 * Get profile verification status for an address
 * @param {string} address - User's wallet address
 * @returns {Promise<{status: string, profile: object|null}>}
 */
export async function getProfileStatus(address) {
  const db = await connectDB();
  const profilesCol = db.collection("profiles");
  
  const profile = await profilesCol.findOne({
    address: String(address).toLowerCase(),
  });
  
  if (!profile) {
    return { status: "none", profile: null };
  }
  
  return {
    status: profile.status || "none",
    profile: profile,
  };
}

/**
 * Create or update profile verification request
 * @param {string} address - User's wallet address
 * @param {object} data - Profile data (username, biography, email, fullName, country, city, physicalAddress)
 * @returns {Promise<string>} Profile ID
 */
export async function createVerificationRequest(address, data) {
  const db = await connectDB();
  const profilesCol = db.collection("profiles");
  
  const addressLower = String(address).toLowerCase();
  const username = sanitizeUsername(data.username, 50);
  
  if (!username) {
    throw new Error("Invalid username");
  }
  
  // Check if profile already exists
  const existing = await profilesCol.findOne({
    address: addressLower,
  });
  
  if (existing && existing.status === "CONFIRMED") {
    throw new Error("Profile is already confirmed and cannot be modified");
  }
  
  // Check if username is already taken by another user
  const usernameTaken = await profilesCol.findOne({
    username: username,
    address: { $ne: addressLower }, // Exclude current user's address
  });
  
  if (usernameTaken) {
    throw new Error("Username is already taken. Please choose a different username.");
  }
  
  const email = sanitizeEmail(data.email);
  if (!email) {
    throw new Error("Invalid email address");
  }
  
  const profileData = {
    address: addressLower,
    username: username,
    biography: sanitizeDescription(data.biography, 1000),
    email: email,
    fullName: data.fullName ? sanitizeText(data.fullName, 200) : null,
    country: data.country ? sanitizeText(data.country, 100) : null,
    city: data.city ? sanitizeText(data.city, 100) : null,
    physicalAddress: data.physicalAddress ? sanitizeText(data.physicalAddress, 500) : null,
    status: "UNCONFIRMED",
    time_created: existing ? existing.time_created : new Date(),
    time_updated: new Date(),
  };
  
  if (existing) {
    // Update existing unconfirmed profile
    await profilesCol.updateOne(
      { address: addressLower },
      {
        $set: {
          ...profileData,
          time_updated: new Date(),
        },
      }
    );
    return existing._id.toString();
  } else {
    // Create new profile
    const result = await profilesCol.insertOne(profileData);
    return result.insertedId.toString();
  }
}

