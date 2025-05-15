import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import { extractUserFromSocket } from '../common/utils/extractUserFromSocket';

@WebSocketGateway({
  cors: {
    origin: '*', // 배포 시 실제 도메인으로 제한할 것
    credentials: true,
  },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatsService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
  ) {}

  // 클라이언트 연결 시 JWT 인증
  handleConnection(client: Socket) {
    try {
      const { accountId, role } = extractUserFromSocket(
        client,
        this.jwtService,
      );

      client.data.accountId = accountId;
      client.data.role = role;

      console.log(`WebSocket 연결됨: ${accountId} (${role})`);
    } catch (err) {
      console.error('WebSocket 인증 실패:', err.message);
      client.disconnect(); // 인증 실패 시 연결 차단
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`WebSocket 연결 해제: ${client.data?.accountId}`);
  }

  // 메시지 전송 처리
  @SubscribeMessage('message.send')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const accountId = client.data.accountId;
    const role = client.data.role;

    const saved = await this.chatService.saveMessage({
      chatId: dto.chatId,
      content: dto.content,
      senderId: accountId,
      isSystem: dto.isSystem || false,
    });

    const payload = {
      messageId: saved.id,
      senderId: saved.senderId,
      senderRole: role,
      content: saved.content,
      createdAt: saved.createdAt,
    };

    // 송신자에게 echo
    client.emit('message.receive', payload);

    // 상대방에게 메시지 전송
    const chat = await this.chatService.getChatWithUsers(dto.chatId);
    const receiverAccountId =
      accountId === chat.user.account.id
        ? chat.trainer.account.id
        : chat.user.account.id;

    for (const [_, socket] of this.server.sockets.sockets) {
      if (socket.data?.accountId === receiverAccountId) {
        socket.emit('message.receive', payload);
      }
    }

    // 메시지 전송 후 채팅방 목록 갱신 (트레이너든 유저든 동일)
    const trainerAccountId = chat.trainer.account.id;

    const updatedRoomList =
      await this.chatService.getChatRoomsForTrainer(trainerAccountId);

    for (const [_, socket] of this.server.sockets.sockets) {
      if (socket.data?.accountId === trainerAccountId) {
        socket.emit('roomList.update', updatedRoomList);
      }
    }
  }

  @SubscribeMessage('message.read')
  async handleReadMessage(
    @MessageBody() dto: ReadMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const accountId = client.data.accountId;

    await this.chatService.markMessagesAsRead({
      chatId: dto.chatId,
      accountId,
      lastReadMessageId: dto.lastReadMessageId,
    });

    // 별도 응답은 없음 (읽음 표시 클라이언트에서 처리)
  }
}
