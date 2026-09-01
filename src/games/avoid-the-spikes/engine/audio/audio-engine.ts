import { SFX, type SfxName } from './sfx'
import { AudioEngine as BaseAudioEngine, type AudioDeps, type IAudioEngine } from '../../../../lib/audio-engine'

export type { AudioDeps, IAudioEngine }

export class AudioEngine extends BaseAudioEngine<SfxName> {
  public constructor(deps: AudioDeps = {}) {
    super(SFX, deps)
  }
}
