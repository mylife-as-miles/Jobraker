export type ResumeEditorStatus =
  | "loading"
  | "ready"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

export type ResumeEditorState = {
  status: ResumeEditorStatus;
  error: string | null;
};

export type ResumeEditorEvent =
  | { type: "LOAD" }
  | { type: "READY" }
  | { type: "CHANGE" }
  | { type: "SAVE" }
  | { type: "SAVED" }
  | { type: "FAIL"; error: string };

export const initialResumeEditorState: ResumeEditorState = {
  status: "loading",
  error: null,
};

export function resumeEditorReducer(
  state: ResumeEditorState,
  event: ResumeEditorEvent,
): ResumeEditorState {
  switch (event.type) {
    case "LOAD":
      return { status: "loading", error: null };
    case "READY":
      return { status: "ready", error: null };
    case "CHANGE":
      return state.status === "loading" || state.status === "saving"
        ? state
        : { status: "dirty", error: null };
    case "SAVE":
      return { status: "saving", error: null };
    case "SAVED":
      return { status: "saved", error: null };
    case "FAIL":
      return { status: "error", error: event.error };
  }
}
