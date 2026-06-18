import type { AnytypeConnectionSettings } from '@/lib/anytype';
import {
  checkConnection,
  createApiKey,
  createChallenge,
  createType,
  getType,
  listProperties,
  listSpaces,
  listTypes,
} from '@/lib/anytype-client';
import { preparePaperType } from '@/lib/anytype-schema';

type AnytypeMessage =
  | {
      type: 'anytype:check-connection';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:create-challenge';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:create-api-key';
      payload: {
        settings: AnytypeConnectionSettings;
        challengeId: string;
        code: string;
      };
    }
  | {
      type: 'anytype:list-spaces';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:list-types';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:list-properties';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:get-type';
      payload: {
        settings: AnytypeConnectionSettings;
        typeId: string;
      };
    }
  | {
      type: 'anytype:create-type';
      payload: {
        settings: AnytypeConnectionSettings;
        name: string;
      };
    }
  | {
      type: 'anytype:prepare-paper-type';
      payload: {
        settings: AnytypeConnectionSettings;
        typeId: string;
        typeName: string;
      };
    };

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: AnytypeMessage) => {
    if (message?.type === 'anytype:check-connection') {
      return checkConnection(message.payload);
    }

    if (message?.type === 'anytype:create-challenge') {
      return createChallenge(message.payload);
    }

    if (message?.type === 'anytype:create-api-key') {
      return createApiKey(
        message.payload.settings,
        message.payload.challengeId,
        message.payload.code,
      );
    }

    if (message?.type === 'anytype:list-spaces') {
      return listSpaces(message.payload);
    }

    if (message?.type === 'anytype:list-types') {
      return listTypes(message.payload);
    }

    if (message?.type === 'anytype:list-properties') {
      return listProperties(message.payload);
    }

    if (message?.type === 'anytype:get-type') {
      return getType(message.payload.settings, message.payload.typeId);
    }

    if (message?.type === 'anytype:create-type') {
      return createType(message.payload.settings, message.payload.name);
    }

    if (message?.type === 'anytype:prepare-paper-type') {
      return preparePaperType(
        message.payload.settings,
        message.payload.typeId,
        message.payload.typeName,
      );
    }

    return undefined;
  });
});
