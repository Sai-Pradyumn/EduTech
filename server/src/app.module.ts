import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { ProgressionModule } from './modules/progression/progression.module';
import { FlowsModule } from './modules/flows/flows.module';
import { VisualsModule } from './modules/visuals/visuals.module';
import { MistakesModule } from './modules/mistakes/mistakes.module';
import { SkillTwinModule } from './modules/skill-twin/skill-twin.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { SimulationsModule } from './modules/simulations/simulations.module';
import { DailyPlanModule } from './modules/daily-plan/daily-plan.module';
import { CourseBuilderModule } from './modules/course-builder/course-builder.module';
import { PeerRoomsModule } from './modules/peer-rooms/peer-rooms.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MentorCouncilModule } from './modules/mentor-council/mentor-council.module';
import { ReplayModule } from './modules/replay/replay.module';
import { SkillPassportModule } from './modules/skill-passport/skill-passport.module';
import { CareerReadinessModule } from './modules/career-readiness/career-readiness.module';
import { OutcomeCouncilModule } from './modules/outcome-council/outcome-council.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { InterviewModule } from './modules/interview/interview.module';
import { ResumeModule } from './modules/resume/resume.module';
import { MentorMarketplaceModule } from './modules/mentor-marketplace/mentor-marketplace.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { InstitutionModule } from './modules/institution/institution.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { NudgesModule } from './modules/nudges/nudges.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { OpsModule } from './modules/ops/ops.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiOpsModule } from './modules/ai-ops/ai-ops.module';
import { ProductAnalyticsModule } from './modules/product-analytics/product-analytics.module';
import { PushModule } from './modules/push/push.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { OrgBrandingModule } from './modules/org-branding/org-branding.module';
import { DataGovernanceModule } from './modules/data-governance/data-governance.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SocketsModule } from './sockets/sockets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    OpsModule,
    AuditModule,
    EntitlementsModule,
    FeatureFlagsModule,
    AiModule,
    AiOpsModule,
    ProductAnalyticsModule,
    PushModule,
    SessionsModule,
    OrgBrandingModule,
    DataGovernanceModule,
    DeveloperModule,
    IntegrationsModule,
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
    ProgressionModule,
    FlowsModule,
    VisualsModule,
    MistakesModule,
    SkillTwinModule,
    SpacesModule,
    SimulationsModule,
    DailyPlanModule,
    CourseBuilderModule,
    PeerRoomsModule,
    LedgerModule,
    MentorCouncilModule,
    ReplayModule,
    SkillPassportModule,
    CareerReadinessModule,
    OutcomeCouncilModule,
    PortfolioModule,
    InterviewModule,
    ResumeModule,
    MentorMarketplaceModule,
    MarketplaceModule,
    InstitutionModule,
    PrivacyModule,
    NudgesModule,
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
