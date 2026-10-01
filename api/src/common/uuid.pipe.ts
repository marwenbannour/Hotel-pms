import { ParseUUIDPipe } from '@nestjs/common';
import { ProblemException } from './problem';

/** Un identifiant mal formé est traité comme une ressource inexistante (404). */
export const UuidParam = new ParseUUIDPipe({
  exceptionFactory: () => new ProblemException(404, 'NOT_FOUND'),
});
