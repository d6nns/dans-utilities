import { GuildMember, Message, PermissionFlagsBits, User } from 'discord.js';
import client from '../client';
import { PunishmentType as PT } from '../lib/util/constants';
import { adequateHierarchy, genID, getFlag, getMember, getUser } from '../lib/util/functions';
import ms from 'ms';
import numberToWord from 'number-to-words';
import { Escalation } from '../types';
import { ConfigData } from '../lib/structs/Interfaces';
import commandLog from './commandLog';

export default async function (message: Message<true>, args: string[], commandName: string, config: ConfigData) {
  if (!message.member) return;

  const command = await client.db.shortcut.findUnique({
    where: {
      guildId_name: { guildId: message.guildId, name: commandName }
    }
  });

  if (!command) return;

  if (!message.member.permissions.has(command.permission)) {
    const override = config.commands.overrides?.find(override => override.name === commandName);
    if (!message.member.roles.cache.some(role => override?.roles?.includes(role.id)))
      return message.delete().catch(() => {});
  }

  const silentFlag = getFlag(message.content, 'silent', 's');
  if (silentFlag?.value) {
    const silentFlagTokens = silentFlag.formatted.split(/\s+/);
    args.splice(args.indexOf(silentFlagTokens[0]), silentFlagTokens.length);
  }

  const { punishment, reason, duration, deleteTime, additionalInfo } = command;

  if (args.length == 0)
    throw `You must provide a ${
      punishment === PT.Ban || punishment === PT.Unban ? 'user' : 'member'
    } to ${punishment.toLowerCase()}.`;

  const target = (await getMember(message.guildId, args[0])) ?? (await getUser(args[0]));

  if (!target) throw 'Invalid user.';
  if (command.punishment !== PT.Ban && command.punishment !== PT.Unban && target instanceof User)
    throw 'The provided user is not in this guild.';

  const date = Date.now();
  const expires = duration ? date + Number(duration) : null;
  const lpunishment = punishment.toLowerCase();

  if (punishment === PT.Unban && !(await message.guild.bans.fetch(target.id).catch(() => null)))
    throw 'That user is not banned.';

  if (target.id === message.author.id) throw `You cannot ${lpunishment} yourself.`;
  if (target.id === client.user!.id) throw `You cannot ${lpunishment} me.`;

  if (target instanceof GuildMember) {
    if (punishment === PT.Mute && target.permissions.has(PermissionFlagsBits.Administrator))
      throw 'You cannot mute an administrator.';

    if (!adequateHierarchy(message.member, target))
      throw `You cannot ${lpunishment} this member due to inadequete hierarchy.`;

    if (!adequateHierarchy(message.guild.members.me!, target))
      return message.reply(
        `**Configuration error.**\n> I cannot ${lpunishment} this member due to inadequete hierarchy.\n> To fix this, make sure my role is above this member's highest position role.`
      );
  }

  message.delete().catch(() => {});
  const punish = await client.db.punishment.create({
    data: {
      id: genID(),
      guildId: message.guildId,
      userId: target.id,
      type: punishment,
      date,
      moderatorId: message.author.id,
      expires,
      reason
    },
    include: { guild: { select: { escalationsManual: true } } }
  });

  if (expires) {
    const data = {
      guildId: message.guildId,
      userId: target.id,
      type: punishment,
      expires
    };

    if (punishment === PT.Mute)
      await client.db.task.upsert({
        where: {
          userId_guildId_type: { userId: target.id, guildId: message.guildId, type: punishment }
        },
        update: data,
        create: data
      });
  }

  if (!silentFlag) await client.punishments.createDM(punish, additionalInfo);

  switch (punishment) {
    case PT.Ban:
      await message.guild.members
        .ban(target.id, { reason, deleteMessageSeconds: deleteTime ?? undefined })
        .catch(() => {});
      break;
    case PT.Kick:
      await message.guild.members.kick(target.id, reason).catch(() => {});
      break;
    case PT.Mute:
      await (target as GuildMember).timeout(Number(duration), reason).catch(() => {});
      break;
    case PT.Unban:
      await message.guild.bans.remove(target.id, reason).catch(() => {});
      break;
    case PT.Unmute:
      await (target as GuildMember).timeout(null).catch(() => {});
      break;
  }

  client.punishments.createMessage(punish, message.channel);

  client.punishments.createLog(punish);
  commandLog(message, commandName);

  if (punish.type !== PT.Warn) return;
  if (!(target instanceof GuildMember)) return;

  const punishmentHistory = await client.db.punishment.findMany({
    where: {
      guildId: message.guild.id,
      userId: target.id,
      type: PT.Warn,
      moderatorId: { not: client.user!.id },
      automod: false
    },
    orderBy: {
      date: 'desc'
    }
  });

  if (punishmentHistory.length === 0) return false;

  const escalation = (JSON.parse(punish.guild.escalationsManual) as Escalation[]).reduce(
    (prev, curr) => {
      const within = +curr.within;

      return punishmentHistory.length >= curr.amount &&
        curr.amount >= prev.amount &&
        (within !== 0
          ? within < (+prev.within || Infinity) && date - Number(punishmentHistory[curr.amount - 1].date) <= within
          : curr.amount !== prev.amount)
        ? curr
        : prev;
    },
    { amount: 0, within: '0', punishment: PT.Warn, duration: '0' }
  );

  if (escalation.amount === 0) return false;

  const eDuration = +escalation.duration;
  const eExpires = eDuration ? date + eDuration : null;

  const ePunishment = await client.db.punishment.create({
    data: {
      id: genID(),
      userId: target.id,
      guildId: message.guildId,
      type: escalation.punishment,
      date,
      moderatorId: message.member.id,
      expires: eExpires,
      reason: `Receiving ${numberToWord.toWords(escalation.amount)} strikes${
        escalation.within !== '0' ? ` within a period of ${ms(+escalation.within, { long: true })}` : ''
      }.`
    }
  });

  if (eExpires) {
    const data = {
      guildId: message.guildId,
      userId: target.id,
      type: escalation.punishment,
      expires: eExpires
    };

    await client.db.task.upsert({
      where: {
        userId_guildId_type: {
          userId: target.id,
          guildId: message.guildId,
          type: escalation.punishment
        }
      },
      update: data,
      create: data
    });
  }

  await client.punishments.createDM(ePunishment);

  switch (escalation.punishment) {
    case PT.Ban:
      await target.ban({ reason: ePunishment.reason }).catch(() => {});
      break;
    case PT.Kick:
      await target.kick(ePunishment.reason).catch(() => {});
      break;
    case PT.Mute:
      await target.timeout(Number(eDuration), ePunishment.reason).catch(() => {});
      break;
  }

  client.punishments.createLog(ePunishment);
}
