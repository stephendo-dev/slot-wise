import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@slotwise/shared';

export interface ApiInfo {
  name: string;
  service: 'api';
}

@Controller()
export class AppController {
  @Get()
  info(): ApiInfo {
    return { name: APP_NAME, service: 'api' };
  }
}
