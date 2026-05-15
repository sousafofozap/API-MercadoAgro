import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ example: '9a43c2dd-3329-447a-a79e-f63f05807db0' })
  @IsUUID()
  anuncio_id!: string;

  @ApiPropertyOptional({ example: 'Ola, a maquina ainda esta disponivel?' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  mensagem_inicial?: string;
}
