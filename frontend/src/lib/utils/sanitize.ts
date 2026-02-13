/**
 * User input sanitization utilities
 * 
 * Sanitizes user input to prevent XSS attacks and ensure data integrity.
 * Removes or escapes potentially dangerous characters while preserving legitimate content.
 */

/**
 * Sanitize a string by removing potentially dangerous characters
 * and trimming whitespace.
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string
 */
export function sanitizeString(input: string | null | undefined, maxLength: number = 10000): string {
  if (!input) return '';
  
  // Convert to string and trim
  let sanitized = String(input).trim();
  
  // Remove null bytes and other control characters (except newlines, tabs, carriage returns)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize text input (for names, titles, etc.)
 * Allows alphanumeric, spaces, hyphens, underscores, and common punctuation.
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeText(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input) return '';
  
  let sanitized = sanitizeString(input, maxLength);
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized.trim();
}

/**
 * Sanitize description/textarea input
 * Allows more characters including newlines, but still removes dangerous content.
 * 
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeDescription(input: string | null | undefined, maxLength: number = 10000): string {
  if (!input) return '';
  
  let sanitized = sanitizeString(input, maxLength);
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Normalize whitespace (preserve newlines but collapse multiple spaces)
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  
  return sanitized.trim();
}

/**
 * Sanitize email address
 * Validates and sanitizes email format.
 * 
 * @param input - The email input to sanitize
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(input: string | null | undefined): string {
  if (!input) return '';
  
  let sanitized = sanitizeString(input, 254); // Max email length per RFC
  
  // Basic email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized.toLowerCase();
}

/**
 * Sanitize username
 * Allows alphanumeric, underscores, and hyphens only.
 * 
 * @param input - The username input to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized username
 */
export function sanitizeUsername(input: string | null | undefined, maxLength: number = 50): string {
  if (!input) return '';
  
  let sanitized = sanitizeString(input, maxLength);
  
  // Only allow alphanumeric, underscores, and hyphens
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
  
  return sanitized;
}

