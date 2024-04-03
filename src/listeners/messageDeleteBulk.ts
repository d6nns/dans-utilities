import { Collection, Colors, EmbedBuilder, Message, PartialMessage } from 'discord.js';
import Listener from '../lib/structs/Listener';
import { bin } from '../lib/util/functions';
import { mainColor } from '../lib/util/constants';
import Config from '../lib/util/config';

class MessageDeleteBulkListener extends Listener {
  constructor() {
    super('messageDeleteBulk');
  }

  async run(messages: Collection<string, Message<true>>) {
    const refMsg = messages.first()!;

    messages = messages.filter(msg => msg.author !== null);

    const config = Config.get(refMsg.guildId);
    if (!config) return;

    if (
      !config.data.logging?.messages ||
      !config.data.logging.messages.enabled ||
      config.data.logging.messages.excluded?.includes(refMsg.channelId || refMsg.channel.parentId!)
    )
      return false;

    const channel = await this.client.channels.fetch(config.data.logging.messages.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;

    const embed = new EmbedBuilder()
      .setColor(mainColor)
      .setAuthor({
        name: `Messages bulk deleted in #${refMsg.channel.name}`,
        iconURL: this.client.user!.displayAvatarURL()
      })
      .setTimestamp();

    const messagesArr = [...messages.values()];
    const firstMsg = messagesArr.at(-1)!;
    let prevUser = firstMsg.author.id;

    let description = `${firstMsg.author.username} (${firstMsg.author.id}):\n> ${firstMsg.content}`;

    for (let i = messagesArr.length - 2; i >= 0; i--) {
      const message = messagesArr[i];

      if (prevUser === message.author.id) description += `\n> ${message.content}`;
      else description += `\n${message.author.username} (${message.author.id}):\n> ${message.content}`;

      prevUser = message.author.id;
    }

    if (description.length > 3500) description = await bin(description);
    embed.setDescription(description);

    return channel.send({ embeds: [embed] });
  }
}

export default MessageDeleteBulkListener;
