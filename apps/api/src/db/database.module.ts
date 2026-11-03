import { Global, Module } from '@nestjs/common';
import { createPool, DatabaseService, PG_POOL } from './database.service.js';

@Global()
@Module({
  providers: [
    { provide: PG_POOL, useFactory: () => createPool() },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
