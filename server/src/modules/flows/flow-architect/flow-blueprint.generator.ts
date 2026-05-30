import { Difficulty } from '../../../common/enums';
import { FlowNodeType } from '../schemas/flow.schema';
import {
  FlowBlueprintInput,
  GeneratedFlow,
  GeneratedFlowEdge,
  GeneratedFlowNode,
} from './generated-flow.types';

/** Canvas layout constants — columns are stages, rows are lanes within a stage. */
const COL_W = 280;
const ROW_H = 150;
const ORIGIN_X = 120;
const ORIGIN_Y = 120;

/** A curated topic backbone for a well-known goal (keeps deterministic flows intelligent). */
interface TrackSeed {
  match: RegExp;
  stages: string[];
  project: string;
}

const TRACKS: TrackSeed[] = [
  {
    match: /mern|full[\s-]?stack|react|node|express|mongo/i,
    stages: [
      'JavaScript & ES2023 foundations',
      'React components & hooks',
      'State, routing & data fetching',
      'Node.js & Express APIs',
      'MongoDB & Mongoose modeling',
      'Auth, deployment & testing',
    ],
    project: 'Ship a full-stack MERN product (auth + CRUD + deploy)',
  },
  {
    match: /dsa|data structure|algorithm|leetcode|interview prep/i,
    stages: [
      'Complexity & arrays/strings',
      'Hashing & two pointers',
      'Recursion & backtracking',
      'Trees & graphs',
      'Dynamic programming',
      'Mock interview drills',
    ],
    project: 'Solve a timed 90-minute mock interview set',
  },
  {
    match: /system design|scalab|distributed|architecture/i,
    stages: [
      'Fundamentals: latency, throughput, CAP',
      'Caching & load balancing',
      'Databases & sharding',
      'Queues & async processing',
      'Designing for scale & reliability',
      'Mock design rounds',
    ],
    project: 'Design a URL shortener and a news feed end-to-end',
  },
  {
    match: /java|spring|backend/i,
    stages: [
      'Java core & OOP',
      'Collections & streams',
      'Spring Boot basics',
      'REST APIs & persistence',
      'Security & testing',
      'Deployment & observability',
    ],
    project: 'Build a Spring Boot REST service with JWT + Postgres',
  },
  {
    match: /angular/i,
    stages: [
      'TypeScript & Angular CLI',
      'Components, signals & templates',
      'Services & dependency injection',
      'RxJS & state',
      'Routing, forms & guards',
      'Interview & performance drills',
    ],
    project: 'Build a signal-driven Angular dashboard',
  },
  {
    match: /cyber|security|hacking|pentest/i,
    stages: [
      'Networking & threat models',
      'Web vulnerabilities (OWASP)',
      'Cryptography basics',
      'Recon & tooling',
      'Defensive hardening',
      'Capture-the-flag practice',
    ],
    project: 'Complete a guided defensive CTF lab',
  },
];

/** Decompose a generic goal into a sensible stage backbone when no track matches. */
function genericStages(goal: string): string[] {
  const g = goal.replace(/^(learn|master|crack|prepare for|build)\s+/i, '').trim();
  const subject = g.length ? g[0].toUpperCase() + g.slice(1) : 'your goal';
  return [
    `Foundations of ${subject}`,
    `Core concepts of ${subject}`,
    `Hands-on practice`,
    `Advanced ${subject}`,
    `Real-world application`,
  ];
}

function difficultyForStage(index: number, total: number, base: Difficulty): Difficulty {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  if (ratio < 0.34) return Difficulty.Beginner;
  if (ratio < 0.7) return Difficulty.Intermediate;
  return base === Difficulty.Beginner ? Difficulty.Intermediate : Difficulty.Advanced;
}

let edgeSeq = 0;
function edge(
  source: string,
  target: string,
  relation: GeneratedFlowEdge['relation'],
  strength: number,
  explanation: string,
): GeneratedFlowEdge {
  return { id: `e${++edgeSeq}`, source, target, relation, strength, explanation };
}

/**
 * Build a complete learning graph deterministically. This is the mock/offline fallback for
 * the FlowArchitect — it must produce a valid, demo-quality flow without any LLM key.
 */
