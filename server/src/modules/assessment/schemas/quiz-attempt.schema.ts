import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class QuestionResult {
  @Prop({ required: true }) questionIndex!: number;
  @Prop({ required: true }) topic!: string;
  @Prop() answerIndex?: number;
  @Prop({ default: '' }) text!: string;
  @Prop({ required: true }) correct!: boolean;
  @Prop({ default: 0 }) earned!: number;
  @Prop({ default: 1 }) points!: number;
}
const QuestionResultSchema = SchemaFactory.createForClass(QuestionResult);

@Schema({ _id: false })
export class TopicScore {
  @Prop({ required: true }) topic!: string;
  @Prop({ required: true }) correct!: number;
  @Prop({ required: true }) total!: number;
  @Prop({ required: true }) severity!: number; // 0..100 weakness severity
}
const TopicScoreSchema = SchemaFactory.createForClass(TopicScore);

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

@Schema({ timestamps: true, collection: 'quiz_attempts' })
export class QuizAttempt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true, index: true })
  quiz!: Types.ObjectId;

  @Prop({ default: 0 })
  score!: number; // 0..100

  @Prop({ default: 0 })
  correctCount!: number;

  @Prop({ default: 0 })
  total!: number;

  @Prop({ type: [QuestionResultSchema], default: [] })
  results!: QuestionResult[];

  @Prop({ type: [TopicScoreSchema], default: [] })
  topicScores!: TopicScore[];

  @Prop({ type: [String], default: [] })
  weakTopics!: string[];

  @Prop({ default: '' })
  feedback!: string;

  @Prop({ default: 0 })
  durationMs!: number;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
QuizAttemptSchema.index({ user: 1, createdAt: -1 });
