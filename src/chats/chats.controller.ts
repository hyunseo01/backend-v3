import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { ChatsService } from './chats.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('채팅')
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatService: ChatsService) {}

  @Get('rooms')
  @Roles('trainer')
  @ApiOperation({ summary: '트레이너 전용 채팅방 리스트 조회' })
  getTrainerChatRooms(@Req() req: RequestWithUser) {
    return this.chatService.getChatRoomsForTrainer(req.user.userId);
  }

  @Get('messages')
  @Roles('user', 'trainer')
  @ApiOperation({ summary: '채팅 메시지 조회' })
  async getMessages(
    @Req() req: RequestWithUser,
    @Query('roomId') roomId: number,
    @Query('cursor') cursor?: number,
    @Query('limit') limit = 20,
  ) {
    return this.chatService.getMessages({
      roomId: Number(roomId),
      cursor: cursor ? Number(cursor) : undefined,
      limit: Number(limit),
      accountId: req.user.userId,
      role: req.user.role,
    });
  }
}
