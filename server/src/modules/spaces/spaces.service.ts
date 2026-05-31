import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType, Difficulty } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { FlowsService } from '../flows/flows.service';
import { AssessmentService } from '../assessment/services/assessment.service';
import { VisualsService } from '../visuals/visuals.service';
import { SpaceArtifactKind, StudySpace, StudySpaceDocument } from './schemas/study-space.schema';
import { AddSourceDto, CreateSpaceDto, UpdateSpaceDto } from './dto/space.dto';

@Injectable()
export class SpacesService {
  constructor(
    @InjectModel(StudySpace.name) private readonly model: Model<StudySpaceDocument>,
    private readonly ai: AiService,
    private readonly flows: FlowsService,
    private readonly assessment: AssessmentService,
    private readonly visuals: VisualsService,
  ) {}

  create(userId: string, dto: CreateSpaceDto): Promise<StudySpaceDocument> {
    return this.model.create({
      user: new Types.ObjectId(userId),
      title: dto.title.trim(),
      description: dto.description ?? '',
    });
  }

  list(userId: string): Promise<StudySpaceDocument[]> {
    return this.model.find({ user: new Types.ObjectId(userId) }).sort({ updatedAt: -1 }).exec();
  }

  async get(userId: string, id: string): Promise<StudySpaceDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Space not found');
    const s = await this.model.findById(id).exec();
    if (!s || s.user.toString() !== userId) throw new NotFoundException('Space not found');
    return s;
  }

  async update(userId: string, id: string, dto: UpdateSpaceDto): Promise<StudySpaceDocument> {
    const s = await this.get(userId, id);
    if (dto.title !== undefined) s.title = dto.title;
    if (dto.description !== undefined) s.description = dto.description;
    return s.save();
  }

  async addSource(userId: string, id: string, dto: AddSourceDto): Promise<StudySpaceDocument> {
    const s = await this.get(userId, id);
    s.sources.push({
      id: `src_${Date.now().toString(36)}_${s.sources.length}`,
      type: dto.type,
      title: dto.title.trim(),
      text: dto.text ?? '',
      url: dto.url,
      ref: dto.ref,
      addedAt: new Date(),
    });
    s.markModified('sources');
    return s.save();
  }

  async removeSource(userId: string, id: string, sourceId: string): Promise<StudySpaceDocument> {
    const s = await this.get(userId, id);
    s.sources = s.sources.filter((x) => x.id !== sourceId);
    return s.save();
  }

  // ───────────────────────── grounded Q&A ─────────────────────────

  async ask(userId: string, id: string, question: string): Promise<{ answer: string; usedSources: string[] }> {
    const s = await this.get(userId, id);
    const context = s.sources
      .filter((src) => src.text)
      .map((src) => `### ${src.title}\n${src.text.slice(0, 1500)}`)
      .join('\n\n');
    if (!context) {
      return { answer: 'This space has no readable sources yet. Add notes, a transcript or pasted text first.', usedSources: [] };
    }
    let answer: string;
    try {
      answer = await this.ai.generateText(
        [
          { role: 'system', content: 'Answer ONLY from the provided sources. Cite the source titles you used. If the answer is not in the sources, say so plainly.' },
          { role: 'user', content: `Sources:\n${context}\n\nQuestion: ${question}` },
        ],
        { meta: { userId, agentType: AgentType.Rag, operation: 'space.ask' }, temperature: 0.3 },
      );
    } catch {
      answer = `Based on your ${s.sources.length} source(s), here is what is relevant to "${question}": ${this.firstSentences(context, 3)}`;
    }
    return { answer, usedSources: s.sources.filter((src) => src.text).map((src) => src.title) };
  }

  // ───────────────────────── artifacts ─────────────────────────

  async summary(userId: string, id: string): Promise<StudySpaceDocument> {
    const s = await this.get(userId, id);
    const md = `## Summary · ${s.title}\n\n${this.deterministicSummary(s)}`;
    this.upsertArtifact(s, 'summary', 'Summary', md);
    return s.save();
  }

  async flashcards(userId: string, id: string): Promise<StudySpaceDocument> {
    const s = await this.get(userId, id);
    const cards = s.sources.slice(0, 8).map((src, i) => `**Q${i + 1}.** What is the key point of "${src.title}"?\n\n> ${this.firstSentences(src.text || src.title, 1)}`);
    const md = `## Flashcards · ${s.title}\n\n${cards.join('\n\n') || '_Add sources to generate flashcards._'}`;
    this.upsertArtifact(s, 'flashcards', 'Flashcards', md);
    return s.save();
  }

  async audioOverview(userId: string, id: string): Promise<{ space: StudySpaceDocument; script: string }> {
    const s = await this.get(userId, id);
    const script = `Welcome to your audio overview of ${s.title}. ${this.deterministicSummary(s)} That's the overview — open the space to go deeper.`;
    this.upsertArtifact(s, 'audio_overview', 'Audio overview script', script);
    await s.save();
    return { space: s, script };
  }

  // ───────────────────────── cross-module generators ─────────────────────────

  async createFlow(userId: string, id: string): Promise<{ space: StudySpaceDocument; flowId: string }> {
    const s = await this.get(userId, id);
    const flow = await this.flows.generate(userId, { goal: `Learn ${s.title}` });
    if (!s.linkedFlowIds.includes(String(flow._id))) s.linkedFlowIds.push(String(flow._id));
    await s.save();
    return { space: s, flowId: String(flow._id) };
  }

  async createQuiz(userId: string, id: string): Promise<{ space: StudySpaceDocument; quizId: string }> {
    const s = await this.get(userId, id);
    const quiz = await this.assessment.generate(userId, { source: 'topic', topic: s.title.slice(0, 110), difficulty: Difficulty.Intermediate });
    if (!s.linkedQuizIds.includes(String(quiz._id))) s.linkedQuizIds.push(String(quiz._id));
    await s.save();
    return { space: s, quizId: String(quiz._id) };
  }

  async createVisual(userId: string, id: string): Promise<{ space: StudySpaceDocument; visualId: string }> {
    const s = await this.get(userId, id);
    const visual = await this.visuals.generate(userId, { concept: s.title, type: 'concept_graph', sourceType: 'knowledge', sourceId: id });
    if (!s.linkedVisualIds.includes(String(visual._id))) s.linkedVisualIds.push(String(visual._id));
    await s.save();
    return { space: s, visualId: String(visual._id) };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const s = await this.get(userId, id);
    await s.deleteOne();
    return { ok: true };
  }

  // ───────────────────────── helpers ─────────────────────────

  private upsertArtifact(s: StudySpaceDocument, kind: SpaceArtifactKind, title: string, content: string): void {
    const existing = s.artifacts.find((a) => a.kind === kind);
    if (existing) {
      existing.content = content;
      existing.createdAt = new Date();
    } else {
      s.artifacts.push({ id: `art_${kind}_${Date.now().toString(36)}`, kind, title, content, createdAt: new Date() });
    }
    s.markModified('artifacts');
  }

  private deterministicSummary(s: StudySpaceDocument): string {
    if (!s.sources.length) return 'This space is empty — add sources to summarize.';
    const points = s.sources.slice(0, 6).map((src) => `- **${src.title}**: ${this.firstSentences(src.text || src.title, 1)}`);
    return `This space pulls together ${s.sources.length} source(s):\n\n${points.join('\n')}`;
  }

  private firstSentences(text: string, n: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '(no text)';
    const parts = clean.split(/(?<=[.!?])\s/).slice(0, n).join(' ');
    return parts.slice(0, 240);
  }
}
