import { Guild, GuildMember, Message, PermissionFlagsBits } from 'discord.js';
import { containsProhibitedWords, genID, quickMessage } from '../lib/util/functions';
import { PunishmentType } from '../lib/util/constants';
import client from '../client';
import { Escalation } from '../types';
import ms from 'ms';
import * as numberToWords from 'number-to-words';
import Config from '../lib/util/config';

export default async function (message: Message<true>) {
  if (
    !message.member ||
    message.author.bot ||
    message.member.id === message.guild.ownerId ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  )
    return;

  const config = Config.get(message.guildId);
  if (!config) return;

  const automod = config.data.automod;

  for (const filter of automod?.filters || []) {
    if (
      filter.enabled &&
      !filter.immuneChannels.includes(message.channelId) &&
      !filter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => filter.immuneRoles.includes(role.id))
    ) {
      if (containsProhibitedWords(message.content, filter.content)) {
        await message.delete().catch(() => {});
        if (filter.fallbackResponse) quickMessage(message, `${message.member.toString()}, ${filter.fallbackResponse}`);
        return autoModPunish(
          message.member,
          message.guild,
          '[Automod] Sending prohibited words.',
          filter.punishment,
          filter.duration!,
          message.content,
          filter.customInfo
        );
      }
    }
  }

  for (const linkFilter of automod?.links || []) {
    if (
      linkFilter.enabled &&
      !linkFilter.immuneChannels.includes(message.channelId) &&
      !linkFilter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => linkFilter.immuneRoles.includes(role.id))
    ) {
      const links = message.content.match(/https?:\/\/\S+/g) || [];
      const blockedLinks = links.filter(link => {
        const domain = new URL(link).hostname.toLowerCase();
        const isAllowed = isAllowedLink(link, linkFilter.whitelist);
        return !isAllowed;
      });

      if (blockedLinks.length > 0) {
        await message.delete().catch(() => {});
        if (linkFilter.fallbackResponse)
          quickMessage(message, `${message.member.toString()}, ${linkFilter.fallbackResponse}`);
        return autoModPunish(
          message.member,
          message.guild,
          '[Automod] Sending links.',
          linkFilter.punishment,
          linkFilter.duration!,
          blockedLinks.join(', '),
          linkFilter.customInfo
        );
      }
    }
  }

  for (const mentionFilter of automod?.mentions || []) {
    if (
      mentionFilter.enabled &&
      !mentionFilter.immuneChannels.includes(message.channelId) &&
      !mentionFilter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => mentionFilter.immuneRoles.includes(role.id))
    ) {
      const mentions = message.mentions.members;

      if (mentions.size > 0) {
        const blockedMentions = mentions.filter(mentionedUser => mentionFilter.list.includes(mentionedUser.id));
        if (blockedMentions.size > 0) {
          await message.delete().catch(() => {});
          if (mentionFilter.fallbackResponse)
            quickMessage(message, `${message.member.toString()}, ${mentionFilter.fallbackResponse}`);
          return autoModPunish(
            message.member!,
            message.guild,
            `[Automod] Pinging ${
              blockedMentions.size > 1 ? "some members who don't like pings" : "a member who doesn't like pings"
            }.`,
            mentionFilter.punishment,
            mentionFilter.duration!,
            blockedMentions.map(mention => mention.toString()).join(', '),
            mentionFilter.customInfo
          );
        }
      }
    }
  }

  if (automod?.antiSpam) {
    const maxMentionsFilter = automod.antiSpam.maxMentions;
    const maxAttachmentsFilter = automod.antiSpam.maxAttachments;
    const maxCharactersFilter = automod.antiSpam.maxCharacters;

    if (
      maxMentionsFilter?.enabled &&
      !maxMentionsFilter.immuneChannels.includes(message.channelId) &&
      !maxMentionsFilter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => maxMentionsFilter.immuneRoles.includes(role.id))
    ) {
      const mentions = message.mentions.members;

      if (mentions.size > maxMentionsFilter.limit) {
        await message.delete().catch(() => {});
        if (maxMentionsFilter.fallbackResponse)
          quickMessage(message, `${message.member.toString()}, ${maxMentionsFilter.fallbackResponse}`);
        return autoModPunish(
          message.member,
          message.guild,
          '[Automod] Pinging too many members.',
          maxMentionsFilter.punishment,
          maxMentionsFilter.duration!,
          mentions.map(mention => `\`${mention.user.username}\``).join(', '),
          maxMentionsFilter.customInfo
        );
      }
    }

    if (
      maxAttachmentsFilter?.enabled &&
      !maxAttachmentsFilter.immuneChannels.includes(message.channelId) &&
      !maxAttachmentsFilter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => maxAttachmentsFilter.immuneRoles.includes(role.id))
    ) {
      const attachments = message.attachments;

      if (attachments.size > maxAttachmentsFilter.limit) {
        await message.delete().catch(() => {});
        if (maxAttachmentsFilter.fallbackResponse)
          quickMessage(message, `${message.member.toString()}, ${maxAttachmentsFilter.fallbackResponse}`);
        return autoModPunish(
          message.member,
          message.guild,
          '[Automod] Sending a message with too many media attachments.',
          maxAttachmentsFilter.punishment,
          maxAttachmentsFilter.duration!,
          attachments.map(attachment => `\`${attachment.url}\``).join('\n'),
          maxAttachmentsFilter.customInfo
        );
      }
    }

    if (
      maxCharactersFilter?.enabled &&
      !maxCharactersFilter.immuneChannels.includes(message.channelId) &&
      !maxCharactersFilter.immuneChannels.includes(message.channel.parentId!) &&
      !message.member.roles.cache.some(role => maxCharactersFilter.immuneRoles.includes(role.id))
    ) {
      if (message.content.length > maxCharactersFilter.limit) {
        await message.delete().catch(() => {});
        if (maxCharactersFilter.fallbackResponse)
          quickMessage(message, `${message.member.toString()}, ${maxCharactersFilter.fallbackResponse}`);
        return autoModPunish(
          message.member,
          message.guild,
          '[Automod] Sending huge wall-like messages.',
          maxCharactersFilter.punishment,
          maxCharactersFilter.duration!,
          message.content,
          maxCharactersFilter.customInfo
        );
      }
    }
  }
}

