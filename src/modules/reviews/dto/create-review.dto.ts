import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: '3e9a9b9f-4f77-4fc6-9f9f-2c1b08d51f41' })
  @IsUUID()
  avaliado_id!: string;

  @ApiPropertyOptional({ example: '9a43c2dd-3329-447a-a79e-f63f05807db0' })
  @IsOptional()
  @IsUUID()
  anuncio_id?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  nota!: number;

  @ApiPropertyOptional({
    example: 'Negociacao transparente e maquina conforme anunciado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
