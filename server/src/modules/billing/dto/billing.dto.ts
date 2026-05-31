import { IsIn } from 'class-validator';
import { PlanId } from '../plans';

const PLAN_IDS: PlanId[] = ['free', 'pro', 'team', 'institution', 'enterprise'];

export class CheckoutDto {
  @IsIn(PLAN_IDS)
  planId!: PlanId;
}

export class ChangePlanDto {
  @IsIn(PLAN_IDS)
  planId!: PlanId;
}
