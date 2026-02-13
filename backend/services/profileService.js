import connectDB from "../db.js";
import { sanitizeText, sanitizeDescription, sanitizeEmail, sanitizeUsername } from "../utils/sanitize.js";
import { PROFILE_STATUS } from "../utils/statusConstants.js";
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
    address: normalizeAddress(address),
  });
  
  if (!profile) {
    return { status: PROFILE_STATUS.NONE, profile: null };
  }
  
  return {
    status: profile.status || PROFILE_STATUS.NONE,
    profile: profile,
  };
}

/**
 * Get profile by username (for public gallery view)
 * @param {string} username - Username to look up
 * @returns {Promise<{status: string, profile: object|null}>}
 */
export async function getProfileByUsername(username) {
  const db = await connectDB();
  const profilesCol = db.collection("profiles");
  
  const profile = await profilesCol.findOne({
    username: String(username),
  });
  
  if (!profile) {
    return { status: PROFILE_STATUS.NONE, profile: null };
  }
  
  // Only return profile if it's confirmed (public profiles only)
  if (profile.status !== PROFILE_STATUS.CONFIRMED) {
    return { status: PROFILE_STATUS.NONE, profile: null };
  }
  
  return {
    status: profile.status || PROFILE_STATUS.NONE,
    profile: profile,
  };
}

/**
 * Get all verified photographers with pagination and search
 * @param {number} skip - Number of records to skip
 * @param {number} limit - Maximum number of records to return
 * @param {string} searchQuery - Optional search query to filter by username
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getVerifiedPhotographers(skip = 0, limit = 20, searchQuery = '') {
  const db = await connectDB();
  const profilesCol = db.collection("profiles");
  
  // Build query - only confirmed profiles
  const query = {
    status: PROFILE_STATUS.CONFIRMED
  };
  
  // Add search filter if provided
  if (searchQuery && searchQuery.trim()) {
    const searchRegex = new RegExp(searchQuery.trim(), 'i'); // Case-insensitive search
    query.username = searchRegex;
  }
  
  // Get total count
  const total = await profilesCol.countDocuments(query);
  
  // Get paginated results, sorted alphabetically by username
  const profiles = await profilesCol
    .find(query)
    .sort({ username: 1 }) // Sort alphabetically by username
    .skip(skip)
    .limit(limit)
    .project({ username: 1, _id: 0 }) // Only return username
    .toArray();
  
  // Extract usernames
  const usernames = profiles.map(p => p.username);
  
  return {
    items: usernames,
    total: total
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
  
  if (existing && existing.status === PROFILE_STATUS.CONFIRMED) {
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
    status: PROFILE_STATUS.UNCONFIRMED,
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

