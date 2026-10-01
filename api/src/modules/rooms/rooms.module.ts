import { Module } from '@nestjs/common';
import { RoomsController, RoomTypesController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({ controllers: [RoomTypesController, RoomsController], providers: [RoomsService], exports: [RoomsService] })
export class RoomsModule {}
