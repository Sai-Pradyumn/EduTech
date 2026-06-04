import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { IngestionService } from './services/ingestion.service';
import { KnowledgeService } from './services/knowledge.service';
import { KnowledgeQaService } from './services/knowledge-qa.service';
import { RagAnswerService } from './services/rag-answer.service';
import {
  AskDto,
  SaveQaDto,
  UpdateDocumentDto,
  UploadTextDto,
} from './dto/knowledge.dto';

/** Minimal shape of a Multer file (avoids a hard @types/multer dependency). */
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = /(^text\/)|pdf|json|markdown|octet-stream|wordprocessingml/i;

/** Knowledge Hub REST surface. Grounded answers also stream through the Agent OS
 *  (RAG agent) over Socket.IO; this `ask` endpoint is the non-streaming convenience. */
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly knowledge: KnowledgeService,
    private readonly ragAnswer: RagAnswerService,
    private readonly qa: KnowledgeQaService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: { title?: string },
  ) {
    if (!file)
      throw new BadRequestException(
        'No file uploaded (field name must be "file").',
      );
    if (file.size > MAX_BYTES)
      throw new BadRequestException('File exceeds the 10 MB limit.');
    if (
      !ALLOWED.test(file.mimetype) &&
      !/\.(txt|md|markdown|json|pdf|docx)$/i.test(file.originalname)
    ) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype || file.originalname}.`,
      );
    }
    const result = await this.ingestion.ingest({
      userId: user.id,
      title: (body.title?.trim() || file.originalname).slice(0, 200),
      source: 'upload',
      mimeType: file.mimetype,
      filename: file.originalname,
      buffer: file.buffer,
    });
    return result;
  }

  @Post('text')
  async uploadText(@CurrentUser() user: AuthUser, @Body() dto: UploadTextDto) {
    return this.ingestion.ingest({
      userId: user.id,
      title: dto.title.trim(),
      source: 'text',
      mimeType: 'text/markdown',
      rawText: dto.content,
    });
  }

  @Get('documents')
  list(@CurrentUser() user: AuthUser) {
    return this.knowledge.list(user.id);
  }

  @Get('documents/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.knowledge.get(user.id, id);
  }

  @Patch('documents/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.knowledge.update(user.id, id, dto);
  }

  @Delete('documents/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.knowledge.remove(user.id, id);
    return { ok: true };
  }

  @Get('documents/:id/summary')
  summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.knowledge.summary(user.id, id);
  }

  @Get('documents/:id/flashcards')
  flashcards(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.knowledge.flashcards(user.id, id);
  }

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto) {
    return this.ragAnswer.answer(dto.question, {
      userId: user.id,
      documentIds: dto.documentIds,
    });
  }

  // ── grounded Q&A history (syncs the Hub transcript across devices) ──
  @Get('qa')
  listQa(@CurrentUser() user: AuthUser) {
    return this.qa.list(user.id);
  }

  @Post('qa')
  saveQa(@CurrentUser() user: AuthUser, @Body() dto: SaveQaDto) {
    return this.qa.save(user.id, dto);
  }

  @Delete('qa')
  clearQa(@CurrentUser() user: AuthUser) {
    return this.qa.clear(user.id);
  }
}
