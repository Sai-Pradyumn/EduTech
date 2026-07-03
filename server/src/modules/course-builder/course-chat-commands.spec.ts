import { Logger } from '@nestjs/common';
import { ChatCommandRegistryService } from '../agents/core/chat-command-registry.service';
import { ContextEngineService } from '../agents/core/context-engine.service';
import { CourseChatCommands } from './course-chat-commands';
import { CourseBuilderService } from './course-builder.service';

/** Course archive/continue must really act, with an honest undoable confirmation. */

function courses() {
  return [
    {
      _id: 'c1',
      title: 'TypeScript for Backend Developers',
      goal: 'learn typescript',
      status: 'draft',
      publishedAt: undefined,
      modules: [
        {
          id: 'm_0',
          lessons: [
            { id: 'm_0_l0', title: 'Types & interfaces' },
            { id: 'm_0_l1', title: 'Generics in practice' },
          ],
        },
      ],
      completedLessons: ['m_0_l0'],
      lastLessonId: 'm_0_l0',
    },
    {
      _id: 'c2',
      title: 'Watercolor Basics',
      goal: 'painting',
      status: 'archived',
      modules: [],
      completedLessons: [],
    },
  ];
}

function build() {
  const service = {
    list: jest.fn().mockResolvedValue(courses()),
    generate: jest
      .fn()
      .mockImplementation((_u: string, dto: { goal: string }) =>
        Promise.resolve({
          _id: 'cNew',
          title: `${dto.goal} course`,
          modules: [{ id: 'm0', lessons: [{ id: 'l0' }, { id: 'l1' }] }],
        }),
      ),
    setArchived: jest
      .fn()
      .mockImplementation((_u: string, id: string, archived: boolean) => {
        const c = courses().find((x) => x._id === id)!;
        return Promise.resolve({
          ...c,
          status: archived ? 'archived' : 'draft',
        });
      }),
  };
  const contextEngine = {
    invalidate: jest.fn(),
  } as unknown as ContextEngineService & { invalidate: jest.Mock };
  const registry = new ChatCommandRegistryService(contextEngine);
  new CourseChatCommands(
    registry,
    service as unknown as CourseBuilderService,
  ).onModuleInit();
  return { registry, service };
}

describe('CourseChatCommands', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('"archive my typescript course" archives the matching course, undoably', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'archive my typescript course',
    );
    expect(service.setArchived).toHaveBeenCalledWith('u1', 'c1', true);
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('TypeScript for Backend Developers');
    expect(r.undo?.text).toContain('unarchive');
  });

  it('"unarchive my watercolor course" restores from the archived pool', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'unarchive my watercolor course',
    );
    expect(service.setArchived).toHaveBeenCalledWith('u1', 'c2', false);
    expect(r.ok).toBe(true);
  });

  it('"continue my course" routes to the next incomplete lesson', async () => {
    const { registry } = build();
    const [r] = await registry.detectAndExecute('u1', 'continue my course');
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('Generics in practice'); // next incomplete
    expect(r.route).toBe('/app/course-builder/c1');
  });

  it('no matching course → honest failure', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'archive my quantum course',
    );
    expect(r.ok).toBe(false);
    expect(service.setArchived).not.toHaveBeenCalled();
  });

  it('questions never write', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'should I archive my typescript course?',
    );
    expect(results).toEqual([]);
    expect(service.setArchived).not.toHaveBeenCalled();
  });

  it('"create a course on react hooks" generates a REAL course', async () => {
    const { registry, service } = build();
    const [r] = await registry.detectAndExecute(
      'u1',
      'create a course on react hooks',
    );
    expect(service.generate).toHaveBeenCalledWith('u1', {
      goal: 'react hooks',
    });
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('Created a new course');
    expect(r.route).toBe('/app/course-builder/cNew');
    expect(r.affects).toEqual(['course', 'dashboard']);
  });

  it('"can you create a course for me?" is a question → never creates', async () => {
    const { registry, service } = build();
    const results = await registry.detectAndExecute(
      'u1',
      'can you create a course for me?',
    );
    expect(results).toEqual([]);
    expect(service.generate).not.toHaveBeenCalled();
  });
});
