import { IsIn } from 'class-validator';
import { PlanId } from '../plans';

export class CheckoutDto {
  @IsIn(['free', 'pro', 'team'])
  planId!: PlanId;
}
