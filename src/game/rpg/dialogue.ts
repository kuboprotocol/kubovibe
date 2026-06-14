/**
 * Tiny dialogue runner. Walks DialogueNode lines and supports branching via choices.
 */

import type { DialogueTree, DialogueLine } from './types';

export interface DialogueState {
  nodeId: string;
  lineIndex: number;
  flags: Set<string>;
  done: boolean;
}

export function startDialogue(tree: DialogueTree, rootId: string): DialogueState {
  if (!tree[rootId]) throw new Error(`dialogue: missing node ${rootId}`);
  return { nodeId: rootId, lineIndex: 0, flags: new Set(), done: false };
}

export function currentLine(tree: DialogueTree, state: DialogueState): DialogueLine | null {
  if (state.done) return null;
  const node = tree[state.nodeId];
  return node?.lines[state.lineIndex] ?? null;
}

export function advance(tree: DialogueTree, state: DialogueState): DialogueState {
  if (state.done) return state;
  const node = tree[state.nodeId];
  const next = { ...state, flags: new Set(state.flags) };
  if (state.lineIndex + 1 < node.lines.length) {
    next.lineIndex++;
  } else if (node.next && tree[node.next]) {
    next.nodeId = node.next;
    next.lineIndex = 0;
  } else {
    next.done = true;
  }
  return next;
}

export function choose(tree: DialogueTree, state: DialogueState, choiceIndex: number): DialogueState {
  const line = currentLine(tree, state);
  const choice = line?.choices?.[choiceIndex];
  if (!choice) return advance(tree, state);
  const next = { ...state, flags: new Set(state.flags) };
  if (choice.flag) next.flags.add(choice.flag);
  if (choice.next && tree[choice.next]) {
    next.nodeId = choice.next;
    next.lineIndex = 0;
  } else {
    return advance(tree, state);
  }
  return next;
}
