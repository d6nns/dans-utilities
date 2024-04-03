import {
  type Guild,
  type GuildMember,
  Collection,
  ApplicationCommandPermissions,
  Message,
  Colors,
  SnowflakeUtil,
  REST,
  Routes
} from 'discord.js';
import client from '../../client';
import ms from 'ms';
import { ConfigData } from '../structs/Interfaces';
import * as yaml from 'js-yaml';
import * as path from 'path';
import fs from 'fs';
import Config from './config';
export const commandsPermissionCache = new Map<string, Collection<string, readonly ApplicationCommandPermissions[]>>();

export function adequateHierarchy(member1: GuildMember, member2: GuildMember) {
  if (member1.guild.ownerId === member1.id) return true;
  if (member2.guild.ownerId === member2.id) return false;
  return member1.roles.highest.comparePositionTo(member2.roles.highest) > 0;
}

const snowflakeReg = /^\d{17,19}$/;
export async function getUser(user: string) {
  if (!user) return;
  if (user.startsWith('<@')) {
    user = user.slice(2, -1);
    if (user.startsWith('!')) user = user.slice(1);
  }

  if (!snowflakeReg.test(user)) return null;
  return client.users.fetch(user).catch(() => null);
}

export async function getMember(guild: Guild | string, user: string) {
  if (!guild || !user) return;
  if (user.startsWith('<@')) {
    user = user.slice(2, -1);
    if (user.startsWith('!')) user = user.slice(1);
  }

  if (!snowflakeReg.test(user)) return null;

  if (typeof guild === 'string')
    return client.guilds.cache
      .get(guild)!
      .members.fetch(user)
      .catch(() => null);
  else return guild.members.fetch(user).catch(() => null);
}

export function getChannel(guild: Guild | string, channel: string) {
  if (!guild || !channel) return;
  if (channel.startsWith('<#')) channel = channel.slice(2, -1);

  if (typeof guild === 'string') return client.guilds.cache.get(guild)!.channels.cache.get(channel) ?? null;
  else return guild.channels.cache.get(channel) ?? null;
}

export function parseDuration(durationStr: string) {
  if (!durationStr) return NaN;

  let duration;

  const unaryTest = +durationStr;
  if (unaryTest) duration = unaryTest * 1000;
  else duration = ms(durationStr) ?? NaN;

  return duration;
}

