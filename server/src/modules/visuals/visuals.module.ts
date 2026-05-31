import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlowsModule } from '../flows/flows.module';
import { VisualAsset, VisualAssetSchema } from './schemas/visual-asset.schema';
import { VisualsController } from './visuals.controller';
import { VisualsService } from './visuals.service';
import { VisualExplainerService } from './visual-explainer/visual-explainer.service';
import {
  IMAGE_PROVIDER_TOKEN,
  MockImageProvider,
} from './providers/image-provider';

/**
 * Phase 8 · Visual Intelligence Studio — turns concepts/flow-nodes into structured educational
 * visuals (jsonGraph / mermaid / markdown) plus mock illustrations. Structured-first: works fully
 * without any paid image API. The image provider is abstracted (mock by default) so a real provider
 * can be slotted in behind ENABLE_IMAGE_GENERATION. Imports FlowsModule to attach visuals to nodes.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VisualAsset.name, schema: VisualAssetSchema },
    ]),
    FlowsModule,
  ],
  controllers: [VisualsController],
  providers: [
    VisualsService,
    VisualExplainerService,
    { provide: IMAGE_PROVIDER_TOKEN, useClass: MockImageProvider },
  ],
  exports: [VisualsService],
})
export class VisualsModule {}