function isAllowedLink(link: string, whitelist: string[]): boolean {
  const domain = new URL(link).hostname.toLowerCase();
  return whitelist.some(allowedDomain => domain.includes(allowedDomain.toLowerCase()));
}

export async function autoModPunish(
  member: GuildMember,
  guild: Guild,
  reason: string,
  punishment: PunishmentType | 'delete' | undefined,
  duration: number,
  messageContent?: string | null,
  customInfo?: string | null
) {
  if (!punishment || punishment === 'delete') return false;

  const { escalationsAutoMod } = (await client.db.guild.findUnique({
    where: { id: guild.id }
  }))!;

  const escalations = JSON.parse(escalationsAutoMod) as Escalation[];

  const date = Date.now();
  const expires = duration ? date + duration : null;
  if (punishment === PunishmentType.Mute && !duration) return false;

  const punish = await client.db.punishment.create({
    data: {
      id: genID(),
      userId: member.id,
      guildId: guild.id,
      type: punishment,
      date,
      moderatorId: client.user!.id,
      expires,
      reason,
      automod: true
    }
  });

  if (expires && punishment !== PunishmentType.Warn) {
    const data = {
      guildId: guild.id,
      userId: member.id,
      type: punishment,
      expires
    };

    await client.db.task.upsert({
      where: {
        userId_guildId_type: { userId: member.id, guildId: guild.id, type: punishment }
      },
      update: data,
      create: data
    });
  }

  await client.punishments.createDM(punish, customInfo);

  switch (punishment) {
    case PunishmentType.Ban:
      await member!.ban({ reason }).catch(() => {});
      break;
    case PunishmentType.Kick:
      await member!.kick(reason).catch(() => {});
      break;
    case PunishmentType.Mute:
      await member!.timeout(Number(duration), reason).catch(() => {});
      break;
  }

  client.punishments.createLog(punish, messageContent);

  if (punishment !== PunishmentType.Warn) return true;

  const punishmentHistory = await client.db.punishment.findMany({
    where: {
      guildId: guild.id,
      userId: member!.id,
      type: PunishmentType.Warn,
      moderatorId: client.user!.id,
      automod: true
    },
    orderBy: {
      date: 'desc'
    }
  });

  if (punishmentHistory.length === 0) return false;

  // find matching escalations
  const escalation = escalations.reduce(
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
    { amount: 0, within: '0', punishment: PunishmentType.Warn, duration: '0' }
  );

  if (escalation.amount === 0) return false;

  const eDuration = +escalation.duration;
  const eExpires = eDuration ? date + eDuration : null;
  const eReason = `[Automod] Receiving ${numberToWords.toWords(escalation.amount)} strikes${
    escalation.within !== '0' ? ` within a period of ${ms(+escalation.within, { long: true })}` : ''
  }.`;

  const ePunishment = await client.db.punishment.create({
    data: {
      id: genID(),
      userId: member.id,
      guildId: guild.id,
      type: escalation.punishment,
      date,
      moderatorId: client.user!.id,
      expires: eExpires,
      reason: eReason,
      automod: true
    }
  });

  if (eExpires) {
    const data = {
      guildId: guild.id,
      userId: member.id,
      type: escalation.punishment,
      expires: eExpires
    };

    await client.db.task.upsert({
      where: {
        userId_guildId_type: { userId: member.id, guildId: guild.id, type: escalation.punishment }
      },
      update: data,
      create: data
    });
  }

  await client.punishments.createDM(ePunishment);

  switch (escalation.punishment) {
    case PunishmentType.Ban:
      await member!.ban({ reason: eReason }).catch(() => {});
      break;
    case PunishmentType.Kick:
      await member!.kick(eReason).catch(() => {});
      break;
    case PunishmentType.Mute:
      await member!.timeout(Number(eDuration), eReason).catch(() => {});
      break;
  }

  client.punishments.createLog(ePunishment);
  return true;
}
