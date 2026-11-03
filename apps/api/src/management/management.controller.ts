import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  hoursSchema,
  serviceSchema,
  serviceStaffSchema,
  staffCreateSchema,
  staffUpdateSchema,
  type HoursInput,
  type ServiceInput,
  type ServiceStaffInput,
  type ServiceView,
  type StaffCreateInput,
  type StaffUpdateInput,
  type StaffView,
} from '@slotwise/shared';
import type { AuthedRequest } from '../auth/auth-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../auth/zod.pipe.js';
import { UuidPipe } from '../common/uuid.pipe.js';
import { ServicesService } from './services.service.js';
import { StaffService } from './staff.service.js';

// Order matters: SessionGuard sets the session that RolesGuard reads.
@Controller()
@UseGuards(SessionGuard, RolesGuard)
@Roles('owner')
export class ManagementController {
  constructor(
    private readonly staff: StaffService,
    private readonly services: ServicesService,
  ) {}

  @Get('staff')
  listStaff(@Req() req: AuthedRequest): Promise<StaffView[]> {
    return this.staff.list(req.auth.business.id);
  }

  @Post('staff')
  createStaff(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(staffCreateSchema)) input: StaffCreateInput,
  ): Promise<StaffView> {
    return this.staff.create(req.auth.business.id, input);
  }

  @Patch('staff/:id')
  @HttpCode(204)
  renameStaff(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(staffUpdateSchema)) input: StaffUpdateInput,
  ): Promise<void> {
    return this.staff.rename(req.auth.business.id, id, input);
  }

  @Post('staff/:id/archive')
  @HttpCode(204)
  archiveStaff(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
  ): Promise<void> {
    return this.staff.archive(req.auth.business.id, id);
  }

  @Put('staff/:id/hours')
  @HttpCode(204)
  setHours(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(hoursSchema)) input: HoursInput,
  ): Promise<void> {
    return this.staff.setHours(req.auth.business.id, id, input);
  }

  @Get('services')
  listServices(@Req() req: AuthedRequest): Promise<ServiceView[]> {
    return this.services.list(req.auth.business.id);
  }

  @Post('services')
  createService(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(serviceSchema)) input: ServiceInput,
  ): Promise<ServiceView> {
    return this.services.create(req.auth.business.id, input);
  }

  @Patch('services/:id')
  @HttpCode(204)
  updateService(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(serviceSchema)) input: ServiceInput,
  ): Promise<void> {
    return this.services.update(req.auth.business.id, id, input);
  }

  @Post('services/:id/archive')
  @HttpCode(204)
  archiveService(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
  ): Promise<void> {
    return this.services.archive(req.auth.business.id, id);
  }

  @Put('services/:id/staff')
  @HttpCode(204)
  setServiceStaff(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(serviceStaffSchema)) input: ServiceStaffInput,
  ): Promise<void> {
    return this.services.setStaff(req.auth.business.id, id, input.staffIds);
  }
}
