import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('Conversas')
@ApiBearerAuth('access-token')
@Controller('conversas')
export class ConversationsController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista conversas do usuario autenticado' })
  list(
    @CurrentUser() user: JwtAccessPayload,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.conversationsService.listForUser(
      user.sub,
      pagination.page ?? 1,
      pagination.pageSize ?? 20,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Cria ou reabre conversa a partir de um anuncio' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.create(user.sub, dto);
  }

  @Get(':id/mensagens')
  @ApiOperation({ summary: 'Lista mensagens de uma conversa' })
  listMessages(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.conversationsService.listMessages(
      user.sub,
      id,
      pagination.page ?? 1,
      pagination.pageSize ?? 50,
    );
  }

  @Post(':id/mensagens')
  @ApiOperation({ summary: 'Envia mensagem em uma conversa' })
  createMessage(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.conversationsService.createMessage(user.sub, id, dto);
  }
}
