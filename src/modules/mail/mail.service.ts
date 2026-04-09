import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

type VerificationEmailInput = {
  email: string;
  fullName: string;
  token: string;
};

type VerificationEmailResult = {
  verificationUrl: string;
  preview: 'logger' | 'smtp';
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') !== 'smtp') {
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: this.configService.getOrThrow<number>('SMTP_PORT'),
      secure: this.configService.getOrThrow<boolean>('SMTP_SECURE'),
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });

    await this.transporter.verify();
    this.logger.log('Transporte SMTP configurado com sucesso.');
  }

  async sendVerificationEmail(
    input: VerificationEmailInput,
  ): Promise<VerificationEmailResult> {
    const verificationUrl = this.buildVerificationUrl(input.token);
    const subject = 'Confirme o seu e-mail no MercadoAgro';
    const text = [
      `Ola, ${input.fullName}.`,
      '',
      'Recebemos o seu cadastro no MercadoAgro.',
      `Confirme o seu e-mail acessando: ${verificationUrl}`,
      '',
      'Se voce nao solicitou esse cadastro, ignore esta mensagem.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #166534;">MercadoAgro</h2>
        <p>Ola, ${input.fullName}.</p>
        <p>Recebemos o seu cadastro no MercadoAgro.</p>
        <p>
          Para confirmar o seu e-mail, acesse o link abaixo:
        </p>
        <p>
          <a href="${verificationUrl}" style="color: #166534; font-weight: bold;">
            Confirmar e-mail
          </a>
        </p>
        <p>Se voce nao solicitou esse cadastro, ignore esta mensagem.</p>
      </div>
    `.trim();

    if (this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') === 'logger') {
      this.logger.log(
        [
          'Email de verificacao gerado em modo logger.',
          `Para: ${input.email}`,
          `Assunto: ${subject}`,
          `Link: ${verificationUrl}`,
        ].join('\n'),
      );

      return {
        verificationUrl,
        preview: 'logger',
      };
    }

    if (!this.transporter) {
      throw new InternalServerErrorException(
        'O servico de e-mail nao foi inicializado corretamente.',
      );
    }

    await this.transporter.sendMail({
      from: {
        name: this.configService.getOrThrow<string>('MAIL_FROM_NAME'),
        address: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
      },
      replyTo: this.configService.getOrThrow<string>('MAIL_REPLY_TO'),
      to: input.email,
      subject,
      text,
      html,
    });

    return {
      verificationUrl,
      preview: 'smtp',
    };
  }

  async ping() {
    if (this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') === 'logger') {
      return 'LOGGER_READY';
    }

    if (!this.transporter) {
      throw new Error('SMTP nao inicializado');
    }

    await this.transporter.verify();
    return 'SMTP_READY';
  }

  private buildVerificationUrl(token: string) {
    const template = this.configService.getOrThrow<string>(
      'EMAIL_VERIFICATION_URL_TEMPLATE',
    );

    return template.replace('{{token}}', encodeURIComponent(token));
  }
}
