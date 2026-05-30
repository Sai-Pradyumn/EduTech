import { IsEnum } from 'class-validator';
import { RoadmapStatus } from '../../../common/enums';

export class UpdateRoadmapStatusDto {
  @IsEnum(RoadmapStatus)
  status!: RoadmapStatus;
}
