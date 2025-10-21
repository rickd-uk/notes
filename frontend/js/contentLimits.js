// contentLimits.js - Content size validation and management

// ===== CONFIGURATION =====
// Maximum content size in characters (500KB of HTML ~ 500,000 characters)
// This is a reasonable limit that works well with most browsers and databases
const MAX_CONTENT_SIZE = 500000; // 500KB

// Warning threshold (80% of max) - when to warn users they're approaching the limit
const WARNING_THRESHOLD = MAX_CONTENT_SIZE * 0.8; // 400KB

// Smaller limit for paste operations to ensure they complete successfully
const MAX_PASTE_SIZE = 250000; // 250KB for individual paste operations

// ===== UTILITY FUNCTIONS =====

/**
 * Get the byte size of a string (UTF-8 encoded)
 */
function getByteSize(str) {
  return new Blob([str]).size;
}

/**
 * Format bytes into a human-readable string
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Get plain text length from HTML content
 */
function getPlainTextLength(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent.length;
}

/**
 * Truncate HTML content to a maximum size while preserving structure
 */
function truncateHTML(html, maxSize) {
  // If content is already under the limit, return as-is
  if (html.length <= maxSize) return html;

  // Create a temporary element to work with the HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Try to truncate at the nearest paragraph or block element
  let truncated = html.substring(0, maxSize);

  // Find the last complete HTML tag
  const lastTagIndex = truncated.lastIndexOf(">");
  if (lastTagIndex > 0) {
    truncated = truncated.substring(0, lastTagIndex + 1);
  }

  // Add a notice that content was truncated
  truncated += "<p><em>(Content truncated due to size limit)</em></p>";

  return truncated;
}

/**
 * Validate content size and return validation result
 */
export function validateContentSize(content) {
  const size = content.length;
  const byteSize = getByteSize(content);
  const plainTextLength = getPlainTextLength(content);

  return {
    isValid: size <= MAX_CONTENT_SIZE,
    size: size,
    byteSize: byteSize,
    plainTextLength: plainTextLength,
    maxSize: MAX_CONTENT_SIZE,
    percentage: (size / MAX_CONTENT_SIZE) * 100,
    isNearLimit: size >= WARNING_THRESHOLD,
    formatted: {
      current: formatSize(byteSize),
      max: formatSize(getByteSize("a".repeat(MAX_CONTENT_SIZE))),
    },
  };
}

/**
 * Validate paste content specifically
 */
export function validatePasteSize(content) {
  const size = content.length;

  return {
    isValid: size <= MAX_PASTE_SIZE,
    size: size,
    maxSize: MAX_PASTE_SIZE,
    percentage: (size / MAX_PASTE_SIZE) * 100,
    formatted: {
      current: formatSize(getByteSize(content)),
      max: formatSize(getByteSize("a".repeat(MAX_PASTE_SIZE))),
    },
  };
}

/**
 * Handle content that exceeds size limits
 */
export function handleOversizedContent(content, type = "note") {
  const validation = validateContentSize(content);

  if (!validation.isValid) {
    // Content is too large - truncate it
    const truncated = truncateHTML(content, MAX_CONTENT_SIZE);

    return {
      success: false,
      content: truncated,
      message: `Content was too large (${validation.formatted.current}) and has been truncated to fit the ${validation.formatted.max} limit.`,
      validation: validation,
    };
  }

  if (validation.isNearLimit) {
    // Content is approaching the limit - warn the user
    return {
      success: true,
      content: content,
      message: `Warning: Content is ${validation.percentage.toFixed(0)}% of the maximum size limit.`,
      validation: validation,
    };
  }

  // Content is fine
  return {
    success: true,
    content: content,
    validation: validation,
  };
}

/**
 * Handle paste events with size limits
 */
export function handlePasteValidation(pastedContent, currentContent) {
  const pasteValidation = validatePasteSize(pastedContent);

  // Check if the pasted content alone is too large
  if (!pasteValidation.isValid) {
    return {
      success: false,
      message: `The pasted content is too large (${pasteValidation.formatted.current}). Maximum paste size is ${pasteValidation.formatted.max}. Please paste smaller sections at a time.`,
      shouldPrevent: true,
    };
  }

  // Check if combining current + pasted content would exceed the limit
  const combinedContent = currentContent + pastedContent;
  const combinedValidation = validateContentSize(combinedContent);

  if (!combinedValidation.isValid) {
    return {
      success: false,
      message: `Adding this content would exceed the note size limit. Current: ${validateContentSize(currentContent).formatted.current}, Trying to add: ${pasteValidation.formatted.current}, Limit: ${combinedValidation.formatted.max}`,
      shouldPrevent: true,
    };
  }

  if (combinedValidation.isNearLimit) {
    return {
      success: true,
      message: `Warning: This note is ${combinedValidation.percentage.toFixed(0)}% of the maximum size.`,
      shouldPrevent: false,
    };
  }

  return {
    success: true,
    shouldPrevent: false,
  };
}

/**
 * Show a size warning indicator in the UI
 */
export function showSizeIndicator(noteElement, validation) {
  // Remove any existing indicator
  const existingIndicator = noteElement.querySelector(".size-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Only show indicator if approaching or exceeding limit
  if (!validation.isNearLimit && validation.isValid) {
    return;
  }

  // Create indicator element
  const indicator = document.createElement("div");
  indicator.className = "size-indicator";

  let statusClass = "warning";
  let statusText = "Near Limit";

  if (!validation.isValid) {
    statusClass = "error";
    statusText = "Over Limit";
  }

  indicator.innerHTML = `
<span class="size-indicator-${statusClass}">
  ${statusText}: ${validation.formatted.current} / ${validation.formatted.max}
</span>
`;

  // Add to note footer
  const footer = noteElement.querySelector(".note-footer");
  if (footer) {
    footer.insertBefore(indicator, footer.firstChild);
  }
}

/**
 * Create a size limit notice for display
 */
export function createSizeLimitNotice() {
  const maxSizeFormatted = formatSize(
    getByteSize("a".repeat(MAX_CONTENT_SIZE)),
  );
  const maxPasteSizeFormatted = formatSize(
    getByteSize("a".repeat(MAX_PASTE_SIZE)),
  );

  return `
<div class="size-limit-notice">
<h4>📝 Note Size Limits</h4>
<ul>
<li>Maximum note size: <strong>${maxSizeFormatted}</strong></li>
<li>Maximum paste size: <strong>${maxPasteSizeFormatted}</strong></li>
<li>For large documents, consider splitting them into multiple notes</li>
</ul>
</div>
`;
}

// Export constants for use in other modules
export const LIMITS = {
  MAX_CONTENT_SIZE,
  WARNING_THRESHOLD,
  MAX_PASTE_SIZE,
};

export default {
  validateContentSize,
  validatePasteSize,
  handleOversizedContent,
  handlePasteValidation,
  showSizeIndicator,
  createSizeLimitNotice,
  LIMITS,
};
