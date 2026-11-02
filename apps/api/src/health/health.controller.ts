import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { DatabaseService } from '../db/database.service.js';

export interface Health {
  version: string;
  database: 'up' | 'down';
}

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async check(): Promise<Health> {
    const up = await this.database.isUp();
    const body: Health = { version, database: up ? 'up' : 'down' };
    if (!up) throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }
}
