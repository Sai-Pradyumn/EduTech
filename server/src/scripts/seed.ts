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
import { Roadmap, RoadmapSchema } from '../modules/roadmap/schemas/roadmap.schema';
import { Organization, OrganizationSchema } from '../modules/tenancy/schemas/organization.schema';
import { Membership, MembershipSchema } from '../modules/tenancy/schemas/membership.schema';
import { Cohort, CohortSchema } from '../modules/cohort/schemas/cohort.schema';
import { buildRoadmapBlueprint } from '../modules/agents/roadmap/roadmap-blueprint.generator';
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
  admin: { name: 'Asta Admin', email: 'admin@asta.dev', password: 'admin12345' },
  student: { name: 'Aarav Sharma', email: 'student@asta.dev', password: 'student12345' },
  mentor: { name: 'Maya Mentor', email: 'mentor@asta.dev', password: 'mentor12345' },
};

async function run(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  const UserModel = mongoose.model(User.name, UserSchema);
  const ProfileModel = mongoose.model(StudentProfile.name, StudentProfileSchema);
  const RoadmapModel = mongoose.model(Roadmap.name, RoadmapSchema);
  const OrgModel = mongoose.model(Organization.name, OrganizationSchema);
  const MembershipModel = mongoose.model(Membership.name, MembershipSchema);
  const CohortModel = mongoose.model(Cohort.name, CohortSchema);

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

  await ProfileModel.updateOne({ user: student._id }, { $set: { user: student._id, ...profileFields } }, { upsert: true });
  const profile = await ProfileModel.findOne({ user: student._id }).exec();

  // Sample roadmap (only if the student has none yet).
  const existingRoadmap = await RoadmapModel.findOne({ user: student._id }).exec();
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
          description: 'Demo college organization for the multi-tenant SaaS layer.',
          status: 'active',
          plan: 'college',
        },
      },
      { upsert: true },
    );
    const org = await OrgModel.findOne({ slug }).exec();
    if (org) {
      // admin → ORG_ADMIN, student → STUDENT (idempotent).
      await MembershipModel.updateOne(
        { user: admin._id, organization: org._id },
        { $set: { user: admin._id, organization: org._id, orgRole: OrgRole.OrgAdmin, status: MembershipStatus.Active } },
        { upsert: true },
      );
      await MembershipModel.updateOne(
        { user: student._id, organization: org._id },
        { $set: { user: student._id, organization: org._id, orgRole: OrgRole.Student, status: MembershipStatus.Active } },
        { upsert: true },
      );
      if (mentor) {
        await MembershipModel.updateOne(
          { user: mentor._id, organization: org._id },
          { $set: { user: mentor._id, organization: org._id, orgRole: OrgRole.Mentor, status: MembershipStatus.Active } },
          { upsert: true },
        );
        await UserModel.updateOne({ _id: mentor._id, primaryOrganization: { $exists: false } }, { $set: { primaryOrganization: org._id } }).exec();
      }
      const memberCount = await MembershipModel.countDocuments({ organization: org._id, status: MembershipStatus.Active });
      await OrgModel.updateOne({ _id: org._id }, { $set: { memberCount } }).exec();
      await UserModel.updateOne({ _id: student._id, primaryOrganization: { $exists: false } }, { $set: { primaryOrganization: org._id } }).exec();

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
              { id: randomUUID(), title: 'Welcome to the cohort!', body: 'Kicking off Week 1 — JS foundations. Post doubts in the dock anytime.', authorName: DEMO.mentor.name, createdAt: new Date() },
            ],
          },
        },
        { upsert: true },
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded demo data:
  Admin    → ${DEMO.admin.email} / ${DEMO.admin.password}  (SUPER_ADMIN, platform operator)
  Student  → ${DEMO.student.email} / ${DEMO.student.password}  (member of Sreenidhi College)
  Mentor   → ${DEMO.mentor.email} / ${DEMO.mentor.password}  (MENTOR in Sreenidhi College — sees the student)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
