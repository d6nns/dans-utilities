import { Client as DJSClient, GatewayIntentBits as Intents, Options, Partials, Sweepers } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createPrismaRedisCache } from 'prisma-redis-middleware';
import fs from 'fs';
import type Command from './Command';
import type Listener from './Listener';
import type Modal from './Modal';
import Button from './Button';
import PunishmentManager from './PunishmentManager';

class Client extends DJSClient {
  public db = new PrismaClient();
  public commands = {
    slash: new Map<string, Command<false>>(),
    message: new Map<string, Command<true>>(),
    context: new Map<string, Command<false>>()
  };
  public aliases = new Map<string, string>();

  public modals = new Map<string, Modal>();
  public buttons = new Map<string, Button>();

  public punishments = new PunishmentManager();

  constructor() {
    super({
      intents: [
        Intents.Guilds,
        Intents.GuildMembers,
        Intents.GuildMessages,
        Intents.MessageContent,
        Intents.DirectMessages,
        Intents.GuildBans
      ],
      partials: [Partials.Message, Partials.Channel],
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildEmojiManager: 0,
        GuildStickerManager: 0,
        VoiceStateManager: 0,
        GuildInviteManager: 0,
        GuildScheduledEventManager: 0
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        guildMembers: {
          interval: 300,
          filter: Sweepers.filterByLifetime({
            lifetime: 300,
            excludeFromSweep: member => member.id !== process.env.CLIENT_ID
          })
        },
        messages: {
          interval: 3600,
          filter: Sweepers.filterByLifetime({
            lifetime: 3600
          })
        }
      },
      allowedMentions: {
        parse: []
      }
    });
  }

  async _cacheSlashCommands() {
    const files = fs.readdirSync(`src/commands/slash`);
    for (const file of files) {
      const cmdClass = (await import(`../../commands/slash/${file.slice(0, -3)}`)).default;
      const cmdInstant: Command = new cmdClass();
      this.commands.slash.set(cmdInstant.data.name!, cmdInstant);
    }
  }

  async _cacheMessageCommands() {
    const files = fs.readdirSync(`src/commands/message`);
    for (const file of files) {
      const cmdClass = (await import(`../../commands/message/${file.slice(0, -3)}`)).default;
      const cmdInstant: Command<true> = new cmdClass();
      this.commands.message.set(cmdInstant.name!, cmdInstant);

      cmdInstant.aliases.forEach(alias => this.aliases.set(alias, cmdInstant.name!));
    }
  }

  async _cacheContextMenuCommands() {
    const files = fs.readdirSync(`src/commands/context`);
    for (const file of files) {
      const cmdClass = (await import(`../../commands/context/${file.slice(0, -3)}`)).default;
      const cmdInstant: Command = new cmdClass();
      this.commands.context.set(cmdInstant.data.name!, cmdInstant);
    }
  }

  async _loadListeners() {
    const files = fs.readdirSync('src/listeners');
    for (const file of files) {
      const listenerClass = (await import(`../../listeners/${file.slice(0, -3)}`)).default;
      const listenerInstant: Listener = new listenerClass();
      listenerInstant.once
        ? this.once(listenerInstant.name, (...args) => void listenerInstant.run(...args))
        : this.on(listenerInstant.name, (...args) => void listenerInstant.run(...args));
    }
  }

  override async login(token: string) {
    await this._cacheSlashCommands();
    await this._cacheContextMenuCommands();
    await this._cacheMessageCommands();
    await this._loadListeners();

    this.db.$use(
      createPrismaRedisCache({
        storage: {
          type: 'memory',
          options: {
            invalidation: true
          }
        },
        cacheTime: 600000
      })
    );
    await this.db.$connect().then(() => {
      console.log('Database connection established.');
    });

    return super.login(token);
  }
}

export default Client;
