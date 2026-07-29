/**
 * Turns an axios failure into something a user can act on.
 *
 * The master pages used to swallow their load error (console.error only) and show a
 * generic string on write, so a stopped backend service was indistinguishable from an
 * empty table plus "Failed to add". The gateway is a YARP reverse proxy: when a
 * downstream service is not running it answers 502 rather than refusing the connection,
 * so "service is down" has to be recognised from the status, not from a network error.
 */
import { isAxiosError } from 'axios';

export const describeApiError = (err: unknown, fallback: string): string => {
    if (!isAxiosError(err)) {
        return err instanceof Error && err.message ? `${fallback}: ${err.message}` : fallback;
    }

    // No response at all — the gateway itself is unreachable.
    if (!err.response) {
        return 'Cannot reach the server. Check that the backend services and the API gateway are running.';
    }

    const { status, data } = err.response;

    // YARP returns these when the downstream service is stopped or not responding.
    if (status === 502 || status === 503 || status === 504) {
        return 'The service handling this request is not responding — it is probably stopped. Start the backend services and try again.';
    }
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to perform this action.';

    // Controllers here return BadRequest("plain string") for validation failures.
    if (typeof data === 'string' && data.trim()) return data.trim();

    // ASP.NET ProblemDetails / ModelState.
    if (data && typeof data === 'object') {
        const problem = data as { detail?: string; title?: string; errors?: Record<string, string[]> };
        if (problem.errors) {
            const first = Object.values(problem.errors).flat().filter(Boolean);
            if (first.length) return first.join(' ');
        }
        if (problem.detail) return problem.detail;
        if (problem.title) return problem.title;
    }

    return `${fallback} (HTTP ${status}).`;
};