export async function bin(data: any, ext: string = 'js') {
  const binReq = await fetch('https://hst.sh/documents', {
    method: 'POST',
    body: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
  });

  if (!binReq.ok) throw `Error uploading to hastebin; status code: ${binReq.status}`;
  const bin = await binReq.json();
  return `https://hst.sh/${bin.key}.${ext}`;
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function throwError(message: Message, error: string) {
  const errorMsg = await message.channel.send({
    embeds: [
      {
        description: error,
        color: Colors.Red
      }
    ]
  });

  setTimeout(() => {
    errorMsg.delete().catch(() => {});
    message.delete().catch(() => {});
  }, 5000);
}

export async function quickMessage(message: Message, content: string) {
  const msg = await message.channel.send({ content: content, allowedMentions: { parse: ['users'] } });

  setTimeout(() => {
    msg.delete().catch(() => {});
  }, 5000);
}

export function genID(): string {
  const currentDate = new Date();
  return String(SnowflakeUtil.generate({ timestamp: currentDate.getTime() }));
}

export async function readConfig(guildId: string): Promise<ConfigData | null> {
  const configFile = await confirmConfig(guildId);
  if (!configFile) return null;
  const configFilePath = getConfigFilePath(guildId);

  try {
    const fileContents = await fs.promises.readFile(configFilePath, 'utf8');
    const data: ConfigData = (yaml.load(fileContents) as ConfigData) ?? {
      commands: {
        prefix: '!',
        enabled: true
      }
    };
    const config = Config.create(guildId, data);
    return data;
  } catch (error) {
    console.error(`[Config] Error reading config file for guild ${guildId}: ${error}`);
    return null;
  }
}

const getConfigFilePath = (guildId: string): string => {
  return path.join('config', `${guildId}.yaml`);
};

export async function confirmConfig(guildId: string) {
  const configFilePath = getConfigFilePath(guildId);

  try {
    await fs.promises.access(configFilePath);
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[Config] Config file for guild ${guildId} does not exist.`);
    }
    return null;
  }
}

export function formatDuration(duration: bigint) {
  const weeksInMilliseconds = 604800000n;
  const daysInMilliseconds = 86400000n;
  const hoursInMilliseconds = 3600000n;
  const minutesInMilliseconds = 60000n;
  const secondsInMilliseconds = 1000n;

  const weeks = Number(duration / weeksInMilliseconds);
  duration %= weeksInMilliseconds;

  const days = Number(duration / daysInMilliseconds);
  duration %= daysInMilliseconds;

  const hours = Number(duration / hoursInMilliseconds);
  duration %= hoursInMilliseconds;

  const minutes = Number(duration / minutesInMilliseconds);
  duration %= minutesInMilliseconds;

  const seconds = Number(duration / secondsInMilliseconds);

  const totalDays = weeks * 7 + days;

  const parts: string[] = [];

  if (totalDays > 30) {
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;
    parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (remainingDays > 0) {
      parts.push(`${remainingDays} day${remainingDays !== 1 ? 's' : ''}`);
    }
  } else {
    if (weeks > 0) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }

  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' ') : '0 seconds';
}

export function getFlag(input: string, ...flags: string[]) {
  const flagRegex = new RegExp(`(^|\\s)(--|-)(${flags.join('|')})(=|:)?([^\\s]+)?`, 'g');
  const matches: RegExpExecArray[] = [];
  let next: RegExpExecArray | null;

  while ((next = flagRegex.exec(input))) matches.push(next);

  if (!matches.length) return null;

  const targetFlag = matches.find(f => flags.includes(f[3]))?.[0].trim();
  if (!targetFlag) return null;

  const targetFlagValue = matches[0][5]?.replaceAll(/\\("|'|`|“|”|\/)/g, '$1');

  if (!targetFlagValue)
    return {
      name: targetFlag.split(/-|--|—/)[1],
      formatted: targetFlag,
      value: true
    };

  if (
    targetFlagValue[0] === '"' ||
    targetFlagValue[0] === "'" ||
    targetFlagValue[0] === '`' ||
    targetFlagValue[0] === '“'
  )
    return {
      name: targetFlag.split(/-|--|—/)[1],
      formatted: targetFlag,
      value: targetFlagValue.slice(1, -1)
    };

  if (targetFlagValue[0] === '/')
    return {
      name: targetFlag.split(/-|--|—/)[1],
      regexFlags: targetFlagValue.split('/')[2]?.split('') || null,
      formatted: targetFlag,
      value: targetFlagValue.split('/')[1]
    };

  if (targetFlagValue.toLowerCase() === 'true' || targetFlagValue.toLowerCase() === 'false')
    return {
      name: targetFlag.split(/-|--|—/)[1],
      formatted: targetFlag,
      value: targetFlagValue.toLowerCase() === 'true'
    };

  return {
    name: targetFlag.split(/-|--|—/)[1],
    formatted: targetFlag,
    value: targetFlagValue
  };
}

export function containsProhibitedWords(message: string, prohibitedWords: string[]): boolean {
  const normalizedMessage = message.toLowerCase().replace(/\s/g, '');

  for (const word of prohibitedWords) {
    const normalizedWord = word.toLowerCase().replace(/\s/g, '');

    if (normalizedMessage.includes(normalizedWord)) {
      return true;
    }
    const mixedWordRegex = new RegExp(normalizedWord.split('').join('\\s*'), 'i');
    if (mixedWordRegex.test(normalizedMessage)) {
      return true;
    }
  }

  return false;
}

export async function confirmCommands(guild: Guild) {
  const commands = [];
  const commandFiles = fs.readdirSync('./src/commands/slash').filter(file => file.endsWith('.ts'));

  for (const file of commandFiles) {
    const commandClass = (await import(`../../../dist/commands/slash/${file.slice(0, -3)}`)).default;
    const commandInstant = new commandClass();
    commands.push(commandInstant.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

  try {
    console.log(`[Client] Started refreshing ${commands.length} application (/) commands for guild ${guild.id}.`);
    const data: any = await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });

    console.log(`[Client] Successfully reloaded ${data.length} application (/) commands for guild ${guild.id}.`);
  } catch (error) {
    console.error(error);
  }
}
