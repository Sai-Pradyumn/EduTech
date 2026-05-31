import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces';
import { BillingService } from './services/billing.service';
import {
  ChangePlanDto,
  CheckoutDto,
  VerifyPaymentDto,
} from './dto/billing.dto';

/** Billing & metering (Phase 4 · B5/B6 → Phase 10 · M1): plans, checkout, subscription,
 *  plan changes, invoices, AI usage breakdown + admin billing overview. */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.billing.plans();
  }

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getSubscription(user.id);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.billing.usageThisPeriod(user.id);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthUser) {
    return this.billing.listTransactions(user.id);
  }

  /** Alias of transactions — invoice history. */
  @Get('invoices')
  invoices(@CurrentUser() user: AuthUser) {
    return this.billing.listTransactions(user.id);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user.id, dto.planId);
  }

  /** Explicit mock checkout endpoint (kept distinct from a future provider redirect flow). */
  @Post('checkout/mock')
  checkoutMock(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user.id, dto.planId);
  }

  @Post('change-plan')
  changePlan(@CurrentUser() user: AuthUser, @Body() dto: ChangePlanDto) {
    return this.billing.changePlan(user.id, dto.planId);
  }

  /** Verify a client-completed (Razorpay) payment + activate the plan. */
  @Post('verify')
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) {
    return this.billing.verifyAndActivate(user.id, {
      planId: dto.planId,
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      signature: dto.signature,
    });
  }

  /** Provider webhook (Razorpay). Public + raw-body HMAC-verified; idempotent activation. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook/razorpay')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    return this.billing.handleWebhook(raw, signature);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.billing.cancel(user.id);
  }

  @Roles(Role.Admin)
  @Get('admin/overview')
  adminOverview() {
    return this.billing.adminOverview();
  }

  @Roles(Role.Admin)
  @Get('admin/accounts')
  adminAccounts() {
    return this.billing.adminAccounts();
  }
}
