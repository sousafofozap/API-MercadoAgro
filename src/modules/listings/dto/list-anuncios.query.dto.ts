import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListAnunciosQueryDto {
  @ApiPropertyOptional({ example: 'trator' })
  @IsOptional()
  @IsString()
  tipo_maquina?: string;

  @ApiPropertyOptional({ example: 'trator' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ example: 'seminova', enum: ['nova', 'seminova'] })
  @IsOptional()
  @IsString()
  @IsIn(['nova', 'seminova', 'NOVA', 'SEMINOVA'])
  condicao?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preco_min?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preco_max?: number;

  @ApiPropertyOptional({ example: -7.5321 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -46.0323 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  raio_km?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Aceito por compatibilidade; impulsionamento ainda nao esta no MVP.',
  })
  @IsOptional()
  @IsIn(['true', 'false', true, false])
  destaque?: string | boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  per_page?: number = 20;
}
