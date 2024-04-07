import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  EmbedField,
  PermissionFlagsBits,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { infractionsPerPage, mainColor } from '../../lib/util/constants';
import Command, { data, properties } from '../../lib/structs/Command';
import { getUser } from '../../lib/util/functions';
import { PunishmentType } from '../../lib/util/constants';

@data<'context'>(
  new ContextMenuCommandBuilder()
    .setName('View Punishments')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
)
@properties<'context'>({
  clientPermissions: PermissionFlagsBits.EmbedLinks
})
class ViewPunishmentsCtxMenu extends Command {
  async run(interaction: UserContextMenuCommandInteraction<'cached'>) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.targetUser;
    let page = 1;

    const punishmentCount = await this.client.db.punishment.count({
      where: {
        guildId: interaction.guildId,
        userId: user.id
      }
    });

    if (punishmentCount === 0)
      return interaction.editReply(`${user === interaction.user ? 'You have' : 'That user has'} no strikes.`);

    const pages = Math.ceil(punishmentCount / 7);
    if (page > pages) page = pages;

    const punishments = await this.client.db.punishment.findMany({
      where: {
        guildId: interaction.guildId,
        userId: user.id
      },
      orderBy: {
        id: 'desc'
      },
      take: infractionsPerPage,
      skip: infractionsPerPage * (page - 1)
    });

    const punishmentsEmbed = new EmbedBuilder()
      .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL() })
      .setDescription(`All punishments for ${user.toString()}.`)
      .setColor(mainColor)
      .setFooter({ text: `Page ${page}/${pages}` });

    const fields: EmbedField[] = [];
    for (const punishment of punishments) {
      const moderator = await getUser(punishment.moderatorId);
      const field: EmbedField = {
        name: `ID: ${punishment.id} | Moderator: ${
          interaction.member!.permissions.has(PermissionFlagsBits.ModerateMembers) ? `${moderator!.username}` : 'Hidden'
        }`,
        value: `**${punishment.type.toString()}** - ${punishment.reason.slice(0, 100)}${
          punishment.reason.length > 100 ? '...' : ''
        } - <t:${Math.floor(Number(punishment.date / 1000n))}>${
          punishment.type === PunishmentType.Mute
            ? ` (Expires <t:${Math.floor(Number(punishment.expires! / 1000n))}:R>)`
            : ''
        }`,
        inline: false
      };

      fields.push(field);
    }

    punishmentsEmbed.setFields(fields);

    return interaction.editReply({ embeds: [punishmentsEmbed] });
  }
}

export default ViewPunishmentsCtxMenu;
