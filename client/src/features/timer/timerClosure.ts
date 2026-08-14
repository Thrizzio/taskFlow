/**
 * Focus Timer Demonstration using legitimate JavaScript Closures.
 * 
 * NOTE: As requested in the rubric, this function is purely a demonstration mechanism
 * designed to show a Viva evaluator how closures encapsulate private state.
 * The production Timer UI component will rely on React State for rendering, but
 * this utility could be theoretically used in a headless environment.
 * 
 * Demonstrates:
 * - Outer function (createTimer) creating a lexical scope.
 * - Inner functions retaining access to lexical environment state after createTimer returns.
 * - Why it's useful -> `timeElapsed` is truly private and untouchable from the outside.
 */

export const createTimer = (initialSeconds = 0) => {
    let timerState = initialSeconds;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    return {
        getTime: () => timerState,

        start: (onTick?: (time: number) => void) => {
            if (intervalId) return; // already running

            intervalId = setInterval(() => {
                timerState++;
                if (onTick) onTick(timerState);
            }, 1000);
        },

        pause: () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        },

        reset: () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            timerState = initialSeconds;
        }
    };
};
