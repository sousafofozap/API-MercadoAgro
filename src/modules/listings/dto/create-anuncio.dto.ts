import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const BR_UF_REGEX =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i;

export class LocalizacaoAnuncioDto {
  @ApiPropertyOptional({ example: 'Balsas' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cidade?: string;

  @ApiPropertyOptional({ example: 'MA' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(BR_UF_REGEX, {
    message: 'estado deve ser uma UF brasileira valida.',
  })
  estado?: string;

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
}

export class CreateAnuncioDto {
  @ApiProperty({ example: 'Trator John Deere 6110J - Seminovo 2022' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  titulo!: string;

  @ApiProperty({
    example: 'Trator em otimo estado, revisado e pronto para safra.',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  descricao!: string;

  @ApiProperty({ example: 320000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preco!: number;

  @ApiPropertyOptional({ example: 'trator' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tipo_maquina?: string;

  @ApiPropertyOptional({ example: 'John Deere' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  marca?: string;

  @ApiPropertyOptional({ example: '6110J' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelo?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  ano_fabricacao?: number;

  @ApiPropertyOptional({ example: 'seminova', enum: ['nova', 'seminova'] })
  @IsOptional()
  @IsString()
  @IsIn(['nova', 'seminova', 'NOVA', 'SEMINOVA'])
  condicao?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  horimetro_horas?: number;

  @ApiPropertyOptional({ example: 110 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  potencia_cv?: number;

  @ApiPropertyOptional({
    example: ['cabine', 'ar_condicionado', 'GPS'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  acessorios?: string[];

  @ApiPropertyOptional({ type: LocalizacaoAnuncioDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizacaoAnuncioDto)
  localizacao?: LocalizacaoAnuncioDto;

  @ApiPropertyOptional({
    example: 'https://cdn.mercadoagro.com.br/fotos/capa.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  @MaxLength(500)
  foto_capa?: string;
}

export class UpdateAnuncioDto extends PartialType(CreateAnuncioDto) {}
