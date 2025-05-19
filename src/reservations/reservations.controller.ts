import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/current-user.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiOperation({ summary: '예약 생성' })
  async createReservation(
    @Body() dto: CreateReservationDto,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: null }> {
    await this.reservationsService.create(dto, req.user.userId);
    return {
      message: '예약이 성공적으로 완료되었습니다.',
      data: null,
    };
  }
}
