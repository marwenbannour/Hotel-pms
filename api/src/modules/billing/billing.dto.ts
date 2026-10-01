import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { CursorQueryDto } from '../../common/pagination';
import { LANGS } from '../../common/i18n';

export const CHARGE_CATEGORIES = ['restaurant', 'bar', 'minibar', 'spa', 'laundry', 'phone', 'other'] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];
export const PAYMENT_KINDS = ['deposit', 'payment', 'refund'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'purchase_order'] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ChargeDto {
  @ApiProperty({ enum: CHARGE_CATEGORIES }) @IsIn(CHARGE_CATEGORIES) category: ChargeCategory;
  @ApiProperty({ example: 'Dîner – menu du jour' }) @IsString() @Length(1, 200) description: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(999) quantity?: number;
  @ApiProperty({ example: 2800, description: 'Prix unitaire TTC en unités mineures' }) @IsInt() @Min(0) @Max(10_000_000) unitAmount: number;
  @ApiPropertyOptional({ example: 1000, description: 'Taux de TVA en points de base ; défaut selon la catégorie' })
  @IsOptional() @IsInt() @Min(0) @Max(10000) vatRate?: number;
}

export class PaymentDto {
  @ApiProperty({ enum: PAYMENT_KINDS }) @IsIn(PAYMENT_KINDS) kind: (typeof PAYMENT_KINDS)[number];
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS) method: (typeof PAYMENT_METHODS)[number];
  @ApiProperty({ example: 29000, description: 'Montant positif en unités mineures (un remboursement est enregistré en négatif)' })
  @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @ApiPropertyOptional({ description: 'Référence de transaction du prestataire de paiement (obligatoire pour la carte). Jamais le numéro de carte.' })
  // Espaces admis : un numéro de carte saisi par erreur (« 4111 1111 … ») doit atteindre la détection
  // dédiée, qui renvoie un message explicite, plutôt qu'une erreur de format.
  @IsOptional() @IsString() @Matches(/^[\w .:-]{4,100}$/, { message: 'pspReference : 4 à 100 caractères (lettres, chiffres, espace, . : _ -)' })
  pspReference?: string;
  @ApiPropertyOptional({ description: 'Référence du virement ou numéro de bon de commande' })
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

export class IssueInvoiceDto {
  @ApiPropertyOptional({ enum: LANGS, description: 'Langue de la facture (défaut : langue du profil)' })
  @IsOptional() @IsIn(LANGS) lang?: (typeof LANGS)[number];
}

export class CreditNoteDto {
  @ApiProperty({ example: 'Erreur sur le nombre de nuits' }) @IsString() @Length(3, 500) reason: string;
}

export class ListInvoicesQuery extends CursorQueryDto {
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) to?: string;
  @ApiPropertyOptional({ description: 'Numéro de pièce ou nom du client' }) @IsOptional() @IsString() @Length(2, 100) q?: string;
  @ApiPropertyOptional({ enum: ['invoice', 'credit_note'] }) @IsOptional() @IsIn(['invoice', 'credit_note']) kind?: string;
}

export class ExportQuery {
  @ApiProperty({ example: '2026-10-01' }) @Matches(DATE) from: string;
  @ApiProperty({ example: '2026-11-01', description: 'Exclu' }) @Matches(DATE) to: string;
}

class SellerDto {
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) taxId?: string;
  @IsOptional() @IsString() @MaxLength(100) registration?: string;
  @IsOptional() @IsString() @MaxLength(1000) footer?: string;
}
class VatDto {
  @IsOptional() @IsInt() @Min(0) @Max(10000) accommodation?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) food?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) extras?: number;
}
class TouristTaxDto {
  @IsOptional() @IsInt() @Min(0) @Max(100000) perAdultPerNight?: number;
}

export class BillingSettingsDto {
  @ApiPropertyOptional({ example: 'FR', description: 'Pays d’exploitation (ISO 3166-1)' })
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => VatDto) vat?: VatDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => TouristTaxDto) touristTax?: TouristTaxDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => SellerDto) seller?: SellerDto;
  @ApiPropertyOptional({ description: 'Plan de comptes de l’export comptable' }) @IsOptional() @IsObject() accounts?: Record<string, string>;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Départ malgré un solde non nul (profils habilités) ; motif obligatoire' })
  @IsOptional() @IsString() @Length(3, 500) overrideBalanceReason?: string;
}
