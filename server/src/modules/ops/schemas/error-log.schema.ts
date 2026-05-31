import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ErrorLogDocument = HydratedDocument<ErrorLog>;

/** Server-side error record (Phase 10 · M7). 5xx failures are persisted with a stable
 *  errorId + requestId so the admin error page can surface them without leaking stacks. */
@Schema({ timestamps: true, collection: 'error_logs' })
export class ErrorLog {
  @Prop({ required: true, index: true })
  errorId!: string;

  @Prop({ index: true })
  requestId?: string;

  @Prop({ default: 500 })
  status!: number;

  @Prop({ default: 'INTERNAL_ERROR' })
  code!: string;

  @Prop({ required: true })
  message!: string;

  @Prop()
  route?: string;

  @Prop()
  method?: string;

  @Prop()
  userId?: string;

  @Prop()
  stack?: string;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);
ErrorLogSchema.index({ createdAt: -1 });
