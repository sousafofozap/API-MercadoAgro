import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class ListingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublic(query: ListListingsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

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
      ...this.buildGeoFilter(query),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...listingPublicSelect,
          lat: false,
          lng: false,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

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

    return listing;
  }

  async findMine(sellerId: string, page: number, pageSize: number) {
    const where: Prisma.ListingWhereInput = { sellerId, deletedAt: null };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...listingPublicSelect,
          lat: false,
          lng: false,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async create(sellerId: string, dto: CreateListingDto) {
    return this.prisma.listing.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: dto.price,
        status: dto.status ?? ListingStatus.PUBLISHED,
        ...(dto.category ? { category: dto.category.trim() } : {}),
        ...(dto.brand ? { brand: dto.brand.trim() } : {}),
        ...(dto.modelName ? { modelName: dto.modelName.trim() } : {}),
        ...(dto.manufacturingYear ? { manufacturingYear: dto.manufacturingYear } : {}),
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.hourmeterHours !== undefined ? { hourmeterHours: dto.hourmeterHours } : {}),
        ...(dto.powerCv !== undefined ? { powerCv: dto.powerCv } : {}),
        ...(dto.accessories ? { accessories: dto.accessories } : {}),
        ...(dto.locationCity ? { locationCity: dto.locationCity.trim() } : {}),
        ...(dto.locationState ? { locationState: dto.locationState.trim().toUpperCase() } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        seller: { connect: { id: sellerId } },
      },
      select: { ...listingPublicSelect, lat: false, lng: false },
    });
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto) {
    await this.assertOwnership(id, sellerId);

    return this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() ?? null } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() ?? null } : {}),
        ...(dto.modelName !== undefined ? { modelName: dto.modelName?.trim() ?? null } : {}),
        ...(dto.manufacturingYear !== undefined ? { manufacturingYear: dto.manufacturingYear ?? null } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition ?? null } : {}),
        ...(dto.hourmeterHours !== undefined ? { hourmeterHours: dto.hourmeterHours ?? null } : {}),
        ...(dto.powerCv !== undefined ? { powerCv: dto.powerCv ?? null } : {}),
        ...(dto.accessories !== undefined ? { accessories: dto.accessories } : {}),
        ...(dto.locationCity !== undefined ? { locationCity: dto.locationCity?.trim() ?? null } : {}),
        ...(dto.locationState !== undefined
          ? { locationState: dto.locationState?.trim().toUpperCase() ?? null }
          : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat ?? null } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng ?? null } : {}),
      },
      select: { ...listingPublicSelect, lat: false, lng: false },
    });
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
      select: { id: true, listing: { select: { sellerId: true, deletedAt: true } } },
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
      throw new ForbiddenException('Sem permissao para modificar este anuncio.');
    }
  }

  private buildGeoFilter(
    query: Pick<ListListingsQueryDto, 'lat' | 'lng' | 'raioKm'>,
  ): Prisma.ListingWhereInput {
    if (query.lat === undefined || query.lng === undefined || query.raioKm === undefined) {
      return {};
    }

    const raio = query.raioKm;
    const latDelta = raio / 111;
    const lngDelta = raio / (111 * Math.cos((query.lat * Math.PI) / 180));

    return {
      lat: { gte: query.lat - latDelta, lte: query.lat + latDelta },
      lng: { gte: query.lng - lngDelta, lte: query.lng + lngDelta },
    };
  }
}
