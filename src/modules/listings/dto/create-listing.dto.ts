import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ example: 'Colheitadeira Case Axial Flow 6130' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example:
      'Maquina em bom estado, manutencao em dia e pronta para safra.',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'maquinas' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

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

  @ApiPropertyOptional({
    example: 'https://images.example.com/colheitadeira.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    enum: ListingStatus,
    example: ListingStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
