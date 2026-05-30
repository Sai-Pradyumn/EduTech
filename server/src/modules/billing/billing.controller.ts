import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { BillingService } from './services/billing.service';
import { CheckoutDto } from './dto/billing.dto';

/** Billing & metering (Phase 4 · B5/B6): plans, mock checkout, subscription + AI usage. */
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

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user.id, dto.planId);
  }
}
