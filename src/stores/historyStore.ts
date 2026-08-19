import { create } from 'zustand'
import type { EditorObject } from '../types/editor'

const HISTORY_LIMIT = 100

function cloneObjects(objects: EditorObject[]): EditorObject[] {
  return structuredClone(objects)
}

interface HistoryState {
  past: EditorObject[][]
  present: EditorObject[]
  future: EditorObject[][]
  canUndo: boolean
  canRedo: boolean
  addObject: (object: EditorObject) => void
  updateObject: (id: string, updates: Partial<EditorObject>) => void
  deleteObject: (id: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

function commit(
  state: HistoryState,
  nextObjects: EditorObject[],
): Pick<HistoryState, 'past' | 'present' | 'future' | 'canUndo' | 'canRedo'> {
  const past = [...state.past, cloneObjects(state.present)].slice(-HISTORY_LIMIT)
  return {
    past,
    present: nextObjects,
    future: [],
    canUndo: past.length > 0,
    canRedo: false,
  }
}

export const useHistoryStore = create<HistoryState>((set) => ({
  past: [],
  present: [],
  future: [],
  canUndo: false,
  canRedo: false,

  addObject: (object) =>
    set((state) => commit(state, [...state.present, object])),

  updateObject: (id, updates) =>
    set((state) => {
      const current = state.present.find((object) => object.id === id)
      if (!current) {
        return state
      }

      const next = state.present.map((object) =>
        object.id === id
          ? ({ ...object, ...updates } as EditorObject)
          : object,
      )
      return commit(state, next)
    }),

  deleteObject: (id) =>
    set((state) => {
      if (!state.present.some((object) => object.id === id)) {
        return state
      }
      return commit(
        state,
        state.present.filter((object) => object.id !== id),
      )
    }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      if (!previous) {
        return state
      }
      const past = state.past.slice(0, -1)
      const future = [cloneObjects(state.present), ...state.future]
      return {
        past,
        present: cloneObjects(previous),
        future,
        canUndo: past.length > 0,
        canRedo: true,
      }
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0]
      if (!next) {
        return state
      }
      const past = [...state.past, cloneObjects(state.present)]
      const future = state.future.slice(1)
      return {
        past,
        present: cloneObjects(next),
        future,
        canUndo: true,
        canRedo: future.length > 0,
      }
    }),

  reset: () =>
    set({
      past: [],
      present: [],
      future: [],
      canUndo: false,
      canRedo: false,
    }),
}))
