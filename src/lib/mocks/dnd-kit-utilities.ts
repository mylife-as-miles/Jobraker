export const CSS = {
    Transform: {
        toString: (transform: any) => {
            if (!transform) return "";
            const { x = 0, y = 0, scaleX = 1, scaleY = 1 } = transform;
            return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
        },
    },
    Transition: {
        toString: ({ property = "transform", duration = 250, easing = "ease" } = {}) =>
            `${property} ${duration}ms ${easing}`,
    },
};

export const useCombinedRefs = (...refs: any[]) => (node: any) => {
    refs.forEach((ref) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
    });
};
