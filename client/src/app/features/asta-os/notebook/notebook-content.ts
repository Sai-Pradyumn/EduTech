/** A guided ML notebook: a sample dataset + ordered cells the learner runs and edits. */

export interface NotebookCell {
  readonly id: string;
  readonly kind: 'markdown' | 'code';
  readonly content: string;
}

export interface NotebookDataset {
  readonly name: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
}

export const NOTEBOOK_DATASET: NotebookDataset = {
  name: 'study_outcomes',
  columns: ['hours', 'attendance', 'passed'],
  rows: [
    [1, 0.4, 0],
    [2, 0.55, 0],
    [3, 0.6, 0],
    [4, 0.72, 1],
    [5, 0.85, 1],
    [6, 0.95, 1],
  ],
};

export const NOTEBOOK_TITLE = 'Your first classifier — predict pass/fail';

export const NOTEBOOK_CELLS: readonly NotebookCell[] = [
  {
    id: 'intro',
    kind: 'markdown',
    content:
      '# Predict pass / fail\nEach student has **study hours** and **attendance**, and whether they **passed**. Your goal: learn a rule that predicts `passed` from the two inputs, then measure how good it is.\n\nRun each cell with **▶ Run**, edit the code, and tap **Ask Asta** any time.',
  },
  {
    id: 'load',
    kind: 'code',
    content:
      'data = [\n    (1, 0.40, 0), (2, 0.55, 0), (3, 0.60, 0),\n    (4, 0.72, 1), (5, 0.85, 1), (6, 0.95, 1),\n]\nfor hours, attendance, passed in data:\n    print(hours, attendance, passed)\n',
  },
  {
    id: 'rule',
    kind: 'code',
    content:
      'def predict(hours, attendance):\n    # TODO: return 1 (pass) or 0 (fail)\n    return 1 if (hours >= 4 and attendance >= 0.7) else 0\n\nprint(predict(5, 0.85))  # expect 1\nprint(predict(2, 0.50))  # expect 0\n',
  },
  {
    id: 'evaluate',
    kind: 'code',
    content:
      'data = [\n    (1, 0.40, 0), (2, 0.55, 0), (3, 0.60, 0),\n    (4, 0.72, 1), (5, 0.85, 1), (6, 0.95, 1),\n]\ndef predict(h, a):\n    return 1 if (h >= 4 and a >= 0.7) else 0\n\ncorrect = sum(1 for h, a, y in data if predict(h, a) == y)\nprint("accuracy:", correct / len(data))\n',
  },
  {
    id: 'wrap',
    kind: 'markdown',
    content:
      "## What you just did\nYou built a **rule-based classifier** and measured **accuracy**. Next steps a real model would add: learning the threshold from data, a train/test split, and metrics like **precision** and **recall**. Ask Asta to explain any of these.",
  },
];
