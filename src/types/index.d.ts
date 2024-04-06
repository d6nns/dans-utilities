import { PunishmentType } from '@prisma/client';
import { PreconditionType } from '../lib/util/constants';

export type EscalationType = 'Manual' | 'AutoMod';

export type Escalation = {
  amount: number;
  within: string;
  punishment: PunishmentType;
  duration: string;
};

type MessageCommandProperties = {
  name: string;
  description: string;
  args?: string | string[];
  clientPermissions?: bigint | bigint[];
  userPermissions?: bigint | bigint[];
  aliases?: string[];
  commandChannel?: boolean;
  guildResolve?: boolean;
  slashOnly?: boolean;
  precondition?: PreconditionType;
};

export type CommandProperties<M extends 'slash' | 'message' | 'context'> = M extends 'message'
  ? MessageCommandProperties
  : {
      clientPermissions?: bigint | bigint[];
      userPermissions?: bigint | bigint[];
      guildResolve?: boolean;
      commandChannel?: boolean;
      precondition?: PreconditionType;
    };
