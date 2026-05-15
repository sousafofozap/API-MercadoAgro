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

type PasswordResetEmailInput = {
  email: string;
  fullName: string;
  token: string;
};

type EmailResult = {
  url: string;
  preview: 'logger' | 'smtp';
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (
      this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') !== 'smtp'
    ) {
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

  async sendVerificationEmail(input: VerificationEmailInput): Promise<{
    verificationUrl: string;
    preview: 'logger' | 'smtp';
  }> {
    const verificationUrl = this.buildUrl(
      'EMAIL_VERIFICATION_URL_TEMPLATE',
      input.token,
    );
    const safeFullName = escapeHtml(input.fullName);
    const safeVerificationUrl = escapeHtml(verificationUrl);
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
        <p>Ola, ${safeFullName}.</p>
        <p>Recebemos o seu cadastro no MercadoAgro.</p>
        <p>Para confirmar o seu e-mail, acesse o link abaixo:</p>
        <p>
          <a href="${safeVerificationUrl}" style="color: #166534; font-weight: bold;">
            Confirmar e-mail
          </a>
        </p>
        <p>Se voce nao solicitou esse cadastro, ignore esta mensagem.</p>
      </div>
    `.trim();

    const result = await this.sendMail({
      to: input.email,
      subject,
      text,
      html,
    });

    return { verificationUrl, preview: result.preview };
  }

  async sendPasswordResetEmail(
    input: PasswordResetEmailInput,
  ): Promise<EmailResult> {
    const resetUrl = this.buildUrl('PASSWORD_RESET_URL_TEMPLATE', input.token);
    const safeFullName = escapeHtml(input.fullName);
    const safeResetUrl = escapeHtml(resetUrl);
    const subject = 'Redefinicao de senha — MercadoAgro';
    const text = [
      `Ola, ${input.fullName}.`,
      '',
      'Recebemos uma solicitacao de redefinicao de senha para a sua conta.',
      `Acesse o link abaixo para criar uma nova senha (valido por 1 hora):`,
      resetUrl,
      '',
      'Se voce nao solicitou essa redefinicao, ignore esta mensagem.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #166534;">MercadoAgro</h2>
        <p>Ola, ${safeFullName}.</p>
        <p>Recebemos uma solicitacao de redefinicao de senha para a sua conta.</p>
        <p>Clique no link abaixo para criar uma nova senha (valido por <strong>1 hora</strong>):</p>
        <p>
          <a href="${safeResetUrl}" style="color: #166534; font-weight: bold;">
            Redefinir senha
          </a>
        </p>
        <p>Se voce nao solicitou essa redefinicao, ignore esta mensagem. Sua senha permanece a mesma.</p>
      </div>
    `.trim();

    const result = await this.sendMail({
      to: input.email,
      subject,
      text,
      html,
    });

    return { url: resetUrl, preview: result.preview };
  }

  async ping() {
    if (
      this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') ===
      'logger'
    ) {
      return 'LOGGER_READY';
    }

    if (!this.transporter) {
      throw new Error('SMTP nao inicializado');
    }

    await this.transporter.verify();
    return 'SMTP_READY';
  }

  private buildUrl(templateKey: string, token: string): string {
    const template = this.configService.getOrThrow<string>(templateKey);
    return template.replace('{{token}}', encodeURIComponent(token));
  }

  private async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ preview: 'logger' | 'smtp' }> {
    if (
      this.configService.getOrThrow<'logger' | 'smtp'>('MAIL_DRIVER') ===
      'logger'
    ) {
      this.logger.log(
        [
          'Email gerado em modo logger.',
          `Para: ${input.to}`,
          `Assunto: ${input.subject}`,
        ].join('\n'),
      );
      return { preview: 'logger' };
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
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { preview: 'smtp' };
  }
}
