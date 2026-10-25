import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import type { CurrentUser } from '../../users/user.types';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /** Runs after the signature and expiry check; the result becomes request.user. */
  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const user =
      typeof payload.sub === 'string'
        ? await this.usersService.findActiveById(payload.sub)
        : null;

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
