import { BillingService } from './billing.service';
import { PaymentProvider } from '../providers/payment-provider.interface';

/**
 * The billing service is the money path: it must activate a plan exactly when a payment is
 * proven (mock instant, Razorpay signature, or a verified webhook), never on an unverified
 * one, and stay idempotent so a replayed webhook can't double-charge or double-activate.
 */
const UID = '507f1f77bcf86cd799439012';

interface QueryMock {
  lean: () => QueryMock;
  sort: () => QueryMock;
  limit: () => QueryMock;
  populate: () => QueryMock;
  exec: () => Promise<unknown>;
}

/** Chainable Mongoose query stub supporting the shapes the service uses. */
function q(result: unknown): QueryMock {
  const self: QueryMock = {
    lean: () => self,
    sort: () => self,
    limit: () => self,
    populate: () => self,
    exec: () => Promise.resolve(result),
  };
  return self;
}

function build(over: {
  subs?: Record<string, unknown>;
  txns?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  payment?: Partial<PaymentProvider>;
}): { svc: BillingService; payment: PaymentProvider } {
  const payment = {
    name: 'mock',
    isLive: false,
    createCheckout: jest.fn(),
    cancel: jest.fn().mockResolvedValue({ status: 'cancelled' }),
    verifyPayment: jest.fn().mockReturnValue(true),
    verifyWebhook: jest.fn().mockReturnValue({ verified: false }),
    ...over.payment,
  } as unknown as PaymentProvider;
  const svc = new BillingService(
    (over.subs ?? {}) as never,
    (over.txns ?? {}) as never,
    (over.usage ?? {}) as never,
    {} as never,
    payment,
  );
  return { svc, payment };
}

/** A resolved subscription doc as getSubscription reads it. */
function subDoc(planId = 'pro') {
  return {
    planId,
    status: 'active',
    provider: 'mock',
    startedAt: new Date(),
  };
}

