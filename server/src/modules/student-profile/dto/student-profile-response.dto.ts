import {
  Branch,
  CareerTarget,
  EducationLevel,
  LearningStyle,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../../../common/enums';
import { StudentProfileDocument } from '../schemas/student-profile.schema';

export interface StudentProfileResponse {
  id: string;
  userId: string;
  fullName: string;
  educationLevel: EducationLevel;
  branch: Branch;
  currentSkillLevel: SkillLevel;
  currentSkills: string[];
  weakAreas: string[];
  mainGoal: string;
  availableTimePerDay: TimePerDay;
  targetTimeline: TargetTimeline;
  preferredLearningStyle: LearningStyle;
  preferredLanguage: string;
  careerTarget: CareerTarget;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toStudentProfileResponse(
  doc: StudentProfileDocument,
): StudentProfileResponse {
  return {
    id: doc.id as string,
    userId: doc.user.toString(),
    fullName: doc.fullName,
    educationLevel: doc.educationLevel,
    branch: doc.branch,
    currentSkillLevel: doc.currentSkillLevel,
    currentSkills: doc.currentSkills,
    weakAreas: doc.weakAreas,
    mainGoal: doc.mainGoal,
    availableTimePerDay: doc.availableTimePerDay,
    targetTimeline: doc.targetTimeline,
    preferredLearningStyle: doc.preferredLearningStyle,
    preferredLanguage: doc.preferredLanguage,
    careerTarget: doc.careerTarget,
    onboardingCompleted: doc.onboardingCompleted,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt?.toISOString(),
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt?.toISOString(),
  };
}
