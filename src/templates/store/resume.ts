import React from 'react';
import { useArtboardStore } from '../../store/artboard';

// Minimal store adapter to make templates work with existing store
export const useResumeStore = useArtboardStore;

// We need to ensure the store returns data in the structure expected by the template
// The template expects: state.resume.data.basics...
// Our store has: state.resume.personalInfo...

// Ideally we update the ArtboardStore to match Reactive Resume schema 1:1.
// Since we just updated the prompt/edge function to use that schema, we should aligning the store.

// For now, let's create a selector hooking or a wrapper if needed. 
// But the Azurill template specifically calls: `useResumeStore((state) => state.resume.data.basics)`
// So `state.resume` in `useResumeStore` must have a `data` property.
// Our `useArtboardStore` has `resume` as `ResumeState` directly.

// We will need to refactor the store or provide a compatibility layer.
// Let's create a "resume store" adapter that maps our artboard state to the expected structure.
