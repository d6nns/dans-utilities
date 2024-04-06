import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionsBitField,
  Message,
  If,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction
} from 'discord.js';
import client from '../../client';
import { CommandProperties } from '../../types';
import { isMessageCommandProperties } from '../../types/typeguard';
import { ConfigData } from './Interfaces';
import { PreconditionType } from '../util/constants';

export default abstract class Command<IsMsg extends boolean = false> {
  public readonly data: IsMsg extends false ? Partial<SlashCommandBuilder> : null = null!;
  public clientPermissions: PermissionsBitField | null = null;
  public userPermissions: PermissionsBitField | null = null;
  public precondition: PreconditionType | null = null;

  // only present in slash commands
  public id: If<IsMsg, null, string> = null!;
  // not present in slash commands
  public name: If<IsMsg, string> = null!;
  public description: If<IsMsg, string> = null!;
  public aliases: If<IsMsg, string[]> = null!;
  public args: If<IsMsg, string[] | null> = null!;
  // Not Available - Redirect to slash command
  public slashOnly: If<IsMsg, boolean> = null!;

  public guildResolve = false;
  public commandChannel = false;
  public client = client;

  abstract run(
    interaction: ChatInputCommandInteraction | Message | ContextMenuCommandInteraction,
    args?: string[] | null,
    config?: ConfigData
  ): unknown;
}

export function data<M extends 'slash' | 'context' = 'slash'>(
  data: M extends 'slash' ? Partial<SlashCommandBuilder> : Partial<ContextMenuCommandBuilder>
) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      data = data;
    };
  };
}

export function properties<M extends 'message' | 'slash' | 'context'>(properties: CommandProperties<M>) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      clientPermissions = properties.clientPermissions ? new PermissionsBitField(properties.clientPermissions) : null;
      userPermissions = properties.userPermissions ? new PermissionsBitField(properties.userPermissions) : null;
      precondition = properties.precondition ?? null;

      name = isMessageCommandProperties(properties) ? properties.name : null;
      description = isMessageCommandProperties(properties) ? properties.description : null;
      args = isMessageCommandProperties(properties)
        ? typeof properties.args === 'string'
          ? [properties.args]
          : properties.args
        : null;
      aliases = isMessageCommandProperties(properties) ? properties.aliases ?? [] : [];
      slashOnly = isMessageCommandProperties(properties) ? properties.slashOnly : null;

      commandChannel = properties.commandChannel;
      guildResolve = properties.guildResolve;
    };
  };
}
