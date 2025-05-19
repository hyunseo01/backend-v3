import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Schedule } from './entities/schedules.entity';
import { Repository } from 'typeorm';
import { Reservation } from '../reservations/entities/reservation.entity';
import { GetAvailableScheduleDto } from './dto/get-available-schedule.dto';
import { AvailableScheduleResponseDto } from './dto/available-schedule-response.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,

    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async getAvailableTimeSlots(
    dto: GetAvailableScheduleDto,
    trainerId: number,
  ): Promise<AvailableScheduleResponseDto[]> {
    const { date } = dto;

    // 1. 전체 고정 시간대 (점심시간 제외)
    const fullTimeSlots = [
      '10:00:00',
      '11:00:00',
      '13:00:00',
      '14:00:00',
      '15:00:00',
      '16:00:00',
      '17:00:00',
    ];

    // 2. 해당 trainer + date 기준 예약된 시간 조회 (confirmed 상태만)
    const reservations = await this.reservationRepository.find({
      where: {
        status: 'confirmed',
      },
      relations: ['schedule'],
    });

    // 3. 조건 일치하는 예약만 필터링
    const reservedTimes = new Set(
      reservations
        .filter(
          (r) =>
            r.schedule?.trainerId === trainerId &&
            r.schedule?.date.toISOString().startsWith(date),
        )
        .map((r) => r.schedule.startTime.slice(0, 5)), // '10:00'
    );

    console.log('예약된 시간들:', [...reservedTimes]);

    // 4. 전체 시간대 중 예약된 것만 false 처리
    return fullTimeSlots.map((time) => ({
      time,
      available: !reservedTimes.has(time),
    }));
  }
}
