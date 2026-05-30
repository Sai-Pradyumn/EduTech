/** Student profile types + option lists, mirroring the server enums. */

export type EducationLevel =
  | 'school'
  | 'diploma'
  | 'btech'
  | 'degree'
  | 'working_professional'
  | 'other';

export type Branch = 'cse' | 'it' | 'ece' | 'eee' | 'mechanical' | 'civil' | 'other';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type TimePerDay = '30min' | '1hour' | '2hours' | '3plus';

export type TargetTimeline = '1month' | '3months' | '6months' | '12months';

export type LearningStyle = 'video' | 'reading' | 'project' | 'practice' | 'mixed';

export type CareerTarget =
  | 'internship'
  | 'fulltime'
  | 'freelancing'
  | 'startup'
  | 'higher_studies'
  | 'skill_improvement';

export interface StudentProfile {
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

export interface CreateStudentProfilePayload {
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
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const EDUCATION_LEVELS: Option<EducationLevel>[] = [
  { value: 'school', label: 'School' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'btech', label: 'B.Tech' },
  { value: 'degree', label: 'Degree' },
  { value: 'working_professional', label: 'Working professional' },
  { value: 'other', label: 'Other' },
];

export const BRANCHES: Option<Branch>[] = [
  { value: 'cse', label: 'CSE' },
  { value: 'it', label: 'IT' },
  { value: 'ece', label: 'ECE' },
  { value: 'eee', label: 'EEE' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'civil', label: 'Civil' },
  { value: 'other', label: 'Other' },
];

export const SKILL_LEVELS: Option<SkillLevel>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const TIME_PER_DAY: Option<TimePerDay>[] = [
  { value: '30min', label: '30 min' },
  { value: '1hour', label: '1 hour' },
  { value: '2hours', label: '2 hours' },
  { value: '3plus', label: '3+ hours' },
];

export const TARGET_TIMELINES: Option<TargetTimeline>[] = [
  { value: '1month', label: '1 month' },
  { value: '3months', label: '3 months' },
  { value: '6months', label: '6 months' },
  { value: '12months', label: '12 months' },
];

export const LEARNING_STYLES: Option<LearningStyle>[] = [
  { value: 'video', label: 'Video-based' },
  { value: 'reading', label: 'Reading-based' },
  { value: 'project', label: 'Project-based' },
  { value: 'practice', label: 'Practice-based' },
  { value: 'mixed', label: 'Mixed' },
];

export const CAREER_TARGETS: Option<CareerTarget>[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'fulltime', label: 'Full-time job' },
  { value: 'freelancing', label: 'Freelancing' },
  { value: 'startup', label: 'Startup' },
  { value: 'higher_studies', label: 'Higher studies' },
  { value: 'skill_improvement', label: 'Skill improvement' },
];

export const LANGUAGES: string[] = ['English', 'Hindi', 'Telugu', 'Hinglish', 'Other'];

export const SUGGESTED_GOALS: string[] = [
  'Become a Java Full Stack Developer',
  'Become a MERN Stack Developer',
  'Become a MEAN Stack Developer',
  'Become a Frontend Developer',
  'Become a Backend Developer',
  'Learn DevOps',
  'Build AI projects',
  'Placement preparation',
  'Interview preparation',
  'Master Data Structures & Algorithms',
];

export const SUGGESTED_SKILLS: string[] = ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Java', 'Python', 'React', 'Angular', 'Node.js', 'SQL', 'Git'];

export const SUGGESTED_WEAK_AREAS: string[] = ['DSA', 'Backend', 'Frontend', 'System Design', 'Communication', 'Deployment', 'Testing', 'Databases'];
