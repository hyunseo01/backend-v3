import { ApiProperty } from '@nestjs/swagger';

export class ReservationInfoDto {
  reservationId: number;

  trainerName: string;

  date: string;

  time: string;

  duration: number;
}

//유저 예약화면 응답용 dto
export class GetMyReservationsResponseDto {
  @ApiProperty({ type: [ReservationInfoDto] })
  today: ReservationInfoDto[];

  @ApiProperty({ type: [ReservationInfoDto] })
  upcoming: ReservationInfoDto[];
}
