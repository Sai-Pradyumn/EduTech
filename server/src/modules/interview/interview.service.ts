import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { LedgerService } from '../ledger/ledger.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { findRole, matchRoleFromGoal } from '../career-readiness/career-roles';
import {
  InterviewSession,
  InterviewSessionDocument,
} from './schemas/interview-session.schema';
import {
  buildQuestions,
  INTERVIEW_TYPE_META,
  InterviewType,
} from './interview-bank';
import { InterviewCoachAgent } from './interview.agent';

/**
 * Phase 9 · Interview OS — runs a mock interview grounded in the learner's target role: generates
 * questions, scores each answer (InterviewCoachAgent), produces a final report, records a verified
 * ledger event (which feeds Career Readiness) and pushes weak areas into Mistake OS.
 */
@Injectable()
export class InterviewService {
  constructor(
    @InjectModel(InterviewSession.name)
    private readonly model: Model<InterviewSessionDocument>,
    private readonly coach: InterviewCoachAgent,
    private readonly ledger: LedgerService,
    private readonly mistakes: MistakesService,
    private readonly profiles: StudentProfileService,
  ) {}

  async start(
    userId: string,
    type: InterviewType,
    roleId?: string,
  ): Promise<InterviewSessionDocument> {
    const profile = await this.profiles.findByUser(userId);
    const role = roleId
      ? (findRole(roleId)?.title ?? '')
      : matchRoleFromGoal(profile?.mainGoal ?? '').title;
    const questions = buildQuestions(type, role).map((q) => ({
      id: randomUUID(),
      question: q,
      answer: '',
      feedback: '',
      answered: false,
    }));
    return this.model.create({
      user: new Types.ObjectId(userId),
      type,
      role,
      questions,
      currentIndex: 0,
      status: 'active',
    });
  }

  async respond(
    userId: string,
    sessionId: string,
    answer: string,
  ): Promise<InterviewSessionDocument> {
    const session = await this.owned(userId, sessionId);
    if (session.status === 'finished')
      throw new BadRequestException('This interview is already finished.');
    const q = session.questions[session.currentIndex];
    if (!q)
      throw new BadRequestException(
        'No more questions — finish the interview.',
      );
    const scored = await this.coach.scoreAnswer(userId, q.question, answer);
    q.answer = answer;
    q.score = scored.score;
    q.feedback = scored.feedback;
    q.answered = true;
    session.currentIndex = Math.min(
      session.currentIndex + 1,
      session.questions.length,
    );
    session.markModified('questions');
    await session.save();
    return session;
  }

  /** Move past the current question without answering it (leaves it unscored). */
  async skip(
    userId: string,
    sessionId: string,
  ): Promise<InterviewSessionDocument> {
    const session = await this.owned(userId, sessionId);
    if (session.status === 'finished')
      throw new BadRequestException('This interview is already finished.');
    if (!session.questions[session.currentIndex])
      throw new BadRequestException(
        'No more questions — finish the interview.',
      );
    session.currentIndex = Math.min(
      session.currentIndex + 1,
      session.questions.length,
    );
    await session.save();
    return session;
  }

  async finish(
    userId: string,
    sessionId: string,
  ): Promise<InterviewSessionDocument> {
    const session = await this.owned(userId, sessionId);
    if (session.status === 'finished') return session;
    const answered = session.questions.filter(
      (q) => q.answered && typeof q.score === 'number',
    );
    const avg = answered.length
      ? Math.round(
          answered.reduce((s, q) => s + (q.score ?? 0), 0) / answered.length,
        )
      : 0;
    const completion = Math.round(
      (answered.length / Math.max(1, session.questions.length)) * 100,
    );

    session.technicalScore = avg;
    session.communicationScore = clamp(
      Math.round(avg * 0.9 + completion * 0.1),
    );
    session.confidenceScore = clamp(Math.round(completion * 0.5 + avg * 0.5));
    session.overallScore = clamp(
      Math.round(
        session.technicalScore * 0.5 +
          session.communicationScore * 0.25 +
          session.confidenceScore * 0.25,
      ),
    );

    session.strengths = answered
      .filter((q) => (q.score ?? 0) >= 75)
      .map((q) => this.shortLabel(q.question))
      .slice(0, 3);
    const weak = answered
      .filter((q) => (q.score ?? 0) < 60)
      .map((q) => this.shortLabel(q.question));
    session.weakConcepts = weak.slice(0, 4);
    const passed = session.overallScore >= 70;
    session.summary =
      `${INTERVIEW_TYPE_META[session.type].label} interview — scored ${session.overallScore}/100 ` +
      `(technical ${session.technicalScore}, communication ${session.communicationScore}, confidence ${session.confidenceScore}). ` +
      (passed
        ? 'Strong performance — you cleared the bar.'
        : 'Below the bar — drill the weak areas and retry.');
    session.status = 'finished';
    session.finishedAt = new Date();
    session.markModified('questions');
    await session.save();

    // Feed the outcome graph: ledger event (drives Career Readiness) + weak areas into Mistake OS.
    await this.ledger.record(userId, {
      kind: passed ? 'interview_passed' : 'interview_completed',
      title: `${INTERVIEW_TYPE_META[session.type].label} interview: ${session.role || 'practice'}`,
      detail: session.summary,
      score: session.overallScore,
      skills: session.role ? [session.role] : [],
      verificationLevel: 'system',
    });
    for (const concept of session.weakConcepts) {
      await this.mistakes
        .captureManual(userId, {
          concept: `Interview: ${concept}`,
          severity: 62,
          source: 'manual',
        })
        .catch(() => undefined);
    }
    return session;
  }

  list(userId: string): Promise<InterviewSessionDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(40)
      .exec();
  }

  get(userId: string, id: string): Promise<InterviewSessionDocument> {
    return this.owned(userId, id);
  }

  private async owned(
    userId: string,
    id: string,
  ): Promise<InterviewSessionDocument> {
    const session = await this.model
      .findOne({
        _id: new Types.ObjectId(id),
        user: new Types.ObjectId(userId),
      })
      .exec();
    if (!session) throw new NotFoundException('Interview session not found');
    return session;
  }

  private shortLabel(q: string): string {
    const cleaned = q
      .replace(/[?.].*$/, '')
      .replace(
        /^(tell me about|how do you|how would you|explain|describe|walk me through|what'?s|what is|design)\s+/i,
        '',
      );
    const words = cleaned.split(/\s+/).slice(0, 6).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
