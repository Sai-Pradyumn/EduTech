import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { StudentProfileModule } from './modules/student-profile/student-profile.module';
import { AiModule } from './modules/ai/ai.module';
import { AiEvalsModule } from './modules/ai-evals/ai-evals.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RagModule } from './modules/rag/rag.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { LearningIntelligenceModule } from './modules/learning-intelligence/learning-intelligence.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { CohortModule } from './modules/cohort/cohort.module';
import { LiveSessionModule } from './modules/live-session/live-session.module';
import { CommunityModule } from './modules/community/community.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FounderModule } from './modules/founder/founder.module';
import { AdminModule } from './modules/admin/admin.module';
import { VoiceModule } from './modules/voice/voice.module';
import { FineTuningModule } from './modules/fine-tuning/fine-tuning.module';
import { AgentGraphModule } from './modules/agent-graph/agent-graph.module';
import { BillingModule } from './modules/billing/billing.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { SocketsModule } from './sockets/sockets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    DatabaseModule,
    AiModule,
    AiEvalsModule,
    AgentsModule,
    RagModule,
    AssessmentModule,
    ProjectsModule,
    LearningIntelligenceModule,
    MentorModule,
    CohortModule,
    LiveSessionModule,
    CommunityModule,
    ReportsModule,
    FounderModule,
    AdminModule,
    VoiceModule,
    FineTuningModule,
    AgentGraphModule,
    BillingModule,
    CertificatesModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    TenancyModule,
    StudentProfileModule,
    RoadmapModule,
    SocketsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
