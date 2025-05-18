export class ChatMessageDto {
  messageId: number;
  senderId: number;
  senderRole: 'user' | 'trainer';
  content: string;
  createdAt: Date;
}
