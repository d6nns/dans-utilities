import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
  hideLinkEmbed
} from 'discord.js';
import { ConfigData } from '../../lib/structs/Interfaces';
import Command, { data, properties } from '../../lib/structs/Command';

@data<'context'>(
  new ContextMenuCommandBuilder()
    .setName('Store Media')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
)
@properties<'context'>({
  clientPermissions: PermissionFlagsBits.EmbedLinks
})
class StoreMediACtxMenu extends Command {
  async run(interaction: MessageContextMenuCommandInteraction<'cached'>, args: null, config: ConfigData) {
    const message = interaction.targetMessage;
    if (message.attachments.size < 1) throw 'This message has no attachments.';

    if (!config.logging?.mediaConversion?.enabled || !config.logging?.mediaConversion?.logChannelId)
      throw '**Configuration error.**\n> I cannot store this image as the media log channels have not been configured properly.\n> To fix this, please configure the media logging settings in the config file.';

    const logChannel = await this.client.channels.fetch(config.logging.mediaConversion.logChannelId);
    if (!logChannel || !logChannel.isTextBased()) throw 'Log channel not found or is not text based.';

    const log = await logChannel
      .send({
        content: `Media from ${message.author.toString()} (\`${
          message.author.id
        }\`) stored by ${interaction.user.toString()} (\`${interaction.user.id}\`).`,
        files: Array.from(message.attachments.values())
      })
      .catch(() => {});

    if (!log)
      return interaction.reply(
        `Failed to store \`${message.attachments.size}\` ${
          message.attachments.size > 1 ? 'attachments' : 'attachment'
        } from ${message.author.toString()} (\`${
          message.author.id
        }\`) - please check my permissions in the log channel and try again.`
      );

    return interaction.reply({
      content: `Stored \`${message.attachments.size}\` ${
        message.attachments.size > 1 ? 'attachments' : 'attachment'
      } from ${message.author.toString()} (\`${message.author.id}\`). You can view ${
        message.attachments.size > 1 ? 'them' : 'it'
      } via **[this link](${hideLinkEmbed(log.url)})**.`,
      ephemeral: true
    });
  }
}

export default StoreMediACtxMenu;
