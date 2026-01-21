import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PayoutsModule } from './payouts/payouts.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [PayoutsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
