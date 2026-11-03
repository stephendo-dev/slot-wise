import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Cloud Run puts one proxy in front: without this every client looks like it
  // has the proxy's address, which breaks the per-client login rate limit.
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}
await bootstrap();
