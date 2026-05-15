import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  listingId: true,
  createdAt: true,
  reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
  reviewed: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

type ReviewEntity = {
  id: string;
  rating: number;
  comment: string | null;
  listingId: string | null;
  createdAt: Date;
  reviewer: { id: string; fullName: string; avatarUrl: string | null };
  reviewed: { id: string; fullName: string; avatarUrl: string | null };
};

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    if (reviewerId === dto.avaliado_id) {
      throw new BadRequestException('Voce nao pode avaliar a propria conta.');
    }

    const reviewed = await this.prisma.user.findUnique({
      where: { id: dto.avaliado_id, deletedAt: null },
      select: { id: true },
    });

    if (!reviewed) throw new NotFoundException('Usuario avaliado nao encontrado.');

    if (dto.anuncio_id) {
      const listing = await this.prisma.listing.findFirst({
        where: { id: dto.anuncio_id, deletedAt: null },
        select: { sellerId: true },
      });

      if (!listing) throw new NotFoundException('Anuncio nao encontrado.');
      if (listing.sellerId !== dto.avaliado_id) {
        throw new BadRequestException(
          'O anuncio informado nao pertence ao usuario avaliado.',
        );
      }
    }

    const review = await this.prisma.review.create({
      data: {
        reviewer: { connect: { id: reviewerId } },
        reviewed: { connect: { id: dto.avaliado_id } },
        ...(dto.anuncio_id
          ? { listing: { connect: { id: dto.anuncio_id } } }
          : {}),
        rating: dto.nota,
        ...(dto.comentario !== undefined
          ? { comment: dto.comentario.trim() || null }
          : {}),
      },
      select: reviewSelect,
    });

    return this.serialize(review);
  }

  async listByUser(reviewedId: string, page = 1, pageSize = 20) {
    const exists = await this.prisma.user.findUnique({
      where: { id: reviewedId, deletedAt: null },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Usuario nao encontrado.');

    const where = { reviewedId };
    const [items, total, stats] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: reviewSelect,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      data: items.map((item) => this.serialize(item)),
      meta: {
        usuario_id: reviewedId,
        total,
        page,
        per_page: pageSize,
        pages: Math.ceil(total / pageSize),
        nota_media: this.roundRating(stats._avg.rating),
      },
    };
  }

  async statsForUser(reviewedId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { reviewedId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      nota_media: this.roundRating(stats._avg.rating),
      total_avaliacoes: stats._count.rating,
    };
  }

  private serialize(review: ReviewEntity) {
    return {
      id: review.id,
      nota: review.rating,
      comentario: review.comment,
      anuncio_id: review.listingId,
      avaliador: {
        id: review.reviewer.id,
        nome: review.reviewer.fullName,
        foto_url: review.reviewer.avatarUrl,
      },
      avaliado: {
        id: review.reviewed.id,
        nome: review.reviewed.fullName,
        foto_url: review.reviewed.avatarUrl,
      },
      criado_em: review.createdAt,
    };
  }

  private roundRating(value: number | null) {
    return value === null ? null : Math.round(value * 10) / 10;
  }
}
