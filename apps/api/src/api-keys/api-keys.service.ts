import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { ApiKey } from './api-key.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import {
  DEFAULT_PUBLIC_API_SCOPES,
  expandsLegacyScope,
  normalizeScopes,
} from './api-key-scopes';

export type ValidatedApiKey = ApiKey;

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(UserOrganization)
    private readonly userOrganizationRepository: Repository<UserOrganization>,
  ) {}

  async create(
    user: any,
    organizationId: number,
    name: string,
    scopes?: string[],
    expiresAt?: string | Date | null,
  ): Promise<{ key: string; record: ApiKey }> {
    await this.assertCanManage(user, organizationId);

    const secret = crypto.randomBytes(32).toString('base64url');
    const prefix = `sk_zsp_${crypto.randomBytes(6).toString('hex')}`;
    const key = `${prefix}_${secret}`;
    const normalizedScopes = normalizeScopes(scopes);
    if (!normalizedScopes.length) {
      throw new BadRequestException('At least one valid scope is required');
    }
    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
    if (parsedExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
      throw new BadRequestException('Invalid expiration date');
    }

    const record = this.apiKeyRepository.create({
      name: name?.trim() || 'Public API token',
      prefix,
      keyHash: this.hashKey(key),
      scope: normalizedScopes[0] || DEFAULT_PUBLIC_API_SCOPES[0],
      scopes: normalizedScopes,
      expiresAt: parsedExpiresAt,
      userId: user.userId || user.id,
      organizationId,
    });

    return { key, record: await this.apiKeyRepository.save(record) };
  }

  async list(user: any, organizationId: number) {
    await this.assertCanManage(user, organizationId);
    const keys = await this.apiKeyRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => this.toPublicKey(key));
  }

  async revoke(user: any, organizationId: number, id: number) {
    await this.assertCanManage(user, organizationId);
    const record = await this.apiKeyRepository.findOne({
      where: { id, organizationId },
    });
    if (!record) throw new NotFoundException('API key not found');

    record.revokedAt = new Date();
    await this.apiKeyRepository.save(record);
    return this.toPublicKey(record);
  }

  async delete(user: any, organizationId: number, id: number) {
    await this.assertCanManage(user, organizationId);
    const record = await this.apiKeyRepository.findOne({
      where: { id, organizationId },
    });
    if (!record) throw new NotFoundException('API key not found');

    await this.apiKeyRepository.remove(record);
    return { id };
  }

  async validate(rawKey?: string): Promise<ValidatedApiKey> {
    const key = (rawKey || '').trim();
    if (!key) throw new UnauthorizedException('API key is required');

    const parts = key.split('_');
    if (
      parts.length < 4 ||
      parts[0] !== 'sk' ||
      !['orca', 'zsp'].includes(parts[1])
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    const prefix = parts.slice(0, 3).join('_');
    const record = await this.apiKeyRepository.findOne({ where: { prefix } });
    if (!record || record.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (record.keyHash !== this.hashKey(key)) {
      throw new UnauthorizedException('Invalid API key');
    }

    record.lastUsedAt = new Date();
    await this.apiKeyRepository.save(record);
    return record;
  }

  toPublicKey(key: ApiKey) {
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scope: key.scope,
      scopes: expandsLegacyScope(key.scope, key.scopes),
      organizationId: key.organizationId,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
    };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private async assertCanManage(user: any, organizationId: number) {
    if (!organizationId) throw new ForbiddenException('Organization required');

    if (
      user?.isSuperAdmin ||
      ['super_admin', 'admin', 'moderator'].includes(user?.systemRole)
    ) {
      return;
    }

    const membership = await this.userOrganizationRepository.findOne({
      where: { userId: user.userId || user.id, organizationId },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Only organization admins can manage API keys');
    }
  }
}
