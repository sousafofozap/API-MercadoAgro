import { Inject, Injectable } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings.query.dto';

@Injectable()
export class ListingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublic(query: ListListingsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.PUBLISHED,
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          price: true,
          locationCity: true,
          locationState: true,
          imageUrl: true,
          status: true,
          createdAt: true,
          seller: {
            select: {
              id: true,
              fullName: true,
            },
          },
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

  create(sellerId: string, dto: CreateListingDto) {
    const category = dto.category?.trim();
    const locationCity = dto.locationCity?.trim();
    const locationState = dto.locationState?.trim();
    const imageUrl = dto.imageUrl?.trim();

    return this.prisma.listing.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        ...(category ? { category } : {}),
        price: dto.price,
        ...(locationCity ? { locationCity } : {}),
        ...(locationState ? { locationState } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        status: dto.status ?? ListingStatus.PUBLISHED,
        seller: {
          connect: {
            id: sellerId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        locationCity: true,
        locationState: true,
        imageUrl: true,
        status: true,
        createdAt: true,
        sellerId: true,
      },
    });
  }
}
