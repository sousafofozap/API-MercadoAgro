import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListingCondition } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAccessPayload } from '../../common/types/jwt-payload.type';
import { AddPhotoDto } from './dto/add-photo.dto';
import { AddFotoAnuncioDto } from './dto/add-foto-anuncio.dto';
import { CreateAnuncioDto, UpdateAnuncioDto } from './dto/create-anuncio.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListAnunciosQueryDto } from './dto/list-anuncios.query.dto';
import { ListListingsQueryDto } from './dto/list-listings.query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

const publicThrottle = { default: { limit: 20, ttl: 60_000 } };

type ListingResponse = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  brand: string | null;
  modelName: string | null;
  manufacturingYear: number | null;
  condition: ListingCondition | null;
  hourmeterHours: number | null;
  powerCv: number | null;
  accessories: string[];
  price: number;
  imageUrl: string | null;
  locationCity: string | null;
  locationState: string | null;
  lat?: number | null;
  lng?: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  seller: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  photos: Array<{
    id: string;
    url: string;
    order: number;
    createdAt?: Date;
  }>;
};

function normalizeCondition(
  value: string | undefined,
): ListingCondition | undefined {
  if (!value) return undefined;
  return value.toUpperCase() as ListingCondition;
}

function toIso(value: Date | string | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function toListingQuery(dto: ListAnunciosQueryDto): ListListingsQueryDto {
  const query: ListListingsQueryDto = {};

  if (dto.busca !== undefined) query.search = dto.busca;
  if (dto.tipo_maquina !== undefined) query.machineType = dto.tipo_maquina;
  if (dto.condicao !== undefined) {
    const condition = normalizeCondition(dto.condicao);
    if (condition !== undefined) query.condition = condition;
  }
  if (dto.preco_min !== undefined) query.priceMin = dto.preco_min;
  if (dto.preco_max !== undefined) query.priceMax = dto.preco_max;
  if (dto.lat !== undefined) query.lat = dto.lat;
  if (dto.lng !== undefined) query.lng = dto.lng;
  if (dto.raio_km !== undefined) query.raioKm = dto.raio_km;
  if (dto.page !== undefined) query.page = dto.page;
  if (dto.per_page !== undefined) query.pageSize = dto.per_page;

  return query;
}

function toCreateListingDto(dto: CreateAnuncioDto): CreateListingDto {
  const listingDto: CreateListingDto = {
    title: dto.titulo,
    description: dto.descricao,
    price: dto.preco,
  };

  if (dto.tipo_maquina !== undefined) listingDto.category = dto.tipo_maquina;
  if (dto.marca !== undefined) listingDto.brand = dto.marca;
  if (dto.modelo !== undefined) listingDto.modelName = dto.modelo;
  if (dto.ano_fabricacao !== undefined) {
    listingDto.manufacturingYear = dto.ano_fabricacao;
  }
  if (dto.condicao !== undefined) {
    const condition = normalizeCondition(dto.condicao);
    if (condition !== undefined) listingDto.condition = condition;
  }
  if (dto.horimetro_horas !== undefined) {
    listingDto.hourmeterHours = dto.horimetro_horas;
  }
  if (dto.potencia_cv !== undefined) listingDto.powerCv = dto.potencia_cv;
  if (dto.acessorios !== undefined) listingDto.accessories = dto.acessorios;
  if (dto.localizacao?.cidade !== undefined) {
    listingDto.locationCity = dto.localizacao.cidade;
  }
  if (dto.localizacao?.estado !== undefined) {
    listingDto.locationState = dto.localizacao.estado;
  }
  if (dto.localizacao?.lat !== undefined) listingDto.lat = dto.localizacao.lat;
  if (dto.localizacao?.lng !== undefined) listingDto.lng = dto.localizacao.lng;
  if (dto.foto_capa !== undefined) listingDto.imageUrl = dto.foto_capa;

  return listingDto;
}

function toUpdateListingDto(dto: UpdateAnuncioDto): UpdateListingDto {
  const listingDto: UpdateListingDto = {};

  if (dto.titulo !== undefined) listingDto.title = dto.titulo;
  if (dto.descricao !== undefined) listingDto.description = dto.descricao;
  if (dto.preco !== undefined) listingDto.price = dto.preco;
  if (dto.tipo_maquina !== undefined) listingDto.category = dto.tipo_maquina;
  if (dto.marca !== undefined) listingDto.brand = dto.marca;
  if (dto.modelo !== undefined) listingDto.modelName = dto.modelo;
  if (dto.ano_fabricacao !== undefined) {
    listingDto.manufacturingYear = dto.ano_fabricacao;
  }
  if (dto.condicao !== undefined) {
    const condition = normalizeCondition(dto.condicao);
    if (condition !== undefined) listingDto.condition = condition;
  }
  if (dto.horimetro_horas !== undefined) {
    listingDto.hourmeterHours = dto.horimetro_horas;
  }
  if (dto.potencia_cv !== undefined) listingDto.powerCv = dto.potencia_cv;
  if (dto.acessorios !== undefined) listingDto.accessories = dto.acessorios;
  if (dto.localizacao?.cidade !== undefined) {
    listingDto.locationCity = dto.localizacao.cidade;
  }
  if (dto.localizacao?.estado !== undefined) {
    listingDto.locationState = dto.localizacao.estado;
  }
  if (dto.localizacao?.lat !== undefined) listingDto.lat = dto.localizacao.lat;
  if (dto.localizacao?.lng !== undefined) listingDto.lng = dto.localizacao.lng;
  if (dto.foto_capa !== undefined) listingDto.imageUrl = dto.foto_capa;

  return listingDto;
}

function serializePhotoPt(photo: ListingResponse['photos'][number]) {
  return {
    id: photo.id,
    foto_url: photo.url,
    ordem: photo.order,
    criado_em: toIso(photo.createdAt),
  };
}

function serializeAnuncioPt(listing: ListingResponse, includeGeo = false) {
  const coverPhoto = listing.imageUrl ?? listing.photos[0]?.url ?? null;

  return {
    id: listing.id,
    titulo: listing.title,
    tipo_maquina: listing.category,
    marca: listing.brand,
    modelo: listing.modelName,
    ano_fabricacao: listing.manufacturingYear,
    condicao: listing.condition?.toLowerCase() ?? null,
    preco: listing.price,
    descricao: listing.description,
    horimetro_horas: listing.hourmeterHours,
    potencia_cv: listing.powerCv,
    acessorios: listing.accessories,
    destaque: false,
    foto_capa: coverPhoto,
    localizacao: {
      cidade: listing.locationCity,
      estado: listing.locationState,
      ...(includeGeo
        ? { lat: listing.lat ?? null, lng: listing.lng ?? null }
        : {}),
    },
    anunciante: {
      id: listing.seller.id,
      nome: listing.seller.fullName,
      foto_url: listing.seller.avatarUrl,
      nota_media: null,
    },
    status: listing.status.toLowerCase(),
    fotos: listing.photos.map(serializePhotoPt),
    criado_em: toIso(listing.createdAt),
    atualizado_em: toIso(listing.updatedAt),
  };
}

function serializeListPt(response: {
  items: ListingResponse[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}) {
  return {
    data: response.items.map((item) => serializeAnuncioPt(item)),
    meta: {
      total: response.meta.total,
      page: response.meta.page,
      per_page: response.meta.pageSize,
      pages: response.meta.totalPages,
    },
  };
}

@ApiTags('Anuncios')
@Controller('anuncios')
export class AnunciosController {
  constructor(
    @Inject(ListingsService)
    private readonly listingsService: ListingsService,
  ) {}

  @Get()
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Lista anuncios publicados no contrato PT-BR' })
  async listPublic(@Query() query: ListAnunciosQueryDto) {
    const result = await this.listingsService.listPublic(toListingQuery(query));
    return serializeListPt(result as { items: ListingResponse[]; meta: any });
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lista os proprios anuncios no contrato PT-BR' })
  async findMine(
    @CurrentUser() user: JwtAccessPayload,
    @Query() pagination: PaginationQueryDto,
  ) {
    const result = await this.listingsService.findMine(
      user.sub,
      pagination.page ?? 1,
      pagination.pageSize ?? 20,
    );
    return {
      ...serializeListPt(result as { items: ListingResponse[]; meta: any }),
      data: (result.items as ListingResponse[]).map((item) =>
        serializeAnuncioPt(item, true),
      ),
    };
  }

  @Get(':id')
  @Public()
  @Throttle(publicThrottle)
  @ApiOperation({ summary: 'Retorna detalhes de um anuncio no contrato PT-BR' })
  async findById(@Param('id') id: string) {
    const listing = await this.listingsService.findById(id);
    return serializeAnuncioPt(listing as ListingResponse);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cria um anuncio usando payload PT-BR' })
  async create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateAnuncioDto,
  ) {
    const listing = await this.listingsService.create(
      user.sub,
      toCreateListingDto(dto),
    );
    return serializeAnuncioPt(listing as ListingResponse, true);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Edita um anuncio proprio usando payload PT-BR' })
  async update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAnuncioDto,
  ) {
    const listing = await this.listingsService.update(
      id,
      user.sub,
      toUpdateListingDto(dto),
    );
    return serializeAnuncioPt(listing as ListingResponse, true);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove um anuncio proprio' })
  async remove(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    await this.listingsService.remove(id, user.sub);
  }

  @Post(':id/fotos')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Adiciona uma foto por URL; upload multipart fica para evolucao',
  })
  async addPhoto(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: AddFotoAnuncioDto,
  ) {
    const url = dto.foto_url ?? dto.url;
    if (!url) {
      throw new BadRequestException('Informe foto_url ou url.');
    }

    const photoDto: AddPhotoDto = { url };
    if (dto.ordem !== undefined) photoDto.order = dto.ordem;

    const photo = await this.listingsService.addPhoto(id, user.sub, photoDto);

    return serializePhotoPt(photo);
  }

  @Delete(':id/fotos/:fotoId')
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove uma foto do anuncio' })
  async removePhoto(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Param('fotoId') fotoId: string,
  ) {
    await this.listingsService.removePhoto(id, fotoId, user.sub);
  }
}
