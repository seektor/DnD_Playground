import { easeInCubic } from '../easingFunctions';

export function smoothScroll(container: HTMLElement, duration: number, distance: number, onEndCallback?: () => void): void {

    const startOffset: number = container.scrollTop;
    const startTime: number = new Date().getTime();
    const easeFunction: (t: number) => number = easeInCubic;
    scroll();

    function scroll(): void {
        const now: number = new Date().getTime();
        const calculatedTimeProgress: number = ((now - startTime) / duration);
        const timeProgress: number = Math.min(1, calculatedTimeProgress);
        const positionProgress: number = easeFunction(timeProgress);
        const newOffset: number = positionProgress * distance + startOffset;
        container.scrollTop = newOffset;

        if (timeProgress !== 1) {
            requestAnimationFrame(scroll);
        } else {
            if (onEndCallback) {
                // One more repaint in order to refresh the last scrolling step.
                requestAnimationFrame(() => onEndCallback());
            }
        }
    }

}