import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ManagementController } from './management.controller.js';
import { ServicesService } from './services.service.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ManagementController],
  providers: [StaffService, ServicesService],
  exports: [StaffService, ServicesService],
})
export class ManagementModule {}
