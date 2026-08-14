import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class AnalyticsSummaryQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsIn([7, 30])
  periodDays?: number;
}
