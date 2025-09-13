import React from "react";

export const sortableKeyboardCoordinates = () => null as any;
export const verticalListSortingStrategy = () => null as any;

type SortableContextProps = React.PropsWithChildren<{ id?: any; items?: any; strategy?: any }>;
export const SortableContext: React.FC<SortableContextProps> = ({ children }) => <>{children}</>;

export const arrayMove = <T,>(arr: T[], from: number, to: number): T[] => {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export const useSortable = (_opts: { id: string }) => ({
  setNodeRef: () => {},
  attributes: {},
  listeners: {},
  transform: null,
  transition: undefined,
  isDragging: false,
  active: null,
});

export type SortablePayload = { index?: number; containerId?: string };