import * as React from "react";

export const SortableContext = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const useSortable = () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => { },
    transform: null,
    transition: null,
    isDragging: false,
});
export const sortableKeyboardCoordinates = () => () => null;
export const verticalListSortingStrategy = {};
export const horizontalListSortingStrategy = {};
export const rectSortingStrategy = {};
export const arrayMove = <T,>(arr: T[], from: number, to: number): T[] => {
    const clone = [...arr];
    const [item] = clone.splice(from, 1);
    clone.splice(to, 0, item);
    return clone;
};
