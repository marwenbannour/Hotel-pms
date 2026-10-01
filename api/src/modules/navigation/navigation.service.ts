import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { assertIfMatch } from '../../common/etag';
import { Lang } from '../../common/i18n';
import { notFound, ProblemException } from '../../common/problem';
import { NavigationItem } from '../../database/entities';
import { CreateNavigationItemDto, UpdateNavigationItemDto } from './navigation.dto';

export interface MenuEntry {
  key: string;
  label: string;
  path: string | null;
  icon: string | null;
  children: MenuEntry[];
}

/** Modules activés dans l'établissement (ENABLED_MODULES=core,restaurant…). */
export const enabledModules = () =>
  new Set((process.env.ENABLED_MODULES ?? 'core').split(',').map((m) => m.trim()).filter(Boolean));

@Injectable()
export class NavigationService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly audit: AuditService) {}

  private repo() {
    return this.ds.getRepository(NavigationItem);
  }

  /** Menu de l'utilisateur : filtré par droits et modules, traduit, sans entrée vide (section 5). */
  async menuFor(user: AuthUser, lang: Lang): Promise<{ lang: Lang; dir: 'ltr' | 'rtl'; items: MenuEntry[] }> {
    const modules = enabledModules();
    const all = await this.repo().find({ where: { enabled: true }, order: { sortOrder: 'ASC', key: 'ASC' } });
    const visible = all.filter(
      (i) => modules.has(i.module) && (!i.permission || user.permissions.includes(i.permission as never)),
    );
    const label = (i: NavigationItem) => (lang === 'ar' ? i.labelAr : lang === 'en' ? i.labelEn : i.labelFr);

    const build = (parentKey: string | null): MenuEntry[] =>
      visible
        .filter((i) => i.parentKey === parentKey)
        .map((i) => ({ key: i.key, label: label(i), path: i.path, icon: i.icon, children: build(i.key) }))
        // Un groupe sans lien propre n'est affiché que s'il a au moins un enfant visible.
        .filter((e) => e.path || e.children.length > 0);

    return { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', items: build(null) };
  }

  list() {
    return this.repo().find({ order: { sortOrder: 'ASC', key: 'ASC' } });
  }

  async get(id: string) {
    const item = await this.repo().findOneBy({ id });
    if (!item) throw notFound('Entrée de menu');
    return item;
  }

  async create(dto: CreateNavigationItemDto, actor: AuthUser) {
    if (dto.parentKey && !(await this.repo().existsBy({ key: dto.parentKey }))) {
      throw new ProblemException(422, 'VALIDATION_FAILED', `Parent inconnu : ${dto.parentKey}.`);
    }
    const item = await this.repo().save(this.repo().create(dto));
    await this.audit.log({ actorId: actor.id, action: 'navigation.created', entityType: 'navigation_item', entityId: item.id, data: { key: item.key } });
    return item;
  }

  async update(id: string, dto: UpdateNavigationItemDto, ifMatch: string | undefined, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const item = await m.findOne(NavigationItem, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!item) throw notFound('Entrée de menu');
      assertIfMatch(ifMatch, item.version);
      if (dto.parentKey === item.key) throw new ProblemException(422, 'VALIDATION_FAILED', 'Une entrée ne peut pas être son propre parent.');
      Object.assign(item, dto);
      const saved = await m.save(item);
      await this.audit.log({ actorId: actor.id, action: 'navigation.updated', entityType: 'navigation_item', entityId: id, data: { ...dto } }, m);
      return saved;
    });
  }

  async remove(id: string, ifMatch: string | undefined, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      const item = await m.findOne(NavigationItem, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!item) throw notFound('Entrée de menu');
      assertIfMatch(ifMatch, item.version);
      await m.delete(NavigationItem, { id });
      await this.audit.log({ actorId: actor.id, action: 'navigation.deleted', entityType: 'navigation_item', entityId: id, data: { key: item.key } }, m);
    });
  }
}
