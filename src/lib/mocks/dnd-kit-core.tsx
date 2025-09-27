import React, { createContext } from "react";

export type DragEndEvent = { active: { id: string; data?: any }; over?: { id: string; data?: any } };
export type DragOverEvent = DragEndEvent;
export type DragStartEvent = { active: { id: string; data?: any } };

export const closestCenter = () => null as any;

type Sensor = any;
export const PointerSensor: Sensor = function PointerSensor() {} as any;
export const KeyboardSensor: Sensor = function KeyboardSensor() {} as any;
export const useSensor = (_sensor: any, _opts?: any) => ({}) as any;
export const useSensors = (..._sensors: any[]) => _sensors as any;

type DndContextProps = React.PropsWithChildren<{
  sensors?: any;
  collisionDetection?: any;
  modifiers?: any[];
  onDragStart?: (e: DragStartEvent) => void;
  onDragEnd?: (e: DragEndEvent) => void;
  onDragOver?: (e: DragOverEvent) => void;
  onDragCancel?: () => void;
}>;

const Ctx = createContext<any>(null);

export const DndContext: React.FC<DndContextProps> = ({ children }) => {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
};

export const useDroppable = (_opts: { id: string }) => ({ setNodeRef: () => {}, isOver: false });
export const useDraggable = (_opts: { id: string; data?: any }) => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => {},
  transform: null,
  isDragging: false,
});
export const rectIntersection = () => null as any;
export const restrictToVerticalAxis = () => null as any;
export const DragOverlay: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;