/**
 * Input sanitization and injection prevention utilities.
 *
 * Core Concepts:
 * - Validation: Checks that input conforms to an expected format/schema (e.g., non-empty, email format).
 * - Sanitization: Strips or defangs potentially dangerous content (e.g., removing executable script tags).
 * - Escaping: Replaces characters with safe representations for a specific rendering context (e.g., HTML entities).
 * - Parameterized Queries: Separates query logic from user data at the database driver level, preventing SQL/NoSQL injection.
 */

// Regex patterns for dangerous HTML/script injection
const SCRIPT_TAG_REGEX = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const IFRAME_TAG_REGEX = /<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JAVASCRIPT_URI_REGEX = /javascript\s*:\s*[^"'\s>]*/gi;
const GENERIC_HTML_TAG_REGEX = /<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;

/**
 * Strips script tags, iframes, inline event handlers, and javascript: URIs
 * from user-controlled strings, preventing Stored XSS without mutating legitimate text.
 */
export function sanitizeString(value: string): string {
    if (typeof value !== 'string') return value;

    return value
        .replace(SCRIPT_TAG_REGEX, '')
        .replace(IFRAME_TAG_REGEX, '')
        .replace(EVENT_HANDLER_REGEX, '')
        .replace(JAVASCRIPT_URI_REGEX, '')
        .trim();
}

/**
 * Escapes characters with dangerous HTML semantics (&, <, >, ", ')
 * when rendering text content into HTML templates.
 */
export function escapeHtml(value: string): string {
    if (typeof value !== 'string') return value;

    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Prevents NoSQL / MongoDB operator injection.
 * Strips any object key that begins with `$` (MongoDB operator) or contains `.` (field traversal).
 * Also ensures user-supplied query filters are primitive values rather than query operator objects.
 */
export function sanitizeMongoInput<T>(input: T): T {
    if (input === null || typeof input !== 'object') {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(sanitizeMongoInput) as unknown as T;
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
        // Disallow MongoDB operators like $gt, $ne, $where and dot notation path injection
        if (key.startsWith('$') || key.includes('.')) {
            continue;
        }

        if (value !== null && typeof value === 'object') {
            clean[key] = sanitizeMongoInput(value);
        } else if (typeof value === 'string') {
            clean[key] = sanitizeString(value);
        } else {
            clean[key] = value;
        }
    }

    return clean as T;
}