describe('BillingService', () => {
  it('checkout via an instant provider records a paid txn and activates the plan', async () => {
    const create = jest.fn().mockResolvedValue({ _id: 'txn1' });
    const findOneAndUpdate = jest.fn(() => q({}));
    const findOne = jest.fn(() => q(subDoc('pro')));
    const { svc } = build({
      subs: { findOne, findOneAndUpdate },
      txns: { create },
      payment: {
        createCheckout: jest.fn().mockResolvedValue({
          provider: 'mock',
          reference: 'mock_1',
          status: 'paid',
          checkoutUrl: '',
          amountInr: 499,
          currency: 'INR',
        }),
      },
    });
    const res = await svc.checkout(UID, 'pro');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ planId: 'pro', status: 'paid' }),
    );
    expect(findOneAndUpdate).toHaveBeenCalled(); // plan activated
    expect(res.transaction.status).toBe('paid');
    expect(res.razorpay).toBeUndefined();
    expect(res.checkoutUrl).toBeUndefined();
  });

  it('checkout via a pending provider returns widget handles and does not activate yet', async () => {
    const create = jest.fn().mockResolvedValue({ _id: 'txn2' });
    const findOneAndUpdate = jest.fn(() => q({}));
    const findOne = jest.fn(() => q(subDoc('free')));
    const { svc } = build({
      subs: { findOne, findOneAndUpdate },
      txns: { create },
      payment: {
        name: 'razorpay',
        isLive: true,
        createCheckout: jest.fn().mockResolvedValue({
          provider: 'razorpay',
          reference: 'order_1',
          orderId: 'order_1',
          keyId: 'rzp_key',
          status: 'pending',
          checkoutUrl: '',
          amountInr: 499,
          currency: 'INR',
        }),
      },
    });
    const res = await svc.checkout(UID, 'pro');
    expect(findOneAndUpdate).not.toHaveBeenCalled(); // wait for verify/webhook
    expect(res.razorpay).toEqual(
      expect.objectContaining({ orderId: 'order_1', keyId: 'rzp_key' }),
    );
  });

  it('verifyAndActivate does not activate when the signature is invalid', async () => {
    const findOneAndUpdate = jest.fn(() => q({}));
    const updateOne = jest.fn(() => q({}));
    const findOne = jest.fn(() => q(subDoc('free')));
    const { svc } = build({
      subs: { findOne, findOneAndUpdate },
      txns: { updateOne },
      payment: {
        name: 'razorpay',
        isLive: true,
        verifyPayment: jest.fn().mockReturnValue(false),
      },
    });
    const r = await svc.verifyAndActivate(UID, {
      planId: 'pro',
      orderId: 'o',
      paymentId: 'p',
      signature: 'bad',
    });
    expect(r.ok).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('verifyAndActivate marks the txn paid and activates on a valid signature', async () => {
    const findOneAndUpdate = jest.fn(() => q({}));
    const updateOne = jest.fn(() => q({}));
    const findOne = jest.fn(() => q(subDoc('pro')));
    const { svc } = build({
      subs: { findOne, findOneAndUpdate },
      txns: { updateOne },
      payment: {
        name: 'razorpay',
        isLive: true,
        verifyPayment: jest.fn().mockReturnValue(true),
      },
    });
    const r = await svc.verifyAndActivate(UID, {
      planId: 'pro',
      orderId: 'order_1',
      paymentId: 'p',
      signature: 'good',
    });
    expect(r.ok).toBe(true);
    expect(updateOne).toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();
  });

  it('handleWebhook ignores an unverified payload', async () => {
    const findOne = jest.fn(() => q(null));
    const { svc } = build({
      txns: { findOne },
      payment: {
        verifyWebhook: jest.fn().mockReturnValue({ verified: false }),
      },
    });
    const r = await svc.handleWebhook('{}', 'sig');
    expect(r.ok).toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('handleWebhook activates a pending txn but is idempotent for an already-paid one', async () => {
    const verified = {
      name: 'razorpay',
      isLive: true,
      verifyWebhook: jest
        .fn()
        .mockReturnValue({ verified: true, paid: true, reference: 'order_1' }),
    } as const;

    // Pending txn → activates.
    const findOneAndUpdate = jest.fn(() => q({}));
    const updateOne = jest.fn(() => q({}));
    const a = build({
      subs: { findOne: jest.fn(() => q(subDoc('pro'))), findOneAndUpdate },
      txns: {
        findOne: jest.fn(() =>
          q({ _id: 't1', user: UID, planId: 'pro', status: 'pending' }),
        ),
        updateOne,
      },
      payment: { ...verified },
    });
    await a.svc.handleWebhook('{}', 'sig');
    expect(updateOne).toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();

    // Already-paid txn → no second activation.
    const findOneAndUpdate2 = jest.fn(() => q({}));
    const updateOne2 = jest.fn(() => q({}));
    const b = build({
      subs: {
        findOne: jest.fn(() => q(subDoc('pro'))),
        findOneAndUpdate: findOneAndUpdate2,
      },
      txns: {
        findOne: jest.fn(() =>
          q({ _id: 't1', user: UID, planId: 'pro', status: 'paid' }),
        ),
        updateOne: updateOne2,
      },
      payment: { ...verified },
    });
    const r = await b.svc.handleWebhook('{}', 'sig');
    expect(r.ok).toBe(true);
    expect(updateOne2).not.toHaveBeenCalled();
    expect(findOneAndUpdate2).not.toHaveBeenCalled();
  });

  it('changePlan to free activates immediately without a checkout', async () => {
    const findOneAndUpdate = jest.fn(() => q({}));
    const findOne = jest.fn(() => q(subDoc('free')));
    const createCheckout = jest.fn();
    const { svc } = build({
      subs: { findOne, findOneAndUpdate },
      payment: { createCheckout },
    });
    const s = await svc.changePlan(UID, 'free');
    expect(createCheckout).not.toHaveBeenCalled();
    expect(findOneAndUpdate).toHaveBeenCalled();
    expect(s.planId).toBe('free');
  });

  it('cancel marks the subscription to end at period close', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const doc = {
      providerSubscriptionId: 'order_1',
      cancelAtPeriodEnd: false,
      status: 'active',
      planId: 'pro',
      provider: 'razorpay',
      startedAt: new Date(),
      save,
    };
    const cancel = jest.fn().mockResolvedValue({ status: 'cancelled' });
    const { svc } = build({
      subs: { findOne: jest.fn(() => q(doc)) },
      payment: { name: 'razorpay', isLive: true, cancel },
    });
    await svc.cancel(UID);
    expect(cancel).toHaveBeenCalledWith('order_1');
    expect(doc.cancelAtPeriodEnd).toBe(true);
    expect(doc.status).toBe('canceled');
    expect(save).toHaveBeenCalled();
  });

  it('adminOverview sums MRR from active paid subscriptions only', async () => {
    const subs = [
      { planId: 'pro', status: 'active' }, // ₹499
      { planId: 'team', status: 'active' }, // ₹1999
      { planId: 'pro', status: 'canceled' }, // excluded
      { planId: 'free', status: 'active' }, // ₹0
    ];
    const { svc } = build({
      subs: { find: jest.fn(() => q(subs)) },
      txns: { countDocuments: jest.fn().mockResolvedValue(2) },
    });
    const ov = await svc.adminOverview();
    expect(ov.totalAccounts).toBe(4);
    expect(ov.paidAccounts).toBe(2);
    expect(ov.mrrInr).toBe(499 + 1999);
    expect(ov.paidTransactions).toBe(2);
  });
});
