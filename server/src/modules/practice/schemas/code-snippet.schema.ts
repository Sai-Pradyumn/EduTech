import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../practice.types';

/** A single file inside a saved snippet (Free Play is multi-file). */
@Schema({ _id: false })
export class SnippetFile {
  @Prop({ required: true }) name!: string;
  @Prop({ default: '' }) content!: string;
}
const SnippetFileSchema = SchemaFactory.createForClass(SnippetFile);

export type CodeSnippetDocument = HydratedDocument<CodeSnippet>;

/**
 * A learner-saved Free Play snippet — language + one or more files + optional
 * stdin. Lets the studio persist work across sessions (the panel had no save
 * before; closing the tab lost everything).
 */
@Schema({ timestamps: true, collection: 'code_snippets' })
export class CodeSnippet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) title!: string;

  @Prop({ type: String, enum: SUPPORTED_LANGUAGES, required: true })
  language!: SupportedLanguage;

  @Prop({ type: [SnippetFileSchema], default: [] })
  files!: SnippetFile[];

  @Prop({ default: '' }) stdin!: string;
}

export const CodeSnippetSchema = SchemaFactory.createForClass(CodeSnippet);
CodeSnippetSchema.index({ user: 1, updatedAt: -1 });
