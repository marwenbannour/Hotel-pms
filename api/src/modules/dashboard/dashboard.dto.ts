import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: '$property doit être une date au format YYYY-MM-DD' };

export class DashboardQuery {
  @ApiPropertyOptional({ description: 'Jour affiché (défaut : aujourd’hui, fuseau de l’établissement)' })
  @IsOptional() @Matches(DATE, DATE_MSG) date?: string;
}

export class KpiQuery {
  @ApiProperty({ example: '2026-10-01' }) @Matches(DATE, DATE_MSG) from: string;
  @ApiProperty({ example: '2026-11-01', description: 'Exclu' }) @Matches(DATE, DATE_MSG) to: string;
}
