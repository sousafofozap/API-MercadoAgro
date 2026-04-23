import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCondition, ListingStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ example: 'Trator John Deere 6110J — Seminovo 2022' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: 'Trator em otimo estado, revisado e pronto para safra.' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ example: 320000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'trator', description: 'Tipo/categoria da maquina' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({ example: 'John Deere' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional({ example: '6110J' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelName?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  manufacturingYear?: number;

  @ApiPropertyOptional({ enum: ListingCondition, example: ListingCondition.SEMINOVA })
  @IsOptional()
  @IsEnum(ListingCondition)
  condition?: ListingCondition;

  @ApiPropertyOptional({ example: 1200, description: 'Horimetro em horas' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hourmeterHours?: number;

  @ApiPropertyOptional({ example: 110, description: 'Potencia em CV' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  powerCv?: number;

  @ApiPropertyOptional({
    example: ['cabine', 'ar_condicionado', 'GPS'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  accessories?: string[];

  @ApiPropertyOptional({ example: 'Balsas' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  locationCity?: string;

  @ApiPropertyOptional({ example: 'MA' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  locationState?: string;

  @ApiPropertyOptional({ example: -7.5321, description: 'Latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -46.0323, description: 'Longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    example: 'https://cdn.mercadoagro.com.br/fotos/capa.jpg',
    description: 'URL da foto de capa (use POST /listings/:id/photos para multiplas fotos)',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: ListingStatus, example: ListingStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
