import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

@Schema({ timestamps: true, collection: 'payment_transactions' })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  planId!: string;

  @Prop({ default: 0 })
  amountInr!: number;

  @Prop({ default: 'INR' })
  currency!: string;

  @Prop({ default: 'paid' })
  status!: 'paid' | 'failed' | 'pending';

  @Prop({ default: 'mock' })
  provider!: string;

  /** Mock gateway reference. */
  @Prop({ default: '' })
  reference!: string;
}

export const PaymentTransactionSchema = SchemaFactory.createForClass(PaymentTransaction);
