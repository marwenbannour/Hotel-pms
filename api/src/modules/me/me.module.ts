import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NavigationModule } from '../navigation/navigation.module';
import { MeController } from './me.controller';

@Module({ imports: [AuthModule, NavigationModule], controllers: [MeController] })
export class MeModule {}
