import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromptTemplateService } from './prompt-template.service';
import { ResponseValidatorService } from './response-validator.service';
import { FeedbackService } from './feedback.service';
import { AiFeedback, AiFeedbackSchema } from './schemas/ai-feedback.schema';

/** AI quality layer: prompt templates, structured-output validation, feedback. Global. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiFeedback.name, schema: AiFeedbackSchema },
    ]),
  ],
  providers: [PromptTemplateService, ResponseValidatorService, FeedbackService],
  exports: [PromptTemplateService, ResponseValidatorService, FeedbackService],
})
export class AiEvalsModule {}
