import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { AccountingExportService } from './export.service';
import { FolioService } from './folio.service';
import { InvoicesService } from './invoices.service';
import { BillingSettingsService } from './settings.service';

@Module({
  controllers: [BillingController],
  providers: [BillingSettingsService, FolioService, InvoicesService, AccountingExportService],
  exports: [FolioService],
})
export class BillingModule {}
