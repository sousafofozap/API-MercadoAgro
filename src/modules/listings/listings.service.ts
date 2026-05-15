import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings.query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

const listingPublicSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  brand: true,
  modelName: true,
  manufacturingYear: true,
  condition: true,
  hourmeterHours: true,
  powerCv: true,
  accessories: true,
  price: true,
  imageUrl: true,
  locationCity: true,
  locationState: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  photos: {
    select: { id: true, url: true, order: true },
    orderBy: { order: 'asc' as const },
  },
} as const;

const listingPublicSelectWithGeo = {
  ...listingPublicSelect,
  lat: true,
  lng: true,
} as const;
const listingOwnerSelect = listingPublicSelectWithGeo;

const EARTH_RADIUS_KM = 6_371;

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function stripGeo<T extends { lat?: number | null; lng?: number | null }>(
  item: T,
): Omit<T, 'lat' | 'lng'> {
  const { lat: _lat, lng: _lng, ...rest } = item;
  return rest;
}

type ListingWithPrice = {
  price: Prisma.Decimal | number | string;
};

function serializeListing<T extends ListingWithPrice>(
  listing: T,
): Omit<T, 'price'> & { price: number } {
  return {
    ...listing,
    price: Number(listing.price),
  };
}

@Injectable()
export class ListingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async listPublic(query: ListListingsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const geoActive = this.assertGeoConsistency(query);

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.PUBLISHED,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { brand: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.machineType
        ? { category: { equals: query.machineType, mode: 'insensitive' } }
        : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.priceMin !== undefined || query.priceMax !== undefined
        ? {
            price: {
              ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
              ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
      ...this.buildGeoBoundingBox(query),
    };

    if (!geoActive) {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.listing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: listingPublicSelect,
        }),
        this.prisma.listing.count({ where }),
      ]);

      return {
        items: items.map(serializeListing),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }

    const candidateLimit = this.configService.getOrThrow<number>(
      'GEO_CANDIDATE_LIMIT',
    );
    const candidateCount = await this.prisma.listing.count({ where });

    if (candidateCount > candidateLimit) {
      throw new BadRequestException(
        'Filtro geografico muito amplo. Reduza o raio ou combine mais filtros.',
      );
    }

    const candidates = await this.prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: listingPublicSelectWithGeo,
    });

    const filtered = candidates.filter((item) => {
      if (item.lat === null || item.lng === null) return false;
      return (
        haversineKm(query.lat!, query.lng!, item.lat, item.lng) <= query.raioKm!
      );
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered
      .slice(start, start + pageSize)
      .map((item) => serializeListing(stripGeo(item)));

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, status: ListingStatus.PUBLISHED, deletedAt: null },
      select: listingPublicSelect,
    });

    if (!listing) throw new NotFoundException('Anuncio nao encontrado.');

    return serializeListing(listing);
  }

  async findMine(sellerId: string, page: number, pageSize: number) {
    const where: Prisma.ListingWhereInput = { sellerId, deletedAt: null };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: listingOwnerSelect,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: items.map(serializeListing),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async create(sellerId: string, dto: CreateListingDto) {
    const listing = await this.prisma.listing.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: dto.price,
        status: dto.status ?? ListingStatus.PUBLISHED,
        ...(dto.category ? { category: dto.category.trim() } : {}),
        ...(dto.brand ? { brand: dto.brand.trim() } : {}),
        ...(dto.modelName ? { modelName: dto.modelName.trim() } : {}),
        ...(dto.manufacturingYear
          ? { manufacturingYear: dto.manufacturingYear }
          : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.hourmeterHours !== undefined
          ? { hourmeterHours: dto.hourmeterHours }
          : {}),
        ...(dto.powerCv !== undefined ? { powerCv: dto.powerCv } : {}),
        ...(dto.accessories ? { accessories: dto.accessories } : {}),
        ...(dto.imageUrl ? { imageUrl: dto.imageUrl.trim() } : {}),
        ...(dto.locationCity ? { locationCity: dto.locationCity.trim() } : {}),
        ...(dto.locationState
          ? { locationState: dto.locationState.trim().toUpperCase() }
          : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        seller: { connect: { id: sellerId } },
      },
      select: listingOwnerSelect,
    });

    return serializeListing(listing);
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto) {
    await this.assertOwnership(id, sellerId);

    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category?.trim() ?? null }
          : {}),
        ...(dto.brand !== undefined
          ? { brand: dto.brand?.trim() ?? null }
          : {}),
        ...(dto.modelName !== undefined
          ? { modelName: dto.modelName?.trim() ?? null }
          : {}),
        ...(dto.manufacturingYear !== undefined
          ? { manufacturingYear: dto.manufacturingYear ?? null }
          : {}),
        ...(dto.condition !== undefined
          ? { condition: dto.condition ?? null }
          : {}),
        ...(dto.hourmeterHours !== undefined
          ? { hourmeterHours: dto.hourmeterHours ?? null }
          : {}),
        ...(dto.powerCv !== undefined ? { powerCv: dto.powerCv ?? null } : {}),
        ...(dto.accessories !== undefined
          ? { accessories: dto.accessories }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl?.trim() ?? null }
          : {}),
        ...(dto.locationCity !== undefined
          ? { locationCity: dto.locationCity?.trim() ?? null }
          : {}),
        ...(dto.locationState !== undefined
          ? { locationState: dto.locationState?.trim().toUpperCase() ?? null }
          : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat ?? null } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng ?? null } : {}),
      },
      select: listingOwnerSelect,
    });

    return serializeListing(listing);
  }

  async remove(id: string, sellerId: string) {
    await this.assertOwnership(id, sellerId);

    await this.prisma.listing.update({
      where: { id },
      data: { deletedAt: new Date(), status: ListingStatus.ARCHIVED },
    });

    return { message: 'Anuncio removido com sucesso.' };
  }

  async addPhoto(listingId: string, sellerId: string, dto: AddPhotoDto) {
    await this.assertOwnership(listingId, sellerId);

    return this.prisma.photo.create({
      data: {
        url: dto.url,
        order: dto.order ?? 0,
        listing: { connect: { id: listingId } },
      },
      select: { id: true, url: true, order: true, createdAt: true },
    });
  }

  async removePhoto(listingId: string, photoId: string, sellerId: string) {
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, listingId },
      select: {
        id: true,
        listing: { select: { sellerId: true, deletedAt: true } },
      },
    });

    if (!photo || photo.listing.deletedAt) {
      throw new NotFoundException('Foto nao encontrada.');
    }

    if (photo.listing.sellerId !== sellerId) {
      throw new ForbiddenException('Sem permissao para remover esta foto.');
    }

    await this.prisma.photo.delete({ where: { id: photoId } });

    return { message: 'Foto removida com sucesso.' };
  }

  private async assertOwnership(listingId: string, sellerId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: { sellerId: true },
    });

    if (!listing) throw new NotFoundException('Anuncio nao encontrado.');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException(
        'Sem permissao para modificar este anuncio.',
      );
    }
  }

  private assertGeoConsistency(
    query: Pick<ListListingsQueryDto, 'lat' | 'lng' | 'raioKm'>,
  ): boolean {
    const provided = [query.lat, query.lng, query.raioKm].filter(
      (v) => v !== undefined,
    ).length;

    if (provided === 0) return false;
    if (provided !== 3) {
      throw new BadRequestException(
        'Filtro geografico exige lat, lng e raioKm em conjunto.',
      );
    }
    return true;
  }

  private buildGeoBoundingBox(
    query: Pick<ListListingsQueryDto, 'lat' | 'lng' | 'raioKm'>,
  ): Prisma.ListingWhereInput {
    if (
      query.lat === undefined ||
      query.lng === undefined ||
      query.raioKm === undefined
    ) {
      return {};
    }

    const raio = query.raioKm;
    const latDelta = raio / 111;
    const cosLat = Math.cos((query.lat * Math.PI) / 180);
    const lngDelta = cosLat > 0.01 ? raio / (111 * cosLat) : 180;

    return {
      lat: { gte: query.lat - latDelta, lte: query.lat + latDelta },
      lng: { gte: query.lng - lngDelta, lte: query.lng + lngDelta },
    };
  }
}
