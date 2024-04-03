import { EmbedBuilder, Message } from 'discord.js';
import { bin } from '../lib/util/functions';
import client from '../client';
import { mainColor } from '../lib/util/constants';
import Config from '../lib/util/config';

export default async function (oldMessage: Message<true> | null, message: Message<true>) {
  if (!message.author) return;
  if (message.author.bot) return;
  if (!message.guild) return;

  if (oldMessage && oldMessage.content === message.content) return;

  const config = Config.get(message.guildId);
  if (!config) return;

  if (
    !config.data.logging?.messages ||
    !config.data.logging.messages.enabled ||
    config.data.logging.messages.excluded?.includes(message.channelId || message.channel.parentId!)
  )
    return false;

  const channel = await client.channels.fetch(config.data.logging.messages.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const embed = new EmbedBuilder()
    .setColor(mainColor)
    .setAuthor({
      name: `Message from ${message.author.username} (${message.author.id}) ${oldMessage ? 'edited' : 'deleted'} in #${
        message.channel.name
      }`,
      iconURL: message.author.displayAvatarURL()
    })
    .setTimestamp();

  if (oldMessage && message.content.length > 0) {
    embed.setDescription(`[Jump to message](${message.url})`).addFields(
      {
        name: 'Old',
        value: oldMessage?.content
          ? oldMessage.content.length > 1000
            ? await bin(oldMessage.content)
            : oldMessage.content
          : '<unknown>'
      },
      {
        name: 'New',
        value: message.content.length > 1000 ? await bin(message.content) : message.content
      }
    );
  } else {
    if (message.content)
      embed.addFields({
        name: 'Content',
        value: message.content.length > 1000 ? await bin(message.content) : message.content
      });

    const url = message.attachments.first()?.url;
    const qMarkIndex = url ? url.indexOf('?') : null;
    if (
      message.attachments.size === 1 &&
      ['png', 'webp', 'jpg', /*j*/ 'peg', 'gif'].includes(url!.slice(0, qMarkIndex!).slice(-3))
    )
      embed.setImage(message.attachments.map(attachment => attachment.url).join('\n'));
    else if (message.attachments.size > 0) {
      embed.addFields({
        name: 'Attachments',
        value: message.attachments
          .map(attachment => {
            const qMarkIndex = attachment.url.lastIndexOf('?');
            const stopAtFileName = attachment.url.slice(0, qMarkIndex);
            return `[${stopAtFileName.slice(stopAtFileName.lastIndexOf('/') + 1)}](${attachment.url})`;
          })
          .join('\n')
      });
    }
  }

  return channel.send({ embeds: [embed] });
}
