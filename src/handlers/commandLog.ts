import { EmbedBuilder, type Message } from 'discord.js';
import client from '../client';
import { mainColor } from '../lib/util/constants';
import Config from '../lib/util/config';

export default async function (message: Message<true>, commandName: string) {
  const config = Config.get(message.guildId);
  if (!config || !config.data.logging?.commands || !config.data.logging.commands.enabled || !config.data.logging.commands.channelId)
    return;

  const channel = await client.channels.fetch(config.data.logging.commands.channelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(mainColor)
    .setAuthor({
      name: `${commandName} | ${message.author.username}`,
      iconURL: message.author.displayAvatarURL()
    })
    .setDescription(`\`${message.content}\``)
    .addFields(
      {
        name: 'Executed In',
        value: `${message.channel.toString()} (${message.channel.id})`
      },
      {
        name: 'Executed By',
        value: `${message.author.toString()} (${message.author.id})`
      }
    )
    .setFooter({ text: `${client.user!.username}`, iconURL: client.user!.displayAvatarURL() })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
  return;
}
