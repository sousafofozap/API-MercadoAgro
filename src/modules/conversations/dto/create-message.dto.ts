import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Tenho interesse. Podemos conversar?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  conteudo!: string;
}
