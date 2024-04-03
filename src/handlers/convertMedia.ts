import { Message, hideLinkEmbed } from 'discord.js';
import client from '../client';
import Config from '../lib/util/config';

export default async function (message: Message<true>) {
  const config = Config.get(message.guildId);
  if (!config || !config.data.logging?.mediaConversion?.enabled || !config.data.logging?.mediaConversion?.logChannelId)
    return;

  if (
    message.attachments.size > 0 &&
    message.content.length === 0 &&
    config.data.logging.mediaConversion.channelIds.includes(message.channelId)
  ) {
    const logChannel = await client.channels.fetch(config.data.logging.mediaConversion.logChannelId);
    if (!logChannel || !logChannel.isTextBased()) return;

    message.delete().catch(() => {});
    const log = await logChannel
      .send({
        content: `Media stored by ${message.member!.toString()} (\`${message.author.id}\`).`,
        files: Array.from(message.attachments.values())
      })
      .catch(() => {});

    if (!log)
      return message.channel.send(
        `Failed to store \`${message.attachments.size}\` ${
          message.attachments.size > 1 ? 'attachments' : 'attachment'
        } for ${message.author.toString()} (\`${
          message.author.id
        }\`) - please check my permissions in the log channel and try again.`
      );

    return message.channel.send({
      content: `Stored \`${message.attachments.size}\` ${
        message.attachments.size > 1 ? 'attachments' : 'attachment'
      } for ${message.author.toString()} (\`${message.author.id}\`). You can view ${
        message.attachments.size > 1 ? 'them' : 'it'
      } via **[this link](${hideLinkEmbed(log.url)})**.`,
      allowedMentions: { parse: ['users'] }
    });
  }
}
