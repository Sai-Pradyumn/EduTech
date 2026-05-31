import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FEATURE_FLAG_DEFS,
  FeatureFlagDef,
  flagDef,
} from './feature-flags.catalog';
import {
  FeatureFlag,
  FeatureFlagDocument,
} from './schemas/feature-flag.schema';

export interface ResolvedFlag extends FeatureFlagDef {
  enabled: boolean;
  rolloutPercent: number;
  allowedPlans: string[];
  overridden: boolean;
}

/** Feature-flag resolution + admin management (Phase 10 · M16). Catalog default merged with
 *  any persisted override; expensive AI paths can be killed instantly from /admin. */
@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectModel(FeatureFlag.name)
    private readonly flags: Model<FeatureFlagDocument>,
  ) {}

  /** All flags resolved against overrides — admin view. */
  async list(): Promise<ResolvedFlag[]> {
    const overrides = await this.flags.find().lean<FeatureFlag[]>().exec();
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    return FEATURE_FLAG_DEFS.map((def) => this.merge(def, byKey.get(def.key)));
  }

  /** Public flag map for the client: { KEY: boolean }. */
  async publicMap(planId?: string): Promise<Record<string, boolean>> {
    const resolved = await this.list();
    const map: Record<string, boolean> = {};
    for (const f of resolved) {
      const planOk =
        f.allowedPlans.length === 0 ||
        (planId ? f.allowedPlans.includes(planId) : true);
      map[f.key] = f.enabled && planOk;
    }
    return map;
  }

  async isEnabled(key: string, planId?: string): Promise<boolean> {
    const def = flagDef(key);
    if (!def) return false;
    const override = await this.flags
      .findOne({ key })
      .lean<FeatureFlag>()
      .exec();
    const merged = this.merge(def, override ?? undefined);
    const planOk =
      merged.allowedPlans.length === 0 ||
      (planId ? merged.allowedPlans.includes(planId) : true);
    return merged.enabled && planOk;
  }

  async set(
    key: string,
    patch: Partial<
      Pick<FeatureFlag, 'enabled' | 'rolloutPercent' | 'allowedPlans'>
    >,
    updatedBy?: string,
  ): Promise<ResolvedFlag> {
    const def = flagDef(key);
    if (!def) throw new Error(`Unknown feature flag: ${key}`);
    const doc = await this.flags
      .findOneAndUpdate(
        { key },
        { $set: { ...patch, updatedBy } },
        { upsert: true, new: true },
      )
      .lean<FeatureFlag>()
      .exec();
    return this.merge(def, doc ?? undefined);
  }

  private merge(def: FeatureFlagDef, override?: FeatureFlag): ResolvedFlag {
    return {
      ...def,
      enabled: override?.enabled ?? def.defaultEnabled,
      rolloutPercent: override?.rolloutPercent ?? def.rolloutPercent,
      allowedPlans: override?.allowedPlans?.length
        ? override.allowedPlans
        : def.allowedPlans,
      overridden: !!override,
    };
  }
}
