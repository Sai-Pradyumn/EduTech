import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Difficulty, QuestionType } from '../../../common/enums';

/** Where the quiz was generated from — drives the generator + recommendations. */
export type QuizSource = 'topic' | 'document' | 'weak_area' | 'roadmap';

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ type: String, enum: QuestionType, default: QuestionType.Mcq })
  type!: QuestionType;

  @Prop({ required: true })
  prompt!: string;

  /** MCQ options; empty for short_answer/coding. */
  @Prop({ type: [String], default: [] })
  options!: string[];

  /** Correct option index for MCQ. */
  @Prop()
  answerIndex?: number;

  /** Reference answer for short_answer/coding (used to grade + show). */
  @Prop({ default: '' })
  modelAnswer!: string;

  /** Key terms a correct free-text answer should contain (keyword grading). */
  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ default: '' })
  explanation!: string;

  @Prop({ default: 'general' })
  topic!: string;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;

  @Prop({ default: 1 })
  points!: number;

  /** Citation locator when the question was grounded in a document chunk. */
  @Prop()
  source?: string;
}
const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

export type QuizDocument = HydratedDocument<Quiz>;

@Schema({ timestamps: true, collection: 'quizzes' })
export class Quiz {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: 'general' })
  topic!: string;

  @Prop({ type: String, enum: ['topic', 'document', 'weak_area', 'roadmap'], default: 'topic' })
  source!: QuizSource;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty!: Difficulty;

  @Prop({ type: [QuizQuestionSchema], default: [] })
  questions!: QuizQuestion[];

  @Prop({ type: Types.ObjectId, ref: 'KnowledgeDocument' })
  documentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Roadmap' })
  roadmapId?: Types.ObjectId;

  @Prop({ default: 0 })
  attemptCount!: number;

  @Prop()
  bestScore?: number;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ user: 1, createdAt: -1 });
