import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/auth.decorators';
import { ProblemException } from '../../common/problem';
import { appConfig } from '../../config';

@ApiTags('Supervision')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @HttpCode(200)
  async health() {
    const started = Date.now();
    try {
      await this.ds.query('SELECT 1');
    } catch {
      throw new ProblemException(503, 'INTERNAL', 'Base de données inaccessible.');
    }
    return { status: 'ok', apiVersion: appConfig.apiVersion, database: { status: 'ok', latencyMs: Date.now() - started } };
  }
}
