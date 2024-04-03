import { Collection, Snowflake } from 'discord.js';
import { ConfigData } from '../structs/Interfaces';

export default class Config {
  private static instances = new Collection<string, Config>();

  private constructor(public readonly guildId: Snowflake, public readonly data: ConfigData) {}

  static get(guildId: Snowflake): Config | undefined {
    return this.instances.get(guildId);
  }

  static create(guildId: Snowflake, data: ConfigData): Config {
    const instance = this.instances.get(guildId);
    if (instance) return instance;

    const config = new Config(guildId, data);
    Config.instances.set(guildId, config);

    return config;
  }
}
