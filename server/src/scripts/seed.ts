/**
 * Seed demo data so the app is demoable on first run.
 * Creates: admin + student users, the student's profile, and a generated sample roadmap.
 *
 *   npm run seed --workspace server
 */
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserSchema } from '../modules/users/schemas/user.schema';
import {
  StudentProfile,
  StudentProfileSchema,
} from '../modules/student-profile/schemas/student-profile.schema';
import {
  Roadmap,
  RoadmapSchema,
} from '../modules/roadmap/schemas/roadmap.schema';
import {
  Organization,
  OrganizationSchema,
} from '../modules/tenancy/schemas/organization.schema';
import {
  Membership,
  MembershipSchema,
} from '../modules/tenancy/schemas/membership.schema';
import { Cohort, CohortSchema } from '../modules/cohort/schemas/cohort.schema';
import { Flow, FlowSchema } from '../modules/flows/schemas/flow.schema';
import {
  VisualAsset,
  VisualAssetSchema,
} from '../modules/visuals/schemas/visual-asset.schema';
import {
  Mistake,
  MistakeSchema,
} from '../modules/mistakes/schemas/mistake.schema';
import {
  buildRepairPlan,
  severityToType,
} from '../modules/mistakes/mistake-repair.generator';
import {
  VoiceSession,
  VoiceSessionSchema,
} from '../modules/voice/schemas/voice-session.schema';
import {
  StudySpace,
  StudySpaceSchema,
} from '../modules/spaces/schemas/study-space.schema';
import {
  Simulation,
  SimulationSchema,
} from '../modules/simulations/schemas/simulation.schema';
import { SIM_BLUEPRINTS } from '../modules/simulations/simulation-coach';
import {
  Course,
  CourseSchema,
} from '../modules/course-builder/schemas/course.schema';
import { buildCourseBlueprint } from '../modules/course-builder/course-blueprint.generator';
import {
  PeerRoom,
  PeerRoomSchema,
} from '../modules/peer-rooms/schemas/peer-room.schema';
import {
  LedgerEntry,
  LedgerEntrySchema,
} from '../modules/ledger/schemas/ledger-entry.schema';
import {
  SkillPassport,
  SkillPassportSchema,
} from '../modules/skill-passport/schemas/skill-passport.schema';
import {
  SkillEvidence,
  SkillEvidenceSchema,
} from '../modules/skill-passport/schemas/skill-evidence.schema';
import {
  CareerReadinessState,
  CareerReadinessStateSchema,
} from '../modules/career-readiness/schemas/career-readiness.schema';
import {
  Portfolio,
  PortfolioSchema,
} from '../modules/portfolio/schemas/portfolio.schema';
import {
  MentorProfile,
  MentorProfileSchema,
} from '../modules/mentor-marketplace/schemas/mentor-profile.schema';
import {
  MentorSession,
  MentorSessionSchema,
} from '../modules/mentor-marketplace/schemas/mentor-session.schema';
import {
  MarketplaceTemplate,
  MarketplaceTemplateSchema,
} from '../modules/marketplace/schemas/marketplace-template.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../modules/billing/schemas/subscription.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../modules/billing/schemas/payment-transaction.schema';
import {
  EntitlementUsage,
  EntitlementUsageSchema,
} from '../modules/entitlements/schemas/entitlement-usage.schema';
import {
  FeatureFlag,
  FeatureFlagSchema,
} from '../modules/feature-flags/schemas/feature-flag.schema';
import {
  AiUsageLog,
  AiUsageLogSchema,
} from '../modules/ai/schemas/ai-usage-log.schema';
import { planById } from '../modules/billing/plans';
import {
  ProductEvent,
  ProductEventSchema,
} from '../modules/product-analytics/schemas/product-event.schema';
import {
  AuditLog,
  AuditLogSchema,
} from '../modules/audit/schemas/audit-log.schema';
import { JobRun, JobRunSchema } from '../modules/ops/schemas/job-run.schema';
import {
  ErrorLog,
  ErrorLogSchema,
} from '../modules/ops/schemas/error-log.schema';
import {
  Session,
  SessionSchema,
} from '../modules/sessions/schemas/session.schema';
import {
  OrgBranding,
  OrgBrandingSchema,
} from '../modules/org-branding/schemas/org-branding.schema';
import {
  ApiKey,
  ApiKeySchema,
} from '../modules/developer/schemas/api-key.schema';
import {
  WebhookEndpoint,
  WebhookEndpointSchema,
} from '../modules/developer/schemas/webhook.schema';
import {
  IntegrationConnection,
  IntegrationConnectionSchema,
} from '../modules/integrations/schemas/integration.schema';
import { createHash } from 'crypto';
import { buildRoadmapBlueprint } from '../modules/agents/roadmap/roadmap-blueprint.generator';
import { buildFlowBlueprint } from '../modules/flows/flow-architect/flow-blueprint.generator';
import { buildVisual } from '../modules/visuals/visual-explainer/visual-generator';
import {
  Branch,
  CareerTarget,
  CohortStatus,
  Difficulty,
  EducationLevel,
  LearningStyle,
  MembershipStatus,
  OrgRole,
  OrgType,
  Role,
  RoadmapStatus,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../common/enums';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/asta';

const DEMO = {
  admin: {
    name: 'Asta Admin',
    email: 'admin@asta.dev',
    password: 'admin12345',
  },
  student: {
    name: 'Aarav Sharma',
    email: 'student@asta.dev',
    password: 'student12345',
  },
  mentor: {
    name: 'Maya Mentor',
    email: 'mentor@asta.dev',
    password: 'mentor12345',
  },
};

async function run(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  const UserModel = mongoose.model(User.name, UserSchema);
  const ProfileModel = mongoose.model(
    StudentProfile.name,
    StudentProfileSchema,
  );
  const RoadmapModel = mongoose.model(Roadmap.name, RoadmapSchema);
  const OrgModel = mongoose.model(Organization.name, OrganizationSchema);
  const MembershipModel = mongoose.model(Membership.name, MembershipSchema);
  const CohortModel = mongoose.model(Cohort.name, CohortSchema);
  const FlowModel = mongoose.model(Flow.name, FlowSchema);
  const VisualModel = mongoose.model(VisualAsset.name, VisualAssetSchema);
  const MistakeModel = mongoose.model(Mistake.name, MistakeSchema);
  const VoiceSessionModel = mongoose.model(
    VoiceSession.name,
    VoiceSessionSchema,
  );
  const StudySpaceModel = mongoose.model(StudySpace.name, StudySpaceSchema);
  const SimulationModel = mongoose.model(Simulation.name, SimulationSchema);
  const CourseModel = mongoose.model(Course.name, CourseSchema);
  const PeerRoomModel = mongoose.model(PeerRoom.name, PeerRoomSchema);
  const LedgerModel = mongoose.model(LedgerEntry.name, LedgerEntrySchema);
  const SkillPassportModel = mongoose.model(
    SkillPassport.name,
    SkillPassportSchema,
  );
  const SkillEvidenceModel = mongoose.model(
    SkillEvidence.name,
    SkillEvidenceSchema,
  );
  const CareerReadinessModel = mongoose.model(
    CareerReadinessState.name,
    CareerReadinessStateSchema,
  );
  const PortfolioModel = mongoose.model(Portfolio.name, PortfolioSchema);
  const MentorProfileModel = mongoose.model(
    MentorProfile.name,
    MentorProfileSchema,
  );
  const MentorSessionModel = mongoose.model(
    MentorSession.name,
    MentorSessionSchema,
  );
  const MarketplaceTemplateModel = mongoose.model(
    MarketplaceTemplate.name,
    MarketplaceTemplateSchema,
  );

  await UserModel.updateOne(
    { email: DEMO.admin.email },
    {
      $set: {
        name: DEMO.admin.name,
        role: Role.Admin,
        platformRole: OrgRole.SuperAdmin,
        isOnboarded: true,
        passwordHash: await bcrypt.hash(DEMO.admin.password, 10),
      },
    },
    { upsert: true },
  );
  const admin = await UserModel.findOne({ email: DEMO.admin.email }).exec();

  await UserModel.updateOne(
    { email: DEMO.student.email },
    {
      $set: {
        name: DEMO.student.name,
        role: Role.Student,
        isOnboarded: true,
        passwordHash: await bcrypt.hash(DEMO.student.password, 10),
      },
    },
    { upsert: true },
  );
  const student = await UserModel.findOne({ email: DEMO.student.email }).exec();
  if (!student) throw new Error('Student user not created');

  await UserModel.updateOne(
    { email: DEMO.mentor.email },
    {
      $set: {
        name: DEMO.mentor.name,
        role: Role.Mentor,
        isOnboarded: true,
        passwordHash: await bcrypt.hash(DEMO.mentor.password, 10),
      },
    },
    { upsert: true },
  );
  const mentor = await UserModel.findOne({ email: DEMO.mentor.email }).exec();

  const profileFields = {
    fullName: DEMO.student.name,
    educationLevel: EducationLevel.BTech,
    branch: Branch.CSE,
    currentSkillLevel: SkillLevel.Beginner,
    currentSkills: ['HTML', 'CSS', 'JavaScript basics'],
    weakAreas: ['DSA', 'Backend', 'Deployment'],
    mainGoal: 'Become a MERN Stack Developer and land an internship',
    availableTimePerDay: TimePerDay.TwoHours,
    targetTimeline: TargetTimeline.ThreeMonths,
    preferredLearningStyle: LearningStyle.Project,
    preferredLanguage: 'English',
    careerTarget: CareerTarget.Internship,
    onboardingCompleted: true,
  };

  await ProfileModel.updateOne(
    { user: student._id },
    { $set: { user: student._id, ...profileFields } },
    { upsert: true },
  );
  const profile = await ProfileModel.findOne({ user: student._id }).exec();

  // Sample roadmap (only if the student has none yet).
  const existingRoadmap = await RoadmapModel.findOne({
    user: student._id,
  }).exec();
  if (!existingRoadmap) {
    const blueprint = buildRoadmapBlueprint({
      fullName: profileFields.fullName,
      mainGoal: profileFields.mainGoal,
      currentSkillLevel: profileFields.currentSkillLevel,
      currentSkills: profileFields.currentSkills,
      weakAreas: profileFields.weakAreas,
      availableTimePerDay: profileFields.availableTimePerDay,
      targetTimeline: profileFields.targetTimeline,
      preferredLearningStyle: profileFields.preferredLearningStyle,
      careerTarget: profileFields.careerTarget,
    });
    await RoadmapModel.create({
      user: student._id,
      studentProfile: profile?._id,
      ...blueprint,
      difficulty: blueprint.difficulty as Difficulty,
      status: RoadmapStatus.Active,
      progressPercentage: 0,
      completedWeeks: [],
      completedTasks: [],
    });
  }

  // ── Phase 8 · Flow Studio: seed two demo learning flows so the graph is alive on first run.
  const existingFlow = await FlowModel.findOne({ user: student._id }).exec();
  if (!existingFlow) {
    const mern = buildFlowBlueprint({
      goal: 'Learn the MERN stack and land an internship',
      skillLevel: Difficulty.Beginner,
      currentSkills: profileFields.currentSkills,
      weakAreas: profileFields.weakAreas,
      targetRole: 'Full-stack intern',
      sourceType: 'generated',
    });
    // Mark the first few nodes as completed/available so progress looks lived-in.
    const sorted = [...mern.nodes].sort((a, b) => a.stage - b.stage);
    if (sorted[0]) sorted[0].status = 'completed';
    if (sorted[1]) sorted[1].status = 'completed';
    if (sorted[2]) sorted[2].status = 'in_progress';
    const completed = new Set(
      mern.nodes.filter((n) => n.status === 'completed').map((n) => n.id),
    );
    mern.nodes.forEach((n) => {
      if (n.status === 'completed' || n.status === 'in_progress') return;
      n.status = n.prerequisites.every((p) => completed.has(p))
        ? 'available'
        : 'locked';
    });
    await FlowModel.create({
      user: student._id,
      title: mern.title,
      goal: mern.goal,
      description: mern.description,
      sourceType: 'generated',
      status: 'active',
      difficulty: mern.difficulty,
      nodes: mern.nodes,
      edges: mern.edges,
      timeline: mern.timeline,
      metadata: mern.metadata,
      progressPercentage: Math.round(
        (completed.size / (mern.nodes.length || 1)) * 100,
      ),
    });

    const dsa = buildFlowBlueprint({
      goal: 'Crack DSA interviews in 45 days',
      skillLevel: Difficulty.Intermediate,
      currentSkills: ['JavaScript', 'Problem solving'],
      weakAreas: ['Dynamic programming', 'Graphs'],
      targetRole: 'SDE',
      sourceType: 'generated',
    });
    await FlowModel.create({
      user: student._id,
      title: dsa.title,
      goal: dsa.goal,
      description: dsa.description,
      sourceType: 'generated',
      status: 'active',
      difficulty: dsa.difficulty,
      nodes: dsa.nodes,
      edges: dsa.edges,
      timeline: dsa.timeline,
      metadata: dsa.metadata,
      progressPercentage: 0,
    });
  }

  // ── Phase 8 · Visual Intelligence Studio: seed a few educational visuals.
  const existingVisual = await VisualModel.findOne({
    user: student._id,
  }).exec();
  if (!existingVisual) {
    const demos: {
      concept: string;
      type: import('../modules/visuals/schemas/visual-asset.schema').VisualType;
    }[] = [
      {
        concept: 'How a MERN request flows end to end',
        type: 'sequence_diagram',
      },
      { concept: 'React component lifecycle', type: 'mind_map' },
      { concept: 'Scalable web app architecture', type: 'architecture' },
      { concept: 'SQL vs NoSQL', type: 'comparison' },
    ];
    for (const d of demos) {
      const v = buildVisual({ concept: d.concept, type: d.type });
      await VisualModel.create({
        user: student._id,
        type: v.type,
        title: d.concept,
        prompt: d.concept,
        sourceType: 'manual',
        contentFormat: v.contentFormat,
        content: v.content,
        mermaid: v.mermaid,
        thumbnail: v.thumbnail,
        caption: v.caption,
        howToRead: v.howToRead,
        level: 'beginner',
        status: 'ready',
        provider: 'deterministic',
        metadata: v.metadata,
      });
    }
  }

  // ── Phase 8 · Mistake OS: seed a few logged mistakes so the repair inbox is alive.
  const existingMistake = await MistakeModel.findOne({
    user: student._id,
  }).exec();
  if (!existingMistake) {
    const demos = [
      {
        concept: 'Dynamic programming',
        severity: 82,
        frequency: 3,
        source: 'quiz' as const,
        status: 'open' as const,
        repaired: false,
      },
      {
        concept: 'REST API design',
        severity: 64,
        frequency: 2,
        source: 'quiz' as const,
        status: 'repairing' as const,
        repaired: true,
      },
      {
        concept: 'MongoDB aggregation',
        severity: 58,
        frequency: 2,
        source: 'quiz' as const,
        status: 'open' as const,
        repaired: false,
      },
      {
        concept: 'Deployment & CI/CD',
        severity: 47,
        frequency: 1,
        source: 'project' as const,
        status: 'resolved' as const,
        repaired: false,
      },
    ];
    for (const d of demos) {
      const type = severityToType(d.severity);
      const plan = d.repaired
        ? buildRepairPlan(d.concept, type)
        : { correction: '', actions: [] };
      await MistakeModel.create({
        user: student._id,
        concept: d.concept,
        topic: d.concept,
        mistakeType: type,
        correction: plan.correction,
        severity: d.severity,
        frequency: d.frequency,
        source: d.source,
        status: d.status,
        repairActions: plan.actions,
        lastSeenAt: new Date(),
        resolvedAt: d.status === 'resolved' ? new Date() : undefined,
      });
    }
  }

  // ── Phase 8 · Voice Room: seed one completed voice session so the room isn't empty.
  const existingVoice = await VoiceSessionModel.findOne({
    user: student._id,
  }).exec();
  if (!existingVoice) {
    await VoiceSessionModel.create({
      user: student._id,
      mode: 'tutor',
      title: 'Explain how closures work',
      transcript: [
        {
          role: 'user',
          text: 'Explain how closures work in JavaScript.',
          at: new Date(),
        },
        {
          role: 'assistant',
          text: 'A closure is a function that remembers the variables from the scope where it was created, even after that scope has returned. Can you think of where that memory is useful?',
          at: new Date(),
        },
        {
          role: 'user',
          text: 'Maybe for a counter that keeps its own count?',
          at: new Date(),
        },
        {
          role: 'assistant',
          text: 'Exactly — the inner function keeps a private reference to the count variable. That is the classic closure use case. Want to try writing one?',
          at: new Date(),
        },
      ],
      summary:
        'Voice tutor session covering: how closures work; a counter example.',
      extractedActions: [
        'Follow up on: how closures work',
        'Follow up on: a private counter example',
      ],
      durationMs: 95000,
      status: 'completed',
    });
  }

  // ── Phase 8 · Study Spaces: seed one space with a couple of sources.
  const existingSpace = await StudySpaceModel.findOne({
    user: student._id,
  }).exec();
  if (!existingSpace) {
    await StudySpaceModel.create({
      user: student._id,
      title: 'System Design Basics',
      description: 'Notes and transcripts for the system design round.',
      sources: [
        {
          id: 'src_caching',
          type: 'text',
          title: 'Caching notes',
          text: 'A cache stores hot data closer to the consumer to cut latency. Use a TTL to bound staleness. Cache-aside is the most common pattern: read-through on miss, write to the DB then invalidate the cache.',
          addedAt: new Date(),
        },
        {
          id: 'src_lb',
          type: 'text',
          title: 'Load balancing',
          text: 'A load balancer spreads traffic across servers. Round-robin is simple; least-connections suits long-lived requests. Health checks remove unhealthy nodes.',
          addedAt: new Date(),
        },
      ],
    });
  }

  // ── Phase 8 · Simulation Labs: seed one finished interview simulation.
  const existingSim = await SimulationModel.findOne({
    user: student._id,
  }).exec();
  if (!existingSim) {
    const bp = SIM_BLUEPRINTS.interview;
    await SimulationModel.create({
      user: student._id,
      type: 'interview',
      topic: 'REST API design',
      difficulty: Difficulty.Intermediate,
      role: bp.role,
      scenario: bp.scenario('REST API design'),
      rubric: bp.rubric.map((c) => ({ criterion: c, weight: 1, score: 72 })),
      transcript: [
        { role: 'coach', text: bp.scenario('REST API design'), at: new Date() },
        {
          role: 'user',
          text: 'REST uses resources and HTTP verbs; I would version the API and use proper status codes.',
          at: new Date(),
        },
        {
          role: 'coach',
          text: 'Good. How would you handle pagination and partial failures?',
          at: new Date(),
        },
      ],
      score: 72,
      feedback:
        'Solid performance (72/100). Tighten the weaker rubric areas and retry.',
      improvementPlan: ['Strengthen "Depth" on REST API design.'],
      linkedSkills: ['REST API design'],
      status: 'finished',
    });
  }

  // ── Phase 8 · Course Builder: seed one draft course authored by the mentor.
  if (mentor) {
    const existingCourse = await CourseModel.findOne({
      author: mentor._id,
    }).exec();
    if (!existingCourse) {
      const bp = buildCourseBlueprint(
        'MERN stack for beginners',
        Difficulty.Beginner,
      );
      await CourseModel.create({
        author: mentor._id,
        title: bp.title,
        goal: 'MERN stack for beginners',
        description: bp.description,
        audience: 'First-year students',
        level: Difficulty.Beginner,
        source: 'goal',
        status: 'draft',
        visibility: 'private',
        modules: bp.modules,
        project: bp.project,
        certificateCriteria: bp.certificateCriteria,
      });
    }
  }

  // ── Phase 8 · Peer Rooms: seed one open room hosted by the student.
  const existingRoom = await PeerRoomModel.findOne({
    host: student._id,
  }).exec();
  if (!existingRoom) {
    await PeerRoomModel.create({
      host: student._id,
      title: 'DSA Study Circle',
      topic: 'Dynamic programming',
      code: 'DEMO01',
      members: [
        {
          user: student._id,
          name: 'Aarav Sharma',
          role: 'host',
          joinedAt: new Date(),
        },
      ],
      messages: [
        {
          id: 'msg_seed1',
          name: 'Asta',
          kind: 'system',
          text: 'Room created for "Dynamic programming". Share code DEMO01 to invite peers.',
          at: new Date(),
        },
        {
          id: 'msg_seed2',
          user: student._id,
          name: 'Aarav Sharma',
          kind: 'chat',
          text: 'Anyone want to practice DP problems together this week?',
          at: new Date(),
        },
      ],
      status: 'open',
    });
  }

  // ── Phase 8 · Proof-of-Learning Ledger: seed a few verified events (powers the ledger + replay).
  const existingLedger = await LedgerModel.findOne({
    user: student._id,
  }).exec();
  if (!existingLedger) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const entries = [
      {
        kind: 'node_completed',
        title: 'Completed: JavaScript & ES2023 foundations',
        detail: 'In flow "Learn the MERN stack and land an internship".',
        skills: ['JavaScript'],
        verificationLevel: 'system',
        at: new Date(now - 9 * day),
      },
      {
        kind: 'quiz_passed',
        title: 'Passed quiz: JavaScript basics',
        detail: 'Scored 80% on JavaScript.',
        score: 80,
        skills: ['JavaScript'],
        verificationLevel: 'system',
        at: new Date(now - 8 * day),
      },
      {
        kind: 'node_completed',
        title: 'Completed: React components & hooks',
        detail: 'In flow "Learn the MERN stack and land an internship".',
        skills: ['React'],
        verificationLevel: 'system',
        at: new Date(now - 7 * day),
      },
      {
        kind: 'quiz_passed',
        title: 'Passed quiz: React fundamentals',
        detail: 'Scored 74% on React.',
        score: 74,
        skills: ['React'],
        verificationLevel: 'system',
        at: new Date(now - 6 * day),
      },
      {
        kind: 'project_submitted',
        title: 'Submitted project: MERN Task Tracker',
        detail: 'Full-stack CRUD app with auth.',
        skills: ['React', 'Node', 'MongoDB'],
        verificationLevel: 'self',
        at: new Date(now - 5 * day),
      },
      {
        kind: 'project_ai_reviewed',
        title: 'AI review: MERN Task Tracker',
        detail: 'Overall 78/100 — strong architecture, add tests.',
        score: 78,
        skills: ['React', 'Node'],
        verificationLevel: 'ai',
        at: new Date(now - 5 * day),
      },
      {
        kind: 'simulation_finished',
        title: 'Finished interview: REST API design',
        detail: 'Scored 72/100.',
        score: 72,
        skills: ['REST API design'],
        verificationLevel: 'system',
        at: new Date(now - 4 * day),
      },
      {
        kind: 'voice_viva_passed',
        title: 'Voice viva: explained closures',
        detail: 'Clear explanation, scored 81/100.',
        score: 81,
        skills: ['JavaScript'],
        verificationLevel: 'system',
        at: new Date(now - 3 * day),
      },
      {
        kind: 'mistake_resolved',
        title: 'Resolved: REST API design',
        detail: 'Repaired via micro-quiz + tutor.',
        skills: ['REST API design'],
        verificationLevel: 'system',
        at: new Date(now - 2 * day),
      },
      {
        kind: 'week_completed',
        title: 'Completed week 1',
        detail: 'MERN Stack Developer — next: React fundamentals.',
        verificationLevel: 'system',
        at: new Date(now - 1 * day),
      },
    ] as const;
    for (const e of entries)
      await LedgerModel.create({ user: student._id, ...e });
  }

  // ── Phase 9 · Skill Passport: a published, lived-in passport for the demo student.
  const existingPassport = await SkillPassportModel.findOne({
    user: student._id,
  }).exec();
  if (!existingPassport) {
    await SkillPassportModel.create({
      user: student._id,
      username: `aarav-sharma-${String(student._id).slice(-4)}`,
      headline:
        'Aspiring Full-Stack Developer — building proof one project at a time.',
      targetRole: 'Full Stack Developer',
      visibility: 'public',
      readinessScore: 64,
      publishedAt: new Date(),
      lastComputedAt: new Date(),
    });
  }

  // ── Phase 9 · Skill evidence: a couple of manually-attached artifacts.
  const existingEvidence = await SkillEvidenceModel.findOne({
    user: student._id,
  }).exec();
  if (!existingEvidence) {
    await SkillEvidenceModel.create({
      user: student._id,
      skill: 'React',
      sourceType: 'link',
      summary: 'MERN Task Tracker — deployed demo + repo',
      url: 'https://github.com/example/mern-task-tracker',
      verificationLevel: 'self',
      score: 78,
    });
    await SkillEvidenceModel.create({
      user: student._id,
      skill: 'JavaScript',
      sourceType: 'manual',
      summary: 'Built 20+ vanilla-JS DOM mini-projects',
      verificationLevel: 'self',
    });
  }

  // ── Phase 9 · Career Readiness: target the Full Stack Developer role.
  await CareerReadinessModel.updateOne(
    { user: student._id },
    {
      $set: {
        user: student._id,
        targetRoleId: 'full-stack-developer',
        lastScore: 64,
        lastAnalyzedAt: new Date(),
      },
    },
    { upsert: true },
  );

  // ── Phase 9 · Portfolio: a draft portfolio for the student.
  const existingPortfolio = await PortfolioModel.findOne({
    user: student._id,
  }).exec();
  if (!existingPortfolio) {
    await PortfolioModel.create({
      user: student._id,
      username: `aarav-sharma-${String(student._id).slice(-4)}`,
      title: 'Aarav Sharma — Full Stack Developer',
      tagline:
        'Aspiring Full-Stack Developer — building proof one project at a time.',
      about:
        'Aarav is an aspiring Full Stack Developer building real, verifiable proof of skill across the MERN stack, with a flagship task-tracker project and a growing record of passed assessments.',
      targetRole: 'Full Stack Developer',
      skills: ['JavaScript', 'React', 'Node', 'MongoDB', 'REST API design'],
      projects: [
        {
          projectId: 'demo-mern',
          title: 'MERN Task Tracker',
          caseStudy:
            'A full-stack task tracker with auth and CRUD, built on the MERN stack and AI-reviewed 78/100 for architecture and quality.',
          stack: ['React', 'Node', 'Express', 'MongoDB'],
          highlights: ['JWT auth', 'CRUD API', 'Deployed demo'],
          githubUrl: 'https://github.com/example/mern-task-tracker',
          visible: true,
        },
      ],
      links: [{ label: 'GitHub', url: 'https://github.com/example' }],
      status: 'draft',
    });
  }

  // ── Phase 9 · Mentor Marketplace: a published mentor profile + a requested session.
  if (mentor) {
    const existingMentorProfile = await MentorProfileModel.findOne({
      user: mentor._id,
    }).exec();
    if (!existingMentorProfile) {
      await MentorProfileModel.create({
        user: mentor._id,
        headline: 'Senior Full-Stack Engineer · 6 yrs · ex-startup',
        expertise: ['React', 'Node', 'System Design', 'Interviews'],
        bio: 'I help juniors turn projects into offers — project reviews, mock interviews and portfolio feedback.',
        availability: 'Weekends + async reviews',
        pricingMode: 'free',
        visibility: 'public',
        ratingSummary: { avg: 4.8, count: 12 },
      });
    }
    const existingMentorSession = await MentorSessionModel.findOne({
      student: student._id,
    }).exec();
    if (!existingMentorSession) {
      await MentorSessionModel.create({
        mentor: mentor._id,
        student: student._id,
        type: 'project_review',
        status: 'requested',
        message:
          'Could you review my MERN Task Tracker before I add it to my portfolio?',
        linkedProjectId: 'demo-mern',
      });
    }
  }

  // ── Phase 9 · Marketplace: one published template (by mentor) + one pending (for moderation).
  const existingTemplate = await MarketplaceTemplateModel.findOne().exec();
  if (!existingTemplate && mentor) {
    await MarketplaceTemplateModel.create({
      creator: mentor._id,
      type: 'flow',
      title: 'MERN Internship Sprint (4 weeks)',
      description:
        'A focused 4-week flow from JS foundations to a deployed MERN app — interview-ready.',
      tags: ['mern', 'internship', 'fullstack'],
      level: 'beginner',
      targetRole: 'Full Stack Developer',
      content: {
        goal: 'Learn the MERN stack and land an internship in 4 weeks',
      },
      visibility: 'public',
      status: 'published',
      usageCount: 37,
      ratingSummary: { avg: 4.7, count: 9 },
    });
    await MarketplaceTemplateModel.create({
      creator: mentor._id,
      type: 'interview',
      title: 'Frontend Interview Gauntlet',
      description:
        'A set of frontend interview rounds covering framework internals, CSS and state.',
      tags: ['frontend', 'interview', 'react'],
      level: 'intermediate',
      targetRole: 'Angular Frontend Developer',
      content: { goal: 'Frontend interview prep' },
      visibility: 'public',
      status: 'pending_review',
    });
  }

  // ── Multi-tenant demo (B1): a sample college org with admin as owner + student member.
  if (admin) {
    const slug = 'sreenidhi-college';
    await OrgModel.updateOne(
      { slug },
      {
        $set: {
          name: 'Sreenidhi College',
          slug,
          type: OrgType.College,
          owner: admin._id,
          description:
            'Demo college organization for the multi-tenant SaaS layer.',
          status: 'active',
          plan: 'college',
        },
      },
      { upsert: true },
    );
    const org = await OrgModel.findOne({ slug }).exec();
    if (org) {
      // Org white-label branding (M15).
      const OrgBrandingModel = mongoose.model(
        OrgBranding.name,
        OrgBrandingSchema,
      );
      await OrgBrandingModel.updateOne(
        { org: org._id },
        {
          $set: {
            org: org._id,
            publicName: 'Sreenidhi College',
            accentColor: '#1b6b4f',
            certificateTemplate: 'default',
            supportEmail: 'support@sreenidhi.edu',
          },
        },
        { upsert: true },
      );
      // Developer platform (M11): an API-key stub (hash only) + a webhook endpoint.
      const ApiKeyModel = mongoose.model(ApiKey.name, ApiKeySchema);
      await ApiKeyModel.updateOne(
        { keyHash: createHash('sha256').update('ak_live_seedkey').digest('hex') },
        {
          $set: {
            org: org._id,
            name: 'LMS sync key',
            keyHash: createHash('sha256')
              .update('ak_live_seedkey')
              .digest('hex'),
            prefix: 'ak_live_seed',
            scopes: ['read:students', 'read:certificates'],
            createdBy: String(admin!._id),
          },
        },
        { upsert: true },
      );
      const WebhookEndpointModel = mongoose.model(
        WebhookEndpoint.name,
        WebhookEndpointSchema,
      );
      await WebhookEndpointModel.updateOne(
        { org: org._id, url: 'https://example.edu/webhooks/asta' },
        {
          $set: {
            org: org._id,
            url: 'https://example.edu/webhooks/asta',
            events: ['certificate.issued', 'project.submitted'],
            secret: 'whsec_seedsecret',
            active: true,
          },
        },
        { upsert: true },
      );

      // admin → ORG_ADMIN, student → STUDENT (idempotent).
      await MembershipModel.updateOne(
        { user: admin._id, organization: org._id },
        {
          $set: {
            user: admin._id,
            organization: org._id,
            orgRole: OrgRole.OrgAdmin,
            status: MembershipStatus.Active,
          },
        },
        { upsert: true },
      );
      await MembershipModel.updateOne(
        { user: student._id, organization: org._id },
        {
          $set: {
            user: student._id,
            organization: org._id,
            orgRole: OrgRole.Student,
            status: MembershipStatus.Active,
          },
        },
        { upsert: true },
      );
      if (mentor) {
        await MembershipModel.updateOne(
          { user: mentor._id, organization: org._id },
          {
            $set: {
              user: mentor._id,
              organization: org._id,
              orgRole: OrgRole.Mentor,
              status: MembershipStatus.Active,
            },
          },
          { upsert: true },
        );
        await UserModel.updateOne(
          { _id: mentor._id, primaryOrganization: { $exists: false } },
          { $set: { primaryOrganization: org._id } },
        ).exec();
      }
      const memberCount = await MembershipModel.countDocuments({
        organization: org._id,
        status: MembershipStatus.Active,
      });
      await OrgModel.updateOne(
        { _id: org._id },
        { $set: { memberCount } },
      ).exec();
      await UserModel.updateOne(
        { _id: student._id, primaryOrganization: { $exists: false } },
        { $set: { primaryOrganization: org._id } },
      ).exec();
      // Phase 9 · admin views the Institution outcome layer for this org.
      await UserModel.updateOne(
        { _id: admin._id, primaryOrganization: { $exists: false } },
        { $set: { primaryOrganization: org._id } },
      ).exec();

      // Demo cohort (B3): student enrolled, mentor guiding (idempotent by name within the org).
      await CohortModel.updateOne(
        { organization: org._id, name: 'MERN Fall Cohort' },
        {
          $set: {
            organization: org._id,
            name: 'MERN Fall Cohort',
            description: 'Full-stack MERN track for first-year students.',
            roadmapGoal: 'MERN Developer',
            status: CohortStatus.Active,
            mentors: mentor ? [mentor._id] : [],
            students: [student._id],
            createdBy: admin._id,
          },
          $setOnInsert: {
            announcements: [
              {
                id: randomUUID(),
                title: 'Welcome to the cohort!',
                body: 'Kicking off Week 1 — JS foundations. Post doubts in the dock anytime.',
                authorName: DEMO.mentor.name,
                createdAt: new Date(),
              },
            ],
          },
        },
        { upsert: true },
      );
    }
  }

  // ── Phase 10 (M1/M2/M16): subscriptions, AI usage logs, entitlement meters, flags ──
  const SubscriptionModel = mongoose.model(
    Subscription.name,
    SubscriptionSchema,
  );
  const PaymentTransactionModel = mongoose.model(
    PaymentTransaction.name,
    PaymentTransactionSchema,
  );
  const EntitlementUsageModel = mongoose.model(
    EntitlementUsage.name,
    EntitlementUsageSchema,
  );
  const FeatureFlagModel = mongoose.model(FeatureFlag.name, FeatureFlagSchema);
  const AiUsageLogModel = mongoose.model(AiUsageLog.name, AiUsageLogSchema);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Subscriptions: student on Pro, mentor on Free, admin on Enterprise.
  const subSeed: { user: typeof student._id; planId: string }[] = [
    { user: student._id, planId: 'pro' },
    { user: mentor?._id, planId: 'free' },
    { user: admin!._id, planId: 'enterprise' },
  ].filter((s) => s.user) as { user: typeof student._id; planId: string }[];
  for (const s of subSeed) {
    await SubscriptionModel.updateOne(
      { user: s.user },
      {
        $set: {
          planId: s.planId,
          status: 'active',
          provider: 'mock',
          startedAt: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      { upsert: true },
    );
  }

  // Org-scoped subscription (Institution) so members inherit the plan (org-inheritance).
  const seedOrg = await OrgModel.findOne({ slug: 'sreenidhi-college' }).exec();
  if (seedOrg) {
    await SubscriptionModel.updateOne(
      { org: seedOrg._id },
      {
        $set: {
          org: seedOrg._id,
          user: seedOrg._id, // satisfies the unique `user` index for the org row
          planId: 'institution',
          status: 'active',
          provider: 'mock',
          startedAt: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      { upsert: true },
    );
  }

  // A paid mock invoice for the student's Pro plan.
  await PaymentTransactionModel.updateOne(
    { user: student._id, reference: 'mock_seed_pro' },
    {
      $set: {
        user: student._id,
        planId: 'pro',
        amountInr: planById('pro').priceInr,
        currency: 'INR',
        status: 'paid',
        provider: 'mock',
        reference: 'mock_seed_pro',
      },
    },
    { upsert: true },
  );

  // AI usage history across features (drives cost-by-feature + meters).
  await AiUsageLogModel.deleteMany({ user: student._id });
  const FEATURE_MIX: { feature: string; agentType: string; op: string }[] = [
    { feature: 'tutor', agentType: 'tutor', op: 'tutor.chat' },
    { feature: 'flow', agentType: 'roadmap', op: 'flow.generate' },
    { feature: 'visual', agentType: 'content_creator', op: 'visual.generate' },
    { feature: 'quiz', agentType: 'assessment', op: 'quiz.generate' },
    {
      feature: 'project',
      agentType: 'project_builder',
      op: 'project.generate',
    },
    { feature: 'rag', agentType: 'rag', op: 'rag.answer' },
  ];
  const usageDocs = [];
  for (let d = 0; d < 28; d++) {
    const day = new Date(now.getTime() - d * 86400000);
    const mix = FEATURE_MIX[d % FEATURE_MIX.length];
    const tokensIn = 400 + ((d * 37) % 600);
    const tokensOut = 300 + ((d * 53) % 800);
    usageDocs.push({
      user: student._id,
      agentType: mix.agentType,
      feature: mix.feature,
      provider: 'mock',
      model: 'mock',
      strategy: 'fallback',
      operation: mix.op,
      tokensIn,
      tokensOut,
      costUsd: ((tokensIn + tokensOut) / 1000) * 0.002,
      latencyMs: 600 + ((d * 91) % 1400),
      status: d % 11 === 0 ? 'fallback' : 'success',
      fallbackUsed: d % 11 === 0,
      validationPassed: d % 13 !== 0,
      createdAt: day,
      updatedAt: day,
    });
  }
  await AiUsageLogModel.insertMany(usageDocs);

  // Entitlement meters for the student (Pro plan limits).
  const proPlan = planById('pro');
  const meters: { featureKey: string; used: number }[] = [
    { featureKey: 'ai.messages', used: 340 },
    { featureKey: 'ai.tokens', used: 690_000 },
    { featureKey: 'flow.generations', used: 12 },
    { featureKey: 'visual.generations', used: 8 },
    { featureKey: 'quiz.generations', used: 21 },
    { featureKey: 'project.reviews', used: 4 },
    { featureKey: 'rag.documents', used: 6 },
  ];
  for (const m of meters) {
    await EntitlementUsageModel.updateOne(
      {
        ownerType: 'user',
        ownerId: String(student._id),
        featureKey: m.featureKey,
        periodStart,
      },
      {
        $set: {
          ownerType: 'user',
          ownerId: String(student._id),
          featureKey: m.featureKey,
          periodStart,
          periodEnd,
          resetAt: periodEnd,
          used: m.used,
          limit:
            proPlan.limits[m.featureKey as keyof typeof proPlan.limits] ?? 0,
        },
      },
      { upsert: true },
    );
  }

  // ── Phase 10 (M7/M8/M6): product events, jobs, an example failed job, audit log ──
  const ProductEventModel = mongoose.model(
    ProductEvent.name,
    ProductEventSchema,
  );
  const JobRunModel = mongoose.model(JobRun.name, JobRunSchema);
  const ErrorLogModel = mongoose.model(ErrorLog.name, ErrorLogSchema);
  const AuditLogModel = mongoose.model(AuditLog.name, AuditLogSchema);

  // Product funnel events for the student across the last month.
  await ProductEventModel.deleteMany({ user: student._id });
  const EVENT_SEQ = [
    'signup_completed',
    'onboarding_completed',
    'roadmap_generated',
    'flow_generated',
    'tutor_used',
    'quiz_completed',
    'project_submitted',
    'billing_upgrade_clicked',
    'subscription_started',
    'portfolio_published',
    'user_returned',
  ];
  await ProductEventModel.insertMany(
    EVENT_SEQ.map((event, i) => {
      const at = new Date(now.getTime() - (EVENT_SEQ.length - i) * 2 * 86400000);
      return {
        user: student._id,
        event,
        properties: { plan: 'pro' },
        sessionId: 'seed-session',
        createdAt: at,
        updatedAt: at,
      };
    }),
  );

  // Job ledger: a handful of completed jobs + one failed (retryable) example.
  await JobRunModel.deleteMany({ queue: 'seed' });
  await JobRunModel.insertMany([
    { queue: 'seed', name: 'roadmap.reindex', status: 'completed', attempts: 1, maxAttempts: 3, startedAt: now, finishedAt: now },
    { queue: 'seed', name: 'certificate.render', status: 'completed', attempts: 1, maxAttempts: 3, startedAt: now, finishedAt: now },
    { queue: 'seed', name: 'digest.email', status: 'completed', attempts: 1, maxAttempts: 3, startedAt: now, finishedAt: now },
    { queue: 'seed', name: 'rag.embed', status: 'failed', attempts: 2, maxAttempts: 3, error: 'Embedding provider timed out', startedAt: now, finishedAt: now },
  ]);

  // One sample error log so the Ops error feed isn't empty on a fresh demo.
  await ErrorLogModel.updateOne(
    { errorId: 'seed-error-1' },
    {
      $set: {
        errorId: 'seed-error-1',
        requestId: 'seed-req-1',
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Example: downstream provider unavailable',
        route: '/api/rag/embed',
        method: 'POST',
      },
    },
    { upsert: true },
  );

  // Audit trail example.
  await AuditLogModel.updateOne(
    { action: 'feature_flag.update', targetId: 'ENABLE_IMAGE_GENERATION' },
    {
      $set: {
        actorId: String(admin!._id),
        actorEmail: DEMO.admin.email,
        action: 'feature_flag.update',
        targetType: 'feature_flag',
        targetId: 'ENABLE_IMAGE_GENERATION',
        metadata: { enabled: false },
      },
    },
    { upsert: true },
  );

  // ── Phase 10 (M12): a mock GitHub integration connection for the student ──
  const IntegrationConnectionModel = mongoose.model(
    IntegrationConnection.name,
    IntegrationConnectionSchema,
  );
  await IntegrationConnectionModel.updateOne(
    { user: student._id, provider: 'github' },
    {
      $set: {
        user: student._id,
        provider: 'github',
        status: 'connected',
        metadata: { username: 'aarav-dev' },
        lastSyncAt: now,
      },
    },
    { upsert: true },
  );

  // ── Phase 10 (M6): a couple of active sessions for the student's Security page ──
  const SessionModel = mongoose.model(Session.name, SessionSchema);
  await SessionModel.deleteMany({ user: student._id });
  await SessionModel.insertMany([
    {
      user: student._id,
      device: 'Chrome · macOS',
      ip: '103.21.244.10',
      lastSeenAt: now,
    },
    {
      user: student._id,
      device: 'Safari · iOS',
      ip: '103.21.244.55',
      lastSeenAt: new Date(now.getTime() - 2 * 86400000),
    },
  ]);

  // Feature-flag overrides: keep image generation off (expensive), web push beta on.
  await FeatureFlagModel.updateOne(
    { key: 'ENABLE_IMAGE_GENERATION' },
    { $set: { key: 'ENABLE_IMAGE_GENERATION', enabled: false } },
    { upsert: true },
  );
  await FeatureFlagModel.updateOne(
    { key: 'ENABLE_WEB_PUSH' },
    { $set: { key: 'ENABLE_WEB_PUSH', enabled: true } },
    { upsert: true },
  );

  console.log(`Seeded demo data:
  Admin    → ${DEMO.admin.email} / ${DEMO.admin.password}  (SUPER_ADMIN, platform operator)
  Student  → ${DEMO.student.email} / ${DEMO.student.password}  (member of Sreenidhi College)
  Mentor   → ${DEMO.mentor.email} / ${DEMO.mentor.password}  (MENTOR in Sreenidhi College — sees the student)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