export function buildFlowBlueprint(input: FlowBlueprintInput): GeneratedFlow {
  edgeSeq = 0;
  const goal = input.goal.trim();
  const base = input.skillLevel ?? Difficulty.Beginner;

  // 1. Decide the stage backbone.
  let stageTitles: string[];
  if (input.roadmapWeeks?.length) {
    stageTitles = input.roadmapWeeks.map((w) => w.focus || `Week ${w.weekNumber}`);
  } else {
    const track = TRACKS.find((t) => t.match.test(goal));
    stageTitles = track ? track.stages : genericStages(goal);
  }
  const matchedTrack = input.roadmapWeeks?.length ? undefined : TRACKS.find((t) => t.match.test(goal));

  const nodes: GeneratedFlowNode[] = [];
  const edges: GeneratedFlowEdge[] = [];
  const timeline: GeneratedFlow['timeline'] = [];
  const stageConceptId: string[] = [];

  let nodeSeq = 0;
  const nid = (prefix: string) => `${prefix}_${++nodeSeq}`;

  const place = (stage: number, lane: number) => ({
    x: ORIGIN_X + stage * COL_W,
    y: ORIGIN_Y + lane * ROW_H,
  });

  // 2. Optional prerequisite gate for beginners.
  let prereqId: string | undefined;
  if (base === Difficulty.Beginner) {
    prereqId = nid('prereq');
    nodes.push({
      id: prereqId,
      type: 'prerequisite',
      title: 'Prerequisites & setup',
      summary: 'Tools, environment and the baseline knowledge you need before starting.',
      objective: 'Have a working environment and the vocabulary to begin.',
      difficulty: Difficulty.Beginner,
      estimatedMinutes: 25,
      status: 'available',
      position: place(0, 0),
      stage: 0,
      prerequisites: [],
      resources: [{ label: 'Setup checklist', kind: 'note' }],
      agentHints: ['Confirm tooling and prior knowledge before the first concept.'],
    });
    timeline.push({ index: 0, label: 'Setup', focus: 'Prerequisites & setup', nodeIds: [prereqId] });
  }

  const stageOffset = prereqId ? 1 : 0;

  // 3. One concept node per stage, plus practice / quiz / repair scaffolding.
  stageTitles.forEach((title, i) => {
    const stage = i + stageOffset;
    const bucketNodeIds: string[] = [];
    const diff = difficultyForStage(i, stageTitles.length, base);

    const conceptId = nid('concept');
    stageConceptId.push(conceptId);
    nodes.push({
      id: conceptId,
      type: 'concept',
      title,
      summary: `Understand ${title.toLowerCase()} with worked examples and an Asta explanation.`,
      objective: `Explain ${title.toLowerCase()} clearly and apply it to a small example.`,
      difficulty: diff,
      estimatedMinutes: 45,
      status: i === 0 && !prereqId ? 'available' : 'locked',
      position: place(stage, 0),
      stage,
      prerequisites: i === 0 ? (prereqId ? [prereqId] : []) : [stageConceptId[i - 1]],
      resources: [{ label: 'Ask the AI Tutor', kind: 'tutor' }],
      agentHints: [`Teach ${title} from the learner's current level.`],
    });
    bucketNodeIds.push(conceptId);

    if (i === 0 && prereqId) {
      edges.push(edge(prereqId, conceptId, 'unlocks', 1, 'Setup complete — start the first concept.'));
    }
    if (i > 0) {
      edges.push(
        edge(stageConceptId[i - 1], conceptId, 'prerequisite', 0.9, `Builds directly on ${stageTitles[i - 1]}.`),
      );
    }

    // Practice node every stage (lane 1).
    const practiceId = nid('practice');
    nodes.push({
      id: practiceId,
      type: 'practice',
      title: `Practice: ${title}`,
      summary: `Hands-on reps to make ${title.toLowerCase()} stick.`,
      objective: 'Apply the concept without looking at the explanation.',
      difficulty: diff,
      estimatedMinutes: 30,
      status: 'locked',
      position: place(stage, 1),
      stage,
      prerequisites: [conceptId],
      resources: [{ label: 'Open practice', kind: 'practice' }],
      agentHints: ['Give graded practice with hints before answers.'],
    });
    edges.push(edge(conceptId, practiceId, 'reinforces', 0.8, 'Practice reinforces the concept.'));
    bucketNodeIds.push(practiceId);

    // Quiz checkpoint every 2 stages (lane 2).
    if (i % 2 === 1 || i === stageTitles.length - 1) {
      const quizId = nid('quiz');
      nodes.push({
        id: quizId,
        type: 'quiz',
        title: `Checkpoint quiz`,
        summary: `Prove mastery of ${stageTitles[i - 1] ? stageTitles[i - 1] + ' & ' : ''}${title}.`,
        objective: 'Score 70%+ to unlock the next stage.',
        difficulty: diff,
        estimatedMinutes: 20,
        status: 'locked',
        position: place(stage, 2),
        stage,
        prerequisites: [conceptId],
        resources: [{ label: 'Generate quiz', kind: 'quiz' }],
        agentHints: ['Generate a mixed quiz from the covered concepts.'],
      });
      edges.push(edge(conceptId, quizId, 'tests', 0.85, 'Checkpoint tests the stage.'));
      bucketNodeIds.push(quizId);
    }

    timeline.push({
      index: stage,
      label: input.roadmapWeeks?.length ? `Week ${input.roadmapWeeks[i].weekNumber}` : `Stage ${i + 1}`,
      focus: title,
      nodeIds: bucketNodeIds,
    });
  });

  // 4. Weak-area repair nodes branch off the most relevant concept.
  const lastStage = stageTitles.length - 1 + stageOffset;
  (input.weakAreas ?? []).slice(0, 3).forEach((weak, i) => {
    const repairId = nid('repair');
    const anchor =
      stageConceptId.find((id, idx) => stageTitles[idx].toLowerCase().includes(weak.toLowerCase().split(' ')[0])) ??
      stageConceptId[Math.min(i, stageConceptId.length - 1)];
    nodes.push({
      id: repairId,
      type: 'weak_area_repair',
      title: `Repair: ${weak}`,
      summary: `Targeted repair loop for your weak area "${weak}".`,
      objective: `Turn "${weak}" from a weakness into a strength.`,
      difficulty: Difficulty.Intermediate,
      estimatedMinutes: 35,
      status: 'locked',
      position: place(lastStage, 3 + i),
      stage: lastStage,
      prerequisites: anchor ? [anchor] : [],
      resources: [{ label: 'Start repair loop', kind: 'tutor' }],
      agentHints: [`Diagnose and repair misconceptions about ${weak}.`],
    });
    if (anchor) edges.push(edge(anchor, repairId, 'weak_area_patch', 0.9, `Patches the weak area: ${weak}.`));
  });

  // 5. A capstone project applying the concepts.
  const track = matchedTrack;
  const projectTitle = track ? track.project : `Build a project that applies ${goal}`;
  const projectStage = lastStage + 1;
  const projectId = nid('project');
  nodes.push({
    id: projectId,
    type: 'project',
    title: projectTitle,
    summary: 'Apply everything in a portfolio-worthy build.',
    objective: 'Ship something you can show in an interview.',
    difficulty: base === Difficulty.Beginner ? Difficulty.Intermediate : Difficulty.Advanced,
    estimatedMinutes: 240,
    status: 'locked',
    position: place(projectStage, 0),
    stage: projectStage,
    prerequisites: [stageConceptId[stageConceptId.length - 1]],
    resources: [{ label: 'Open Project Studio', kind: 'project' }],
    agentHints: ['Scope a project that exercises the strongest concepts.'],
  });
  // Concept → project application edges from the last few concepts.
  stageConceptId.slice(-3).forEach((id) =>
    edges.push(edge(id, projectId, 'project_application', 0.7, 'Concept applied in the capstone project.')),
  );

  // 6. Voice viva + final mastery gate.
  const vivaId = nid('voice');
  nodes.push({
    id: vivaId,
    type: 'voice_practice',
    title: 'Voice viva: explain it back',
    summary: 'Explain the hardest concepts aloud in a voice session.',
    objective: 'Demonstrate you can teach the material.',
    difficulty: Difficulty.Intermediate,
    estimatedMinutes: 20,
    status: 'locked',
    position: place(projectStage, 1),
    stage: projectStage,
    prerequisites: [projectId],
    resources: [{ label: 'Open Voice Room', kind: 'voice' }],
    agentHints: ['Run a Socratic oral viva on the toughest concepts.'],
  });
  edges.push(edge(projectId, vivaId, 'unlocks', 0.7, 'Explain your project aloud.'));

  const gateId = nid('gate');
  nodes.push({
    id: gateId,
    type: 'mastery_gate',
    title: 'Mastery gate',
    summary: `Final gate for "${goal}". Pass it to mark the flow complete.`,
    objective: 'Confirm end-to-end mastery of the goal.',
    difficulty: Difficulty.Advanced,
    estimatedMinutes: 30,
    status: 'locked',
    position: place(projectStage + 1, 0),
    stage: projectStage + 1,
    prerequisites: [vivaId],
    resources: [],
    agentHints: ['Assess overall readiness against the goal.'],
  });
  edges.push(edge(vivaId, gateId, 'unlocks', 1, 'Final mastery gate.'));

  timeline.push({
    index: projectStage,
    label: 'Apply',
    focus: 'Project + voice viva',
    nodeIds: [projectId, vivaId],
  });
  timeline.push({ index: projectStage + 1, label: 'Mastery', focus: 'Mastery gate', nodeIds: [gateId] });

  return {
    title: input.roadmapTitle ? `Flow · ${input.roadmapTitle}` : titleForGoal(goal),
    goal,
    description: `An adaptive learning flow for "${goal}", sequenced from foundations to a mastery gate with practice, checkpoints, a project and a voice viva.`,
    difficulty: base,
    sourceType: input.sourceType ?? 'generated',
    nodes,
    edges,
    timeline,
    metadata: {
      targetRole: input.targetRole ?? null,
      preferredStack: input.preferredStack ?? [],
      dailyMinutes: input.dailyMinutes ?? null,
      timelineWeeks: input.timelineWeeks ?? stageTitles.length,
      learningStyle: input.learningStyle ?? null,
      weakAreas: input.weakAreas ?? [],
      track: track ? 'curated' : 'generic',
    },
  };
}

function titleForGoal(goal: string): string {
  const g = goal.replace(/\.$/, '');
  return g.length > 60 ? `${g.slice(0, 57)}…` : g[0]?.toUpperCase() + g.slice(1);
}

/** Allowed node types for client/agent reference. */
export const NODE_TYPE_LIST: FlowNodeType[] = [
  'concept',
  'prerequisite',
  'lesson',
  'practice',
  'quiz',
  'project',
  'checkpoint',
  'weak_area_repair',
  'mentor_review',
  'voice_practice',
  'simulation',
  'document_source',
  'diagram',
  'image',
  'mastery_gate',
];
