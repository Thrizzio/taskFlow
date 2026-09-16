import { describe, it, expect } from 'vitest';
import { sanitizeString, escapeHtml, sanitizeMongoInput } from '../../utils/sanitize';

describe('Input Sanitization & Injection Prevention', () => {
    describe('sanitizeString', () => {
        it('preserves normal benign input untouched', () => {
            const normal = 'Complete math homework by 5pm!';
            expect(sanitizeString(normal)).toBe(normal);
        });

        it('strips script tags and executable content', () => {
            const malicious = 'Study for test <script>alert("hacked")</script> right now';
            expect(sanitizeString(malicious)).toBe('Study for test  right now');
        });

        it('strips iframes and embed elements', () => {
            const malicious = 'Check this out <iframe src="http://evil.com"></iframe>';
            expect(sanitizeString(malicious)).toBe('Check this out');
        });

        it('strips inline event handlers like onerror and onclick', () => {
            const malicious = '<img src="x" onerror="alert(1)"> Review notes';
            expect(sanitizeString(malicious)).toBe('<img src="x" > Review notes');
        });

        it('strips javascript: pseudo-protocols', () => {
            const malicious = '<a href="javascript:alert(1)">Click me</a>';
            expect(sanitizeString(malicious)).toBe('<a href="">Click me</a>');
        });

        it('treats SQL injection strings as pure data literals without breaking', () => {
            const sqlPayload = "Robert'); DROP TABLE tasks; --";
            const sanitized = sanitizeString(sqlPayload);
            // Legitimate text with punctuation is preserved so parameterized query handles it safely
            expect(sanitized).toBe("Robert'); DROP TABLE tasks; --");
        });
    });

    describe('escapeHtml', () => {
        it('escapes dangerous HTML characters for safe rendering', () => {
            const raw = '<b onmouseover="evil()">"Hello" & \'World\'</b>';
            const escaped = escapeHtml(raw);
            expect(escaped).toBe('&lt;b onmouseover=&quot;evil()&quot;&gt;&quot;Hello&quot; &amp; &#x27;World&#x27;&lt;/b&gt;');
        });
    });

    describe('sanitizeMongoInput (NoSQL operator injection prevention)', () => {
        it('strips top-level MongoDB query operators starting with $', () => {
            const maliciousQuery = {
                $gt: '',
                $ne: null,
                $where: 'sleep(5000)',
                normalField: 'safeValue',
            };
            const cleaned = sanitizeMongoInput(maliciousQuery);
            expect(cleaned).toEqual({ normalField: 'safeValue' });
            expect(cleaned).not.toHaveProperty('$gt');
            expect(cleaned).not.toHaveProperty('$ne');
            expect(cleaned).not.toHaveProperty('$where');
        });

        it('strips nested operator objects from nested payloads', () => {
            const payload = {
                filter: {
                    $or: [{ role: 'admin' }, { role: 'user' }],
                    title: 'Normal Title <script>bad()</script>',
                },
            };
            const cleaned = sanitizeMongoInput(payload);
            expect(cleaned.filter).not.toHaveProperty('$or');
            expect(cleaned.filter.title).toBe('Normal Title');
        });

        it('disallows field path injection containing dots', () => {
            const payload = {
                'profile.role': 'admin',
                validField: 'ok',
            };
            const cleaned = sanitizeMongoInput(payload);
            expect(cleaned).not.toHaveProperty('profile.role');
            expect(cleaned).toHaveProperty('validField', 'ok');
        });
    });
});
