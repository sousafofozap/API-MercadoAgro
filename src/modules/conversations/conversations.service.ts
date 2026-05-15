import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

const messageSelect = {
  id: true,
  conversationId: true,
  content: true,
  readAt: true,
  createdAt: true,
  sender: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

const conversationSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  listing: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
    },
  },
  buyer: { select: { id: true, fullName: true, avatarUrl: true } },
  seller: { select: { id: true, fullName: true, avatarUrl: true } },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: messageSelect,
  },
} as const;

type MessageEntity = {
  id: string;
  conversationId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
  sender: { id: string; fullName: string; avatarUrl: string | null };
};

type ConversationEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  listing: {
    id: string;
    title: string;
    imageUrl: string | null;
    price: Prisma.Decimal | number | string;
  };
  buyer: { id: string; fullName: string; avatarUrl: string | null };
  seller: { id: string; fullName: string; avatarUrl: string | null };
  messages: MessageEntity[];
};

@Injectable()
export class ConversationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: dto.anuncio_id,
        status: ListingStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true, sellerId: true },
    });

    if (!listing) throw new NotFoundException('Anuncio nao encontrado.');
    if (listing.sellerId === userId) {
      throw new BadRequestException(
        'Nao e possivel abrir conversa no proprio anuncio.',
      );
    }

    const conversation = await this.prisma.conversation.upsert({
      where: {
        listingId_buyerId: { listingId: listing.id, buyerId: userId },
      },
      update: {},
      create: {
        listing: { connect: { id: listing.id } },
        buyer: { connect: { id: userId } },
        seller: { connect: { id: listing.sellerId } },
      },
      select: { id: true },
    });

    if (dto.mensagem_inicial?.trim()) {
      await this.createMessage(userId, conversation.id, {
        conteudo: dto.mensagem_inicial,
      });
    }

    return this.findOneForUser(userId, conversation.id);
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const where = {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: conversationSelect,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: items.map((item) => this.serializeConversation(item)),
      meta: {
        total,
        page,
        per_page: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOneForUser(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      select: conversationSelect,
    });

    if (!conversation) throw new NotFoundException('Conversa nao encontrada.');
    return this.serializeConversation(conversation);
  }

  async listMessages(
    userId: string,
    conversationId: string,
    page = 1,
    pageSize = 50,
  ) {
    await this.assertParticipant(userId, conversationId);

    const where = { conversationId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: messageSelect,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data: items.map((item) => this.serializeMessage(item)),
      meta: {
        conversa_id: conversationId,
        total,
        page,
        per_page: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  async createMessage(
    userId: string,
    conversationId: string,
    dto: CreateMessageDto,
  ) {
    await this.assertParticipant(userId, conversationId);
    const content = dto.conteudo.trim();
    if (!content) throw new BadRequestException('Mensagem vazia.');

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversation: { connect: { id: conversationId } },
          sender: { connect: { id: userId } },
          content,
        },
        select: messageSelect,
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    return this.serializeMessage(message);
  }

  async getParticipantIds(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { buyerId: true, sellerId: true },
    });

    if (!conversation) throw new NotFoundException('Conversa nao encontrada.');
    return [conversation.buyerId, conversation.sellerId];
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new ForbiddenException('Sem permissao para acessar esta conversa.');
    }
  }

  private serializeConversation(conversation: ConversationEntity) {
    const lastMessage = conversation.messages[0];

    return {
      id: conversation.id,
      anuncio: {
        id: conversation.listing.id,
        titulo: conversation.listing.title,
        foto_capa: conversation.listing.imageUrl,
        preco: Number(conversation.listing.price),
      },
      comprador: this.serializeUser(conversation.buyer),
      anunciante: this.serializeUser(conversation.seller),
      ultima_mensagem: lastMessage ? this.serializeMessage(lastMessage) : null,
      criado_em: conversation.createdAt,
      atualizado_em: conversation.updatedAt,
    };
  }

  private serializeMessage(message: MessageEntity) {
    return {
      id: message.id,
      conversa_id: message.conversationId,
      conteudo: message.content,
      remetente: this.serializeUser(message.sender),
      lida_em: message.readAt,
      criado_em: message.createdAt,
    };
  }

  private serializeUser(user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  }) {
    return {
      id: user.id,
      nome: user.fullName,
      foto_url: user.avatarUrl,
    };
  }
}
