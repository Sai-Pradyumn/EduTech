import { Difficulty, QuestionType } from '../../common/enums';

export interface BankQuestion {
  type: QuestionType;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  modelAnswer?: string;
  keywords?: string[];
  explanation: string;
  difficulty: Difficulty;
}

/**
 * Curated question bank for common CS topics, spread across difficulties. The generator
 * draws from here for known topics and falls back to templated questions otherwise — so
 * quizzes are specific and correct with no AI key (mock-safe).
 */
export const QUIZ_BANK: Record<string, BankQuestion[]> = {
  closure: [
    {
      type: QuestionType.Mcq,
      prompt: 'What best describes a JavaScript closure?',
      options: [
        'A function bundled with references to its surrounding (lexical) scope',
        'A way to close a file handle',
        'A loop that never terminates',
        'A CSS layout technique',
      ],
      answerIndex: 0,
      explanation:
        'A closure keeps access to variables from the scope where it was created, even after that scope returns.',
      difficulty: Difficulty.Beginner,
    },
    {
      type: QuestionType.Mcq,
      prompt:
        'Why does a closure created inside a `for` loop with `var` often capture the wrong value?',
      options: [
        'Because `var` is function-scoped, so all closures share one binding',
        'Because `var` cannot be used in loops',
        'Because closures copy values by default',
        'Because the loop runs in parallel',
      ],
      answerIndex: 0,
      explanation:
        '`var` has a single function-scoped binding; `let` creates a fresh binding per iteration.',
      difficulty: Difficulty.Intermediate,
    },
    {
      type: QuestionType.ShortAnswer,
      prompt: 'In one sentence, how can closures cause memory leaks?',
      modelAnswer:
        'A long-lived closure keeps references to captured variables alive, preventing garbage collection.',
      keywords: ['reference', 'captured', 'garbage', 'memory', 'retain'],
      explanation:
        'Closures retain their captured scope; if the closure lives long, so do those objects.',
      difficulty: Difficulty.Advanced,
    },
  ],
  recursion: [
    {
      type: QuestionType.Mcq,
      prompt: 'Every correct recursive function must have a…',
      options: [
        'Base case',
        'Global variable',
        'While loop',
        'Try/catch block',
      ],
      answerIndex: 0,
      explanation:
        'The base case stops the recursion; without it you get infinite recursion / stack overflow.',
      difficulty: Difficulty.Beginner,
    },
    {
      type: QuestionType.Mcq,
      prompt:
        'What typically causes a "Maximum call stack size exceeded" error?',
      options: [
        'Missing or unreachable base case',
        'Too many comments',
        'Using const instead of let',
        'A correct tail call',
      ],
      answerIndex: 0,
      explanation:
        'If the recursion never reaches the base case, the call stack grows without bound.',
      difficulty: Difficulty.Intermediate,
    },
  ],
  'big o': [
    {
      type: QuestionType.Mcq,
      prompt: 'What is the time complexity of binary search on a sorted array?',
      options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
      answerIndex: 0,
      explanation:
        'Binary search halves the search space each step, giving logarithmic time.',
      difficulty: Difficulty.Beginner,
    },
    {
      type: QuestionType.Mcq,
      prompt: 'Which is the dominant term in O(n² + n log n + 100)?',
      options: ['n²', 'n log n', '100', 'log n'],
      answerIndex: 0,
      explanation:
        'Big-O keeps the fastest-growing term and drops constants and lower-order terms.',
      difficulty: Difficulty.Intermediate,
    },
  ],
  sql: [
    {
      type: QuestionType.Mcq,
      prompt: 'Which clause filters rows BEFORE aggregation in SQL?',
      options: ['WHERE', 'HAVING', 'ORDER BY', 'GROUP BY'],
      answerIndex: 0,
      explanation:
        '`WHERE` filters rows before grouping; `HAVING` filters after aggregation.',
      difficulty: Difficulty.Beginner,
    },
    {
      type: QuestionType.Mcq,
      prompt: 'A JOIN without an ON condition typically produces a…',
      options: [
        'Cartesian (cross) product',
        'Syntax error always',
        'Single row',
        'Sorted result',
      ],
      answerIndex: 0,
      explanation:
        'Without a join predicate every row pairs with every other row — a Cartesian product.',
      difficulty: Difficulty.Intermediate,
    },
  ],
  'react hooks': [
    {
      type: QuestionType.Mcq,
      prompt: 'Why must hooks be called in the same order every render?',
      options: [
        'React tracks hook state by call order, not by name',
        'Because JSX requires it',
        'To reduce bundle size',
        'Hooks are alphabetical',
      ],
      answerIndex: 0,
      explanation:
        'React associates state with the order of hook calls; conditional hooks break that mapping.',
      difficulty: Difficulty.Intermediate,
    },
    {
      type: QuestionType.Mcq,
      prompt:
        'An empty dependency array `[]` in useEffect means the effect runs…',
      options: [
        'Once after the first render',
        'On every render',
        'Never',
        'Only on unmount',
      ],
      answerIndex: 0,
      explanation:
        'An empty deps array runs the effect once on mount (and cleanup on unmount).',
      difficulty: Difficulty.Beginner,
    },
  ],
  promise: [
    {
      type: QuestionType.Mcq,
      prompt: 'A Promise can be in which of these states?',
      options: [
        'Pending, fulfilled, or rejected',
        'Open or closed',
        'True or false',
        'Sync or async',
      ],
      answerIndex: 0,
      explanation:
        'Promises are pending until they settle as fulfilled or rejected.',
      difficulty: Difficulty.Beginner,
    },
    {
      type: QuestionType.ShortAnswer,
      prompt:
        'What is a common bug when you forget to `return` a promise inside `.then()`?',
      modelAnswer:
        'The chain does not wait for the inner promise, so ordering/errors are lost.',
      keywords: ['return', 'chain', 'wait', 'unhandled', 'order'],
      explanation:
        'Without returning, the outer chain continues before the inner promise settles.',
      difficulty: Difficulty.Advanced,
    },
  ],
};

export const KNOWN_TOPICS = Object.keys(QUIZ_BANK);
