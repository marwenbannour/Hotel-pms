import { Body, Controller, Delete, Get, Header, Headers, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { pickLang } from '../../common/i18n';
import { Idempotent } from '../../common/idempotency';
import { UuidParam } from '../../common/uuid.pipe';
import { BillingSettingsDto, ChargeDto, CreditNoteDto, ExportQuery, IssueInvoiceDto, ListInvoicesQuery, PaymentDto } from './billing.dto';
import { AccountingExportService } from './export.service';
import { FolioService } from './folio.service';
import { InvoicesService } from './invoices.service';
import { BillingSettings, BillingSettingsService } from './settings.service';

const IdemKey = () => ApiHeader({ name: 'Idempotency-Key', required: true });

@ApiTags('Facturation')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(
    private readonly folio: FolioService,
    private readonly invoices: InvoicesService,
    private readonly exporter: AccountingExportService,
    private readonly settings: BillingSettingsService,
  ) {}

  @Get('reservations/:id/folio') @RequirePermissions('billing:read')
  @ApiOperation({ summary: 'Compte du séjour : lignes, encaissements, solde' })
  getFolio(@Param('id', UuidParam) id: string, @Headers('accept-language') al?: string) {
    return this.folio.folio(id, pickLang(al));
  }

  @Post('reservations/:id/folio/charges') @RequirePermissions('billing:charge')
  @ApiOperation({ summary: 'Porter une prestation au compte du séjour' })
  addCharge(@Param('id', UuidParam) id: string, @Body() dto: ChargeDto, @CurrentUser() u: AuthUser, @Headers('accept-language') al?: string) {
    return this.folio.addCharge(id, dto, u, pickLang(al));
  }

  @Delete('reservations/:id/folio/charges/:chargeId') @RequirePermissions('billing:write')
  removeCharge(
    @Param('id', UuidParam) id: string,
    @Param('chargeId', UuidParam) chargeId: string,
    @CurrentUser() u: AuthUser,
    @Headers('accept-language') al?: string,
  ) {
    return this.folio.deleteCharge(id, chargeId, u, pickLang(al));
  }

  @Post('rooms/:id/charges') @RequirePermissions('billing:charge')
  @ApiOperation({ summary: 'Facturation à la chambre : prestation portée au séjour en cours dans cette chambre' })
  chargeRoom(@Param('id', UuidParam) roomId: string, @Body() dto: ChargeDto, @CurrentUser() u: AuthUser) {
    return this.folio.chargeRoom(roomId, dto, u);
  }

  @Post('reservations/:id/payments') @RequirePermissions('billing:write') @Idempotent() @IdemKey()
  @ApiOperation({ summary: 'Enregistrer un acompte, un paiement ou un remboursement' })
  pay(@Param('id', UuidParam) id: string, @Body() dto: PaymentDto, @CurrentUser() u: AuthUser, @Headers('accept-language') al?: string) {
    return this.folio.addPayment(id, dto, u, pickLang(al));
  }

  @Post('reservations/:id/invoice') @RequirePermissions('billing:write') @Idempotent() @IdemKey()
  @ApiOperation({ summary: 'Émettre la facture du séjour (numérotation continue, pièce inaltérable)' })
  issue(@Param('id', UuidParam) id: string, @Body() dto: IssueInvoiceDto, @CurrentUser() u: AuthUser, @Headers('accept-language') al?: string) {
    return this.invoices.issue(id, dto.lang ?? pickLang(al), u);
  }

  @Get('invoices') @RequirePermissions('billing:read')
  list(@Query() q: ListInvoicesQuery) {
    return this.invoices.list(q);
  }

  @Get('invoices/integrity') @RequirePermissions('billing:override')
  @ApiOperation({ summary: 'Vérifier empreintes, chaînage et continuité de la numérotation' })
  verify() {
    return this.invoices.verify();
  }

  @Get('invoices/:id') @RequirePermissions('billing:read')
  get(@Param('id', UuidParam) id: string) {
    return this.invoices.get(id);
  }

  @Post('invoices/:id/credit-note') @RequirePermissions('billing:override') @Idempotent() @IdemKey()
  @ApiOperation({ summary: 'Annuler une facture par un avoir total' })
  credit(@Param('id', UuidParam) id: string, @Body() dto: CreditNoteDto, @CurrentUser() u: AuthUser) {
    return this.invoices.creditNote(id, dto.reason, u);
  }

  @Get('accounting/exports') @RequirePermissions('billing:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Écritures comptables de la période (ventes, banque, caisse, OD)' })
  async export(@Query() q: ExportQuery, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="ecritures_${q.from}_${q.to}.csv"`);
    return this.exporter.csv(q.from, q.to);
  }

  @Get('settings/billing') @RequirePermissions('billing:read')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings/billing') @RequirePermissions('settings:billing')
  @ApiHeader({ name: 'If-Match', required: true })
  putSettings(@Body() dto: BillingSettingsDto, @Headers('if-match') ifMatch: string | undefined, @CurrentUser() u: AuthUser) {
    return this.settings.update(dto as Partial<BillingSettings>, ifMatch, u);
  }
}
