import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { marked } from 'marked';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private getBrandedLayout(title: string, content: string) {
    const baseUrl = (
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL', 'http://localhost:5173')
    ).replace(/\/$/, '');
    const logoUrl = `${baseUrl}/logo/logo-horizontal-light.png`;
    const primaryColor = '#1661af';

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f9; }
                    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .header { background-color: #ffffff; padding: 30px; text-align: center; border-bottom: 2px solid #f0f0f0; }
                    .logo { height: 50px; }
                    .content { padding: 40px; }
                    .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #f0f0f0; }
                    .button { display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
                    h1 { color: ${primaryColor}; margin-top: 0; font-size: 24px; }
                    .link-alt { font-size: 12px; color: #999; margin-top: 25px; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Spoolytracker" class="logo">
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Spoolytracker. Tous droits réservés.</p>
                        <p>Optimisez votre gestion de filaments 3D.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
  }

  async sendVerificationEmail(email: string, token: string, userId: number) {
    const appUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const url = `${appUrl}/verify-email?token=${token}&id=${userId}`;

    const html = this.getBrandedLayout(
      'Vérifiez votre compte',
      `
                <h1>Bienvenue sur Spoolytracker !</h1>
                <p>Merci de vous être inscrit. Pour activer votre compte et commencer à gérer vos filaments, veuillez cliquer sur le bouton ci-dessous :</p>
                <a href="${url}" class="button">Vérifier mon compte</a>
                <div class="link-alt">
                    <p>Si le bouton ne fonctionne pas, copiez ce lien :</p>
                    <p>${url}</p>
                </div>
            `,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: 'Vérifiez votre compte Spoolytracker',
      html,
    });
  }

  async sendOrganizationInvitation(
    email: string,
    orgName: string,
    inviterName: string,
  ) {
    const appUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const url = `${appUrl}/settings`;

    const html = this.getBrandedLayout(
      'Invitation reçue',
      `
                <h1>Vous avez été invité !</h1>
                <p><strong>${inviterName}</strong> vous a invité à rejoindre l'organisation <strong>${orgName}</strong> sur Spoolytracker.</p>
                <p>Découvrez vos nouveaux projets et gérez votre stock de filaments dès maintenant.</p>
                <a href="${url}" class="button">Accéder à Spoolytracker</a>
            `,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: `Invitation à rejoindre ${orgName} sur Spoolytracker`,
      html,
    });
    console.log(
      `[EmailService] Sent invitation email to ${email} for org ${orgName}`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const appUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const url = `${appUrl}/reset-password?token=${token}`;
    const mobileLink = `spooly://reset-password?token=${token}`;

    const html = this.getBrandedLayout(
      'Réinitialisation de mot de passe',
      `
                <h1>Réinitialisation de mot de passe</h1>
                <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Spoolytracker.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <p style="margin-bottom: 10px; font-weight: bold; color: #666;">Sur mobile :</p>
                    <a href="${mobileLink}" class="button" style="background-color: #10b981;">Ouvrir l'application mobile</a>
                    
                    <p style="margin: 20px 0 10px; font-weight: bold; color: #666;">Sur ordinateur :</p>
                    <a href="${url}" class="button">Réinitialiser dans le navigateur</a>
                </div>

                <p style="margin-top: 20px; font-size: 14px; color: #666;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
                <div class="link-alt">
                    <p>Liens de secours :</p>
                    <p>Mobile: ${mobileLink}</p>
                    <p>Web: ${url}</p>
                </div>
            `,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe Spoolytracker',
      html,
    });
    console.log(`[EmailService] Sent password reset email to ${email}`);
  }

  async sendBetaNotification(userEmail: string, orgName: string) {
    const contactEmail = this.configService.get(
      'SMTP_CONTACT_EMAIL',
      'contact@spoolytracker.com',
    );
    const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #1661af;">Nouvel Utilisateur Beta</h2>
                <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <p>L'organisation <strong>${orgName}</strong> vient d'être passée en plan <strong>Beta</strong>.</p>
                    <p><strong>Email à ajouter à la liste de diffusion :</strong> ${userEmail}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Ceci est une notification automatique du système Spoolytracker.</p>
                </div>
            </div>
        `;

    await this.mailerService.sendMail({
      to: contactEmail,
      subject: `[BETA] Nouvel utilisateur à ajouter : ${userEmail}`,
      html,
    });
    console.log(`[EmailService] Sent beta notification for ${userEmail}`);
  }

  async sendBetaRemovalNotification(userEmail: string, orgName: string) {
    const contactEmail = this.configService.get(
      'SMTP_CONTACT_EMAIL',
      'contact@spoolytracker.com',
    );
    const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #d32f2f;">Retrait Utilisateur Beta</h2>
                <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <p>L'organisation <strong>${orgName}</strong> n'est plus en plan <strong>Beta</strong> (expiration ou changement de plan).</p>
                    <p><strong>Email à supprimer de la liste de diffusion :</strong> ${userEmail}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Ceci est une notification automatique du système Spoolytracker.</p>
                </div>
            </div>
        `;

    await this.mailerService.sendMail({
      to: contactEmail,
      subject: `[BETA] Utilisateur à retirer : ${userEmail}`,
      html,
    });
    console.log(
      `[EmailService] Sent beta removal notification for ${userEmail}`,
    );
  }

  async sendFeedbackEmail(user: any, ip: string, message: string) {
    const supportEmail = this.configService.get(
      'SMTP_SUPPORT_EMAIL',
      'support@spoolytracker.com',
    );
    const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #1661af;">Nouveau Feedback Utilisateur (IA)</h2>
                <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <p><strong>Utilisateur:</strong> ${user.firstName} ${user.lastName} (ID: ${user.id})</p>
                    <p><strong>Email:</strong> ${user.email || 'Non renseigné'}</p>
                    <p><strong>Organisation:</strong> ${user.organizationId}</p>
                    <p><strong>IP:</strong> ${ip}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <h3>Message :</h3>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-style: italic; white-space: pre-wrap;">${message}</div>
                </div>
            </div>
        `;

    await this.mailerService.sendMail({
      to: supportEmail,
      subject: `[Feedback AI Agent] De ${user.firstName || user.username} ${user.lastName || ''}`,
      html,
    });
    console.log(`[EmailService] Sent feedback email for user ${user.id}`);
  }

  async sendSupportTicketEmail(
    user: any,
    ip: string,
    type: 'bug' | 'feedback',
    message: string,
    title?: string,
    file?: Express.Multer.File,
  ) {
    const supportEmail = this.configService.get(
      'SMTP_SUPPORT_EMAIL',
      'support@spoolytracker.com',
    );
    const subject = `[${type.toUpperCase()}] ${title || 'Nouveau retour utilisateur'} - ${user.firstName || user.username}`;

    const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f4f7f9; border-radius: 8px;">
                <h2 style="color: ${type === 'bug' ? '#d32f2f' : '#1661af'}; text-transform: uppercase;">
                    ${type === 'bug' ? '🐞 Signalement de Bug' : '💬 Nouveau Feedback'}
                </h2>
                <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <p><strong>De:</strong> ${user.firstName || user.username} ${user.lastName || ''} (${user.email})</p>
                    <p><strong>Organisation ID:</strong> ${user.organizationId}</p>
                    <p><strong>Adresse IP:</strong> ${ip}</p>
                    <p><strong>Type:</strong> ${type}</p>
                    ${title ? `<p><strong>Sujet:</strong> ${title}</p>` : ''}
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    
                    <h3 style="color: #666;">Message:</h3>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid ${type === 'bug' ? '#d32f2f' : '#1661af'}; white-space: pre-wrap; font-size: 15px;">${message}</div>
                    
                    ${file ? `<p style="margin-top: 20px; color: #666; font-size: 13px;">📎 <em>Une capture d'écran a été jointe à cet email.</em></p>` : ''}
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #999;">
                    Envoyé automatiquement par le système de support Spoolytracker.
                </div>
            </div>
        `;

    const attachments = file
      ? [
          {
            filename: file.originalname,
            content: file.buffer,
            contentType: file.mimetype,
          },
        ]
      : [];

    await this.mailerService.sendMail({
      to: supportEmail,
      subject,
      html,
      attachments,
    });
    console.log(
      `[EmailService] Support ticket (${type}) sent to ${supportEmail} from user ${user.id}`,
    );
  }

  async sendBroadcastEmail(email: string, title: string, content: string) {
    const htmlContent = await marked.parse(content);
    
    // Custom styles for markdown elements in the email
    const styledContent = `
      <div class="markdown-body">
        ${htmlContent}
      </div>
      <style>
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #1661af; margin-top: 25px; margin-bottom: 15px; }
        .markdown-body p { margin-bottom: 15px; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 15px; padding-left: 20px; }
        .markdown-body li { margin-bottom: 8px; }
        .markdown-body a { color: #1661af; text-decoration: underline; }
        .markdown-body blockquote { border-left: 4px solid #eee; padding-left: 15px; color: #666; font-style: italic; margin-left: 0; }
        .markdown-body hr { border: none; border-top: 1px solid #eee; margin: 25px 0; }
      </style>
    `;

    const html = this.getBrandedLayout(
      title,
      `
                <h1>${title}</h1>
                <div style="margin-top: 20px;">${styledContent}</div>
                <p style="margin-top: 30px; font-size: 14px; color: #666;">Vous recevez ce message car vous êtes testeur beta ou membre privilégié de Spoolytracker.</p>
            `,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: title,
      html,
    });
  }
}
