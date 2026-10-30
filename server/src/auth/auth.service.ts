import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { GoraPointsService } from '../gora-points/gora-points.service';
import type { CurrentUser, SafeUser } from '../users/user.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials.';
export const INACTIVE_ACCOUNT_MESSAGE = 'This account is inactive.';

const HASH_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
};

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so both paths cost the same. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly points: GoraPointsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(dto.password, HASH_OPTIONS);
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      city: dto.city,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
    await this.points.award(user.id, 'ACCOUNT_CREATED', user.id, 1);
    await this.awardDailyLogin(user.id);

    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const credentials = await this.usersService.findCredentialsByEmail(
      dto.email,
    );

    if (!credentials) {
      await this.verifyPassword(await this.getDummyHash(), dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const { passwordHash, isActive, ...user } = credentials;

    if (!(await this.verifyPassword(passwordHash, dto.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!isActive) {
      throw new UnauthorizedException(INACTIVE_ACCOUNT_MESSAGE);
    }

    await this.awardDailyLogin(user.id);

    return this.issue(user);
  }

  getCurrentUser(user: CurrentUser): CurrentUser {
    return user;
  }

  private async awardDailyLogin(userId: string): Promise<void> {
    const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    await this.points.award(userId, 'DAILY_LOGIN', manilaDay, 1);
  }

  private async issue(user: SafeUser): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return { user, accessToken: await this.jwtService.signAsync(payload) };
  }

  private async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    const dummyHash =
      this.dummyHash ?? argon2.hash('gora-dummy-password', HASH_OPTIONS);
    this.dummyHash = dummyHash;
    return dummyHash;
  }
}
