// contentSizeValidator.js - Middleware to validate content size on the backend

// Maximum content size in bytes (1MB)
// We're being more generous on the backend to account for encoding differences
const MAX_CONTENT_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

// Maximum content size in characters
const MAX_CONTENT_SIZE_CHARS = 500000; // 500K characters

/**
 * Get the byte size of a string
 */
function getByteSize(str) {
  // Use Buffer to get accurate byte count
  return Buffer.byteLength(str, "utf8");
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Middleware to validate content size for notes
 */
function validateNoteContentSize(req, res, next) {
  const { content } = req.body;

  // Skip validation if no content
  if (!content) {
    return next();
  }

  // Check character length
  if (content.length > MAX_CONTENT_SIZE_CHARS) {
    return res.status(413).json({
      error: "Content too large",
      message: `Content exceeds maximum size of ${MAX_CONTENT_SIZE_CHARS.toLocaleString()} characters`,
      currentSize: content.length,
      maxSize: MAX_CONTENT_SIZE_CHARS,
    });
  }

  // Check byte size
  const byteSize = getByteSize(content);
  if (byteSize > MAX_CONTENT_SIZE_BYTES) {
    return res.status(413).json({
      error: "Content too large",
      message: `Content exceeds maximum size of ${formatBytes(MAX_CONTENT_SIZE_BYTES)}`,
      currentSize: formatBytes(byteSize),
      maxSize: formatBytes(MAX_CONTENT_SIZE_BYTES),
    });
  }

  // Content is valid, continue
  next();
}

/**
 * Error handler for payload too large errors
 */
function handlePayloadTooLarge(err, req, res, next) {
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request too large",
      message: "The request payload is too large. Maximum request size is 1MB.",
      suggestion:
        "Please reduce the content size or split it into multiple notes.",
    });
  }
  next(err);
}

module.exports = {
  validateNoteContentSize,
  handlePayloadTooLarge,
  MAX_CONTENT_SIZE_BYTES,
  MAX_CONTENT_SIZE_CHARS,
};
