import * as React from "react";

export const DndContext = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DragOverlay = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const useDraggable = () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => { },
    transform: null,
    isDragging: false,
});
export const useDroppable = () => ({
    setNodeRef: () => { },
    isOver: false,
});
export const useSensor = () => ({});
export const useSensors = () => [];
export const PointerSensor = {};
export const KeyboardSensor = {};
export const closestCenter = () => null;
export const closestCorners = () => null;
export const rectIntersection = () => null;
