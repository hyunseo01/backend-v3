import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/current-user.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { GetAvailableScheduleDto } from './dto/get-available-schedule.dto';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { AvailableScheduleResponseDto } from './dto/available-schedule-response.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('/available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('trainer', 'user')
  @ApiOperation({ summary: '예약 가능한 시간대 조회' })
  async getAvailable(
    @Query() dto: GetAvailableScheduleDto,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: AvailableScheduleResponseDto[] }> {
    const data = await this.schedulesService.getAvailableTimeSlots(
      dto,
      req.user.userId,
    );
    return {
      message: '예약 가능한 시간대 조회 성공',
      data,
    };
  }
}
