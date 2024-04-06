import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { mainColor } from '../../lib/util/constants';
import Command, { data, properties } from '../../lib/structs/Command';

@data<'context'>(
  new ContextMenuCommandBuilder()
    .setName('View Avatar')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
)
@properties<'context'>({
  clientPermissions: PermissionFlagsBits.EmbedLinks
})
class AvatarCtxMenu extends Command {
  async run(interaction: UserContextMenuCommandInteraction<'cached'>) {
    const user = interaction.targetUser;

    return interaction.reply({
      embeds: [
        {
          author: { name: `${user.username}'s Avatar`, icon_url: user.displayAvatarURL() },
          image: { url: user.displayAvatarURL({ size: 4096 }) },
          color: mainColor
        }
      ],
      ephemeral: true
    });
  }
}

export default AvatarCtxMenu;
