import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Permission } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { UsersService } from '../users/users.service';
import { CommunityService } from './services/community.service';
import {
  CreateChannelDto,
  CreateReplyDto,
  CreateThreadDto,
} from './dto/community.dto';

/**
 * Community surface (Phase 4 · B9). All routes require OrgView (every org member has it),
 * so students can read + post; OrgManage holders moderate (delete any thread/reply).
 * Tenant-isolated via `assertOrg`. AI moderation / duplicate detection is 🧱 / future.
 */
@Controller('community')
@Permissions(Permission.OrgView)
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly users: UsersService,
  ) {}

  @Get('channels')
  channels(@CurrentOrg() ctx: OrgContext) {
    return this.community.listChannels(this.orgOrThrow(ctx));
  }

  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  createChannel(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Body() dto: CreateChannelDto,
  ) {
    return this.community.createChannel(this.orgOrThrow(ctx), user.id, dto);
  }

  @Get('channels/:id/threads')
  async threads(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') channelId: string,
  ) {
    await this.assertChannelOrg(ctx, channelId);
    return this.community.listThreads(channelId, user.id);
  }

  @Post('threads')
  @HttpCode(HttpStatus.CREATED)
  async createThread(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Body() dto: CreateThreadDto,
  ) {
    await this.assertChannelOrg(ctx, dto.channelId);
    const author = await this.users.findByIdOrThrow(user.id);
    return this.community.createThread(
      this.orgOrThrow(ctx),
      user.id,
      author.name,
      dto,
    );
  }

  @Get('threads/:id')
  async thread(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    await this.assertThreadOrg(ctx, id);
    return this.community.getThread(id, user.id);
  }

  @Post('threads/:id/upvote')
  async upvoteThread(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    await this.assertThreadOrg(ctx, id);
    return this.community.toggleThreadUpvote(id, user.id);
  }

  @Delete('threads/:id')
  async deleteThread(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    await this.assertThreadOrg(ctx, id);
    return this.community.deleteThread(id, user.id, this.canModerate(ctx));
  }

  @Post('threads/:id/replies')
  @HttpCode(HttpStatus.CREATED)
  async reply(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
    @Body() dto: CreateReplyDto,
  ) {
    await this.assertThreadOrg(ctx, id);
    const author = await this.users.findByIdOrThrow(user.id);
    return this.community.addReply(id, user.id, author.name, dto.body);
  }

  @Post('replies/:id/upvote')
  upvoteReply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.toggleReplyUpvote(id, user.id);
  }

  @Post('replies/:id/accept')
  acceptAnswer(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    return this.community.acceptAnswer(id, user.id, this.canModerate(ctx));
  }

  @Delete('replies/:id')
  deleteReply(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Param('id') id: string,
  ) {
    return this.community.deleteReply(id, user.id, this.canModerate(ctx));
  }

  // ── isolation helpers ──────────────────────────────────────────────────────
  private orgOrThrow(ctx: OrgContext): string {
    if (!ctx.organizationId)
      throw new BadRequestException('Select an organization (x-org-id) first.');
    return ctx.organizationId;
  }

  private canModerate(ctx: OrgContext): boolean {
    return ctx.isPlatform || ctx.permissions.includes(Permission.OrgManage);
  }

  private async assertChannelOrg(
    ctx: OrgContext,
    channelId: string,
  ): Promise<void> {
    if (ctx.isPlatform) return;
    const orgId = await this.community.orgIdOfChannel(channelId);
    if (ctx.organizationId !== orgId)
      throw new ForbiddenException('You do not have access to this channel.');
  }

  private async assertThreadOrg(
    ctx: OrgContext,
    threadId: string,
  ): Promise<void> {
    if (ctx.isPlatform) return;
    const orgId = await this.community.orgIdOfThread(threadId);
    if (ctx.organizationId !== orgId)
      throw new ForbiddenException('You do not have access to this thread.');
  }
}
